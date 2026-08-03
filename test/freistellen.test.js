// Tests für das Chroma-Key-Freistellen (pngAlpha.js + freistellen.js).
// Gemini liefert nachweislich KEINEN echten Alphakanal (getestet gegen die
// echte API — bei "transparent" malt es ein Schachbrettmuster als Pixel statt
// echter Transparenz), darum zeichnen wir auf einer festen Fläche und stanzen
// sie hier hart heraus. Diese Tests laufen komplett offline mit selbst gebauten
// PNG-Fixtures (kein API-Key, kein echter Aufruf).

const { test } = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("zlib");
const { dekodierePng, kodierePng } = require("../netlify/functions/lib/pngAlpha");
const { freistellen } = require("../netlify/functions/lib/freistellen");

// Ein einfaches, farbiges RGB-PNG (Farbtyp 2, KEIN Alphakanal) von Hand bauen —
// genau das Format, in dem Gemini seine Bilder tatsächlich liefert. Bewusst
// unabhängig vom Kodierer aus pngAlpha.js gehalten, damit der Test wirklich
// unabhängig prüft (nicht Kodierer gegen sich selbst testet).
const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABELLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(typ, daten) {
  const laenge = Buffer.alloc(4); laenge.writeUInt32BE(daten.length, 0);
  const typDaten = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typDaten), 0);
  return Buffer.concat([laenge, typDaten, crc]);
}
// bildFn(x, y) -> [r,g,b]
function baueRgbPng(width, height, bildFn) {
  const zeilenLaenge = width * 3;
  const roh = Buffer.alloc(height * (zeilenLaenge + 1));
  for (let y = 0; y < height; y++) {
    roh[y * (zeilenLaenge + 1)] = 0; // Filter "None"
    for (let x = 0; x < width; x++) {
      const [r, g, b] = bildFn(x, y);
      const off = y * (zeilenLaenge + 1) + 1 + x * 3;
      roh[off] = r; roh[off + 1] = g; roh[off + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); ihdr.writeUInt8(2, 9); // 8-Bit, Farbtyp 2 = RGB
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(roh)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png.toString("base64");
}

test("dekodierePng: RGB (Farbtyp 2) wird zu RGBA mit Alpha=255 überall", () => {
  const base64 = baueRgbPng(4, 4, () => [219, 41, 133]);
  const info = dekodierePng(base64);
  assert.equal(info.width, 4);
  assert.equal(info.height, 4);
  for (let i = 3; i < info.pixel.length; i += 4) assert.equal(info.pixel[i], 255);
});

test("kodierePng -> dekodierePng: Rundtrip erhält Pixelwerte exakt", () => {
  const pixel = Buffer.from([10, 20, 30, 255, 200, 100, 50, 128]); // 2 Pixel, 1x2
  const base64 = kodierePng({ width: 1, height: 2, pixel });
  const info = dekodierePng(base64);
  assert.deepEqual(Array.from(info.pixel), Array.from(pixel));
});

// freistellen() liest die Ecken mit 2px Einrückung (echte Bilder sind 1024px
// gross, 2px sind dort tief im Hintergrund) — die Testbilder müssen also gross
// genug sein, dass (2,2) & Co. wirklich Hintergrund treffen und nicht schon die
// Testfigur/-region.

test("freistellen: einheitliche Hintergrundfarbe wird komplett transparent", () => {
  // 12x12: Rand = Hintergrundfarbe, 4x4-Block in der Mitte = Figur (Weiss).
  const bg = [219, 41, 133];
  const fig = [255, 255, 255];
  const base64 = baueRgbPng(12, 12, (x, y) => (x >= 4 && x <= 7 && y >= 4 && y <= 7) ? fig : bg);
  const freigestellt = freistellen(base64);
  const info = dekodierePng(freigestellt);
  const idx = (x, y) => (y * info.width + x) * 4;

  // Ecken (Hintergrund) müssen komplett transparent sein.
  for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11]]) {
    assert.equal(info.pixel[idx(x, y) + 3], 0, `Ecke (${x},${y}) sollte transparent sein`);
  }
  // Die Figur in der Mitte muss undurchsichtig UND farblich unverändert bleiben.
  const figIdx = idx(5, 5);
  assert.equal(info.pixel[figIdx + 3], 255, "Figur sollte undurchsichtig sein");
  assert.deepEqual(
    [info.pixel[figIdx], info.pixel[figIdx + 1], info.pixel[figIdx + 2]],
    fig,
    "Farbe der Figur darf sich nicht ändern"
  );
});

test("freistellen: bricht ab, wenn die vier Ecken keinen einheitlichen Hintergrund zeigen", () => {
  // Vier grundverschiedene 3x3-Eckregionen -> kein Freistellen möglich, kein stiller Murks.
  const base64 = baueRgbPng(8, 8, (x, y) => {
    if (x < 3 && y < 3) return [255, 0, 0];
    if (x >= 5 && y < 3) return [0, 255, 0];
    if (x < 3 && y >= 5) return [0, 0, 255];
    if (x >= 5 && y >= 5) return [255, 255, 0];
    return [255, 255, 255];
  });
  assert.throws(() => freistellen(base64), /kein einheitlicher hintergrund/i);
});

test("freistellen: weicher Übergang nahe der Schwelle (keine harte Treppenstufe)", () => {
  const bg = [219, 41, 133];
  // Ein Testpixel mit mittlerer Distanz zur Hintergrundfarbe -> weder 0 noch 255.
  const grenzfall = [219, 41, 133 + 55]; // Distanz genau in der Weichzone
  const base64 = baueRgbPng(8, 8, (x, y) => (x === 4 && y === 4) ? grenzfall : bg);
  const info = dekodierePng(freistellen(base64));
  const alpha = info.pixel[(4 * 8 + 4) * 4 + 3];
  assert.ok(alpha > 0 && alpha < 255, "Alpha im Grenzbereich sollte weder 0 noch 255 sein, war: " + alpha);
});
