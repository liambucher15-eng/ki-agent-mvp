// Winziger PNG-Kodierer/-Dekodierer für GENAU einen Zweck: Chroma-Key-Freistellen
// von Gemini-Bildern (kein npm-Paket, passt zum Rest des Projekts — reines
// Node-Builtin zlib). Unterstützt nur, was wir wirklich brauchen: 8-Bit
// RGB/RGBA, nicht interlaced. Alles andere wirft einen klaren Fehler.
//
// WARUM ÜBERHAUPT SELBST GEBAUT: Gemini kann keinen echten Alphakanal liefern
// (getestet — bei "transparenter Hintergrund" malt es ein Schachbrettmuster
// als Pixel statt echter Transparenz). Wir lassen die Figur stattdessen auf
// einer festen, in der Natur kaum vorkommenden Farbe zeichnen (Chroma-Key) und
// stanzen diese Farbe hier hart heraus.

const zlib = require("zlib");

const SIGNATUR = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// CRC32 nach PNG-Spezifikation (Standardalgorithmus, keine Bibliothek nötig).
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

function leseChunks(buf) {
  if (!buf.slice(0, 8).equals(SIGNATUR)) throw new Error("Keine gültige PNG-Signatur.");
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const typ = buf.toString("ascii", off + 4, off + 8);
    const daten = buf.slice(off + 8, off + 8 + len);
    chunks.push({ typ, daten });
    off += 12 + len; // Länge + Typ(4) + Daten + CRC(4)
  }
  return chunks;
}

function baueChunk(typ, daten) {
  const laenge = Buffer.alloc(4); laenge.writeUInt32BE(daten.length, 0);
  const typDaten = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typDaten), 0);
  return Buffer.concat([laenge, typDaten, crc]);
}

// Ein PNG-Filter-Byte pro Zeile entfernen (Filter 0-4, siehe PNG-Spezifikation).
function entfiltern(roh, width, height, bpp) {
  const zeilenLaenge = width * bpp;
  const out = Buffer.alloc(height * zeilenLaenge);
  let quelle = 0;
  for (let y = 0; y < height; y++) {
    const filter = roh[quelle]; quelle++;
    const zielStart = y * zeilenLaenge;
    const vorherStart = zielStart - zeilenLaenge;
    for (let x = 0; x < zeilenLaenge; x++) {
      const raw = roh[quelle + x];
      const a = x >= bpp ? out[zielStart + x - bpp] : 0;
      const b = y > 0 ? out[vorherStart + x] : 0;
      const c = y > 0 && x >= bpp ? out[vorherStart + x - bpp] : 0;
      let wert;
      if (filter === 0) wert = raw;
      else if (filter === 1) wert = raw + a;
      else if (filter === 2) wert = raw + b;
      else if (filter === 3) wert = raw + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const praediktor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        wert = raw + praediktor;
      } else throw new Error("Unbekannter PNG-Filtertyp: " + filter);
      out[zielStart + x] = wert & 0xff;
    }
    quelle += zeilenLaenge;
  }
  return out;
}

// PNG (Base64) -> { width, height, pixel: Buffer mit RGBA, 4 Byte/Pixel }.
function dekodierePng(base64) {
  const buf = Buffer.from(base64, "base64");
  const chunks = leseChunks(buf);
  const ihdr = chunks.find((c) => c.typ === "IHDR");
  if (!ihdr) throw new Error("PNG ohne IHDR.");
  const width = ihdr.daten.readUInt32BE(0);
  const height = ihdr.daten.readUInt32BE(4);
  const bitTiefe = ihdr.daten.readUInt8(8);
  const farbTyp = ihdr.daten.readUInt8(9); // 2 = RGB, 6 = RGBA
  const interlace = ihdr.daten.readUInt8(12);
  if (bitTiefe !== 8) throw new Error("Nur 8-Bit-PNGs unterstützt (war: " + bitTiefe + ").");
  if (farbTyp !== 2 && farbTyp !== 6) throw new Error("Nur RGB/RGBA-PNGs unterstützt (Farbtyp war: " + farbTyp + ").");
  if (interlace !== 0) throw new Error("Interlaced PNGs werden nicht unterstützt.");

  const idat = Buffer.concat(chunks.filter((c) => c.typ === "IDAT").map((c) => c.daten));
  const bpp = farbTyp === 6 ? 4 : 3;
  const roh = zlib.inflateSync(idat);
  const rgb = entfiltern(roh, width, height, bpp);

  if (bpp === 4) return { width, height, pixel: rgb }; // schon RGBA
  // RGB -> RGBA (Alpha zunächst überall 255, wird beim Freistellen angepasst).
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    rgba[j] = rgb[i]; rgba[j + 1] = rgb[i + 1]; rgba[j + 2] = rgb[i + 2]; rgba[j + 3] = 255;
  }
  return { width, height, pixel: rgba };
}

// { width, height, pixel: RGBA-Buffer } -> PNG (Base64), immer Farbtyp 6 (RGBA).
function kodierePng({ width, height, pixel }) {
  const zeilenLaenge = width * 4;
  const roh = Buffer.alloc(height * (zeilenLaenge + 1));
  for (let y = 0; y < height; y++) {
    roh[y * (zeilenLaenge + 1)] = 0; // Filter "None" — einfach und korrekt, Optimierung nicht nötig
    pixel.copy(roh, y * (zeilenLaenge + 1) + 1, y * zeilenLaenge, (y + 1) * zeilenLaenge);
  }
  const idatDaten = zlib.deflateSync(roh);

  const ihdrDaten = Buffer.alloc(13);
  ihdrDaten.writeUInt32BE(width, 0);
  ihdrDaten.writeUInt32BE(height, 4);
  ihdrDaten.writeUInt8(8, 8);   // Bit-Tiefe
  ihdrDaten.writeUInt8(6, 9);   // Farbtyp: RGBA
  ihdrDaten.writeUInt8(0, 10); ihdrDaten.writeUInt8(0, 11); ihdrDaten.writeUInt8(0, 12);

  const png = Buffer.concat([
    SIGNATUR,
    baueChunk("IHDR", ihdrDaten),
    baueChunk("IDAT", idatDaten),
    baueChunk("IEND", Buffer.alloc(0)),
  ]);
  return png.toString("base64");
}

module.exports = { dekodierePng, kodierePng };
