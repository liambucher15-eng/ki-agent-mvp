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

test("freistellen: kein erkennbarer Hintergrund -> Bild kommt unverändert zurück, kein Absturz", () => {
  // Fünf grundverschiedene Farben, gleichmässig über den GANZEN Bildrand verteilt
  // (nicht nur die 4 Ecken) -> keine stellt auch nur annähernd eine Mehrheit,
  // MIN_ANTEIL (25%) wird von keiner erreicht. Anders als die Vorgängerfassung
  // bricht das jetzt nicht mit einem Fehler ab, den charakter-background.js
  // auffangen musste, sondern liefert das Bild einfach unverändert zurück.
  //
  // (Ein früherer Versuch mit vier Eckregionen + weissem Kreuz in der Mitte
  // scheiterte an genau der Robustheit, die dieser Umbau bringen soll: das
  // Kreuz lief über den GANZEN Rand und stellte dort selbst die Mehrheit —
  // kein Fehler im Code, nur ein Testbild, das den Rand nicht wirklich uneinig
  // machte.)
  const FARBEN = [[230, 20, 20], [20, 230, 20], [20, 20, 230], [230, 230, 20], [230, 20, 230]];
  const base64 = baueRgbPng(15, 15, (x, y) => FARBEN[(x + y) % FARBEN.length]);
  assert.doesNotThrow(() => freistellen(base64));
  const vorher = dekodierePng(base64);
  const nachher = dekodierePng(freistellen(base64));
  assert.deepEqual(Array.from(nachher.pixel), Array.from(vorher.pixel), "Bild muss byte-identisch bleiben, inkl. Alpha=255 überall");
});

test("freistellen: eine Ecke, die die Figur berührt, hindert das Freistellen nicht mehr", () => {
  // Genau der Fall, der die alte Vier-Ecken-Prüfung kippte: EIN Eckpixel gehört
  // zur Figur, nicht zum Hintergrund. Der Rest der Randfläche ist sauberer
  // Hintergrund und muss trotzdem vollständig freigestellt werden.
  const bg = [219, 41, 133];
  const fig = [30, 120, 90];
  const base64 = baueRgbPng(20, 20, (x, y) => {
    // Figur: ein Block, der bis in die obere linke Ecke hineinreicht (inkl. des
    // frueher exakt bei (2,2) abgetasteten Punkts) UND ein zentraler Kernblock,
    // damit "unveraendert bei Nicht-Erreichen" ueberhaupt pruefbar ist.
    if (x < 5 && y < 5) return fig;
    if (x >= 8 && x <= 11 && y >= 8 && y <= 11) return fig;
    return bg;
  });
  const info = dekodierePng(freistellen(base64));
  const idx = (x, y) => (y * info.width + x) * 4;

  // Hintergrund fernab der kontaminierten Ecke: vollstaendig transparent.
  for (const [x, y] of [[19, 0], [0, 19], [19, 19], [15, 2]]) {
    assert.equal(info.pixel[idx(x, y) + 3], 0, `(${x},${y}) sollte transparent sein`);
  }
  // Der zentrale Figur-Kern bleibt unangetastet: undurchsichtig, Farbe unveraendert.
  assert.equal(info.pixel[idx(9, 9) + 3], 255);
  assert.deepEqual([info.pixel[idx(9, 9)], info.pixel[idx(9, 9) + 1], info.pixel[idx(9, 9) + 2]], fig);
});

test("freistellen: ein sanfter Verlauf im Hintergrund wird trotzdem vollständig freigestellt", () => {
  // Hintergrund driftet über die Bildbreite spuerbar (Endpunkte weiter auseinander
  // als die alte starre Schwelle erlaubt hätte), aber jeder einzelne Schritt
  // zwischen Nachbarpixeln bleibt klein — genau das Muster eines echten,
  // sanften Schattens/Verlaufs. Ein 6x6-Block in der Mitte ist die Figur.
  const start = 100, ende = 220, breite = 24;
  const farbeBeiX = (x) => Math.round(start + ((ende - start) * x) / (breite - 1));
  const fig = [10, 200, 10];
  const base64 = baueRgbPng(breite, breite, (x, y) => {
    if (x >= 9 && x <= 14 && y >= 9 && y <= 14) return fig;
    const v = farbeBeiX(x);
    return [v, 40, 130];
  });
  const info = dekodierePng(freistellen(base64));
  const idx = (x, y) => (y * info.width + x) * 4;

  // Beide Enden des Verlaufs müssen freigestellt sein, obwohl ihr Farbabstand
  // zueinander weit über der alten starren Schwelle liegt.
  assert.equal(info.pixel[idx(0, 0) + 3], 0, "helles Ende des Verlaufs sollte transparent sein");
  assert.equal(info.pixel[idx(breite - 1, breite - 1) + 3], 0, "dunkles Ende des Verlaufs sollte transparent sein");
  // Die Figur bleibt unangetastet.
  assert.equal(info.pixel[idx(11, 11) + 3], 255);
  assert.deepEqual([info.pixel[idx(11, 11)], info.pixel[idx(11, 11) + 1], info.pixel[idx(11, 11) + 2]], fig);
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

// ── Weiche Bilder: 3D-Renders ────────────────────────────────────────────
//
// Das Fluten braucht eine harte Kante als Barriere — genau die liefert die
// Stilvorgabe "flacher Cartoon-Stil, klare Konturen". Ein 3D-Render hat keine:
// weiche Übergänge, Lichtverlauf im Hintergrund, Bodenschatten. Gemessen an
// einer echten Gemini-Brotfigur blieben davon 0,1 bis 1,2 Prozent deckende
// Fläche übrig statt der rund 22 Prozent, die ein flaches Bild erreicht — nur
// Augen, Mund und Gliedmassen.
//
// Deshalb der Rückfall auf den Farbton. Diese Tests halten fest, dass er
// greift, WANN er greift, und dass der flache Fall unberührt bleibt.

function deckenderAnteil(pngBase64) {
  const { width, height, pixel } = dekodierePng(pngBase64);
  let deckend = 0;
  for (let i = 3; i < pixel.length; i += 4) if (pixel[i] > 215) deckend++;
  return deckend / (width * height);
}

// Ein 3D-Render im Kleinen: Hintergrund mit Lichtverlauf von oben nach unten,
// Figur mit weichem Rand statt harter Kontur.
function weichesBild(w, h) {
  return baueRgbPng(w, h, (x, y) => {
    const dx = x - w / 2, dy = y - h / 2;
    const r = Math.sqrt(dx * dx + dy * dy);
    const rand = h * 0.3;
    if (r < rand) {
      // Figur: helles Beige, zum Rand hin weich auslaufend (kein harter Sprung).
      const t = Math.min(1, (rand - r) / (h * 0.06));
      const hg = hintergrundBei(y, h);
      return [
        Math.round(230 * t + hg[0] * (1 - t)),
        Math.round(220 * t + hg[1] * (1 - t)),
        Math.round(190 * t + hg[2] * (1 - t)),
      ];
    }
    return hintergrundBei(y, h);
  });
}
// Magenta, das nach unten heller wird — gemessener Effekt bei echten Renders
// (RGB-Abstand oben zu unten: 59 bis 97).
function hintergrundBei(y, h) {
  const t = y / h;
  return [Math.round(150 + 55 * t), Math.round(44 + 58 * t), Math.round(72 + 60 * t)];
}

test("weiches Bild mit Lichtverlauf wird trotzdem freigestellt", () => {
  const anteil = deckenderAnteil(freistellen(weichesBild(160, 160)));
  // Die Figur belegt rund 28 Prozent der Fläche. Ohne den Rückfall blieb hier
  // fast nichts übrig.
  assert.ok(anteil > 0.10, "zu wenig übrig geblieben: " + (anteil * 100).toFixed(1) + " %");
  assert.ok(anteil < 0.60, "zu wenig entfernt: " + (anteil * 100).toFixed(1) + " %");
});

test("der flache Fall bleibt unberührt", () => {
  // Harte Kante, einheitlicher Hintergrund: Hier greift das Fluten, und der
  // Rückfall darf gar nicht erst rechnen.
  const flach = baueRgbPng(160, 160, (x, y) => {
    const dx = x - 80, dy = y - 80;
    return dx * dx + dy * dy < 45 * 45 ? [60, 120, 80] : [219, 41, 133];
  });
  const anteil = deckenderAnteil(freistellen(flach));
  assert.ok(anteil > 0.18 && anteil < 0.30, "Kreis sollte rund 25 % belegen, war " + (anteil * 100).toFixed(1) + " %");
});

test("dunkle Bildteile werden nie zum Hintergrund gezählt", () => {
  // Der Stil lebt von dünnen schwarzen Armen und Beinen. Bei sehr dunklen
  // Pixeln ist der Farbton mathematisch instabil (kleine Zahl im Nenner der
  // Normierung) — ohne Schutzregel zerfrass das Verfahren genau sie.
  const mitStrich = baueRgbPng(160, 160, (x, y) => {
    if (x > 76 && x < 84 && y > 40 && y < 120) return [20, 20, 22];  // dünner schwarzer Strich
    return hintergrundBei(y, 160);
  });
  const { width, height, pixel } = dekodierePng(freistellen(mitStrich));
  let strichSichtbar = 0;
  for (let y = 45; y < 115; y++) {
    const i = (y * width + 80) * 4;
    if (pixel[i + 3] > 215) strichSichtbar++;
  }
  assert.ok(strichSichtbar > 60, "der schwarze Strich wurde weggefressen (" + strichSichtbar + " von 70 Zeilen)");
});
