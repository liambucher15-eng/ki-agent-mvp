// Probe: Funktioniert der 3D-Render-Stil mit den fünf Zuständen?
//
// Hintergrund: baueCharakterPrompt.js schreibt "Flacher, stilisierter
// Cartoon-Stil" fest. Liams Maskottchen sind aber 3D-Renders (Claymorphism,
// weisser Hintergrund, dünne schwarze Gliedmassen). Bevor irgendetwas im
// Produktionscode geändert wird, soll gemessen werden, ob dieser Stil die
// beiden Anforderungen überhaupt erfüllt:
//
//   1) KONSISTENZ — bleibt es über vier Edits hinweg dieselbe Figur?
//   2) FREISTELLEN — ein 3D-Render bringt Schlagschatten und Reflexionen mit.
//      lib/freistellen.js sucht eine einheitliche Fläche am Rand. Wirft die
//      Figur einen Schatten auf den Hintergrund, ist die Fläche nicht mehr
//      einheitlich, und der Schatten bliebe als grauer Fleck stehen.
//
// Läuft absichtlich als eigenständiges Skript und nicht als Test: Es kostet
// echte Gemini-Aufrufe (fünf Bilder, rund CHF 0.30).
//
// Aufruf:  node scripts/probe-3d-charakter.js

const fs = require("fs");
const path = require("path");

for (const zeile of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const i = zeile.indexOf("=");
  if (i > 0 && !zeile.startsWith("#")) process.env[zeile.slice(0, i)] = zeile.slice(i + 1).trim();
}

const { generiereBild, bearbeiteBild, konfiguriert } = require("../netlify/functions/lib/gemini");
const { freistellen } = require("../netlify/functions/lib/freistellen");
const { dekodierePng } = require("../netlify/functions/lib/pngAlpha");

const AUSGABE = path.join(__dirname, "..", ".probe-3d");

// Wortgleich aus baueCharakterPrompt.js — sonst misst die Probe etwas anderes
// als das, was die App tut.
const HINTERGRUND =
  "Hintergrund: eine EINZIGE, VOLLSTÄNDIG FLACHE Fläche in kräftigem Magenta/Pink, " +
  "absolut gleichmässig, keine Farbverläufe, kein Schatten, keine Textur, kein Muster. " +
  "Die Figur selbst darf kein Magenta/Pink enthalten.";

const AUSDRUECKE = {
  denken: "nachdenklicher Ausdruck, Blick nach oben, Hand am Kinn",
  sprechen: "offener Mund beim Sprechen, lebhaft und einladend",
  verlegen: "verlegen, leicht errötet, schaut zur Seite, entschuldigendes Lächeln",
};

// Der einzige Unterschied zur App: die Stilzeile.
//
// "kein Schlagschatten auf dem Hintergrund" ist der kritische Zusatz. Ein
// 3D-Render setzt die Figur sonst auf eine Bodenfläche mit Schatten — genau
// das, was das Freistellen unmöglich macht.
const STIL_3D =
  "Ein einfaches, freundliches Maskottchen: eine runde Brotlaib-Figur mit " +
  "freundlichem Gesicht und dünnen schwarzen Armen und Beinen. " +
  "Weiches 3D-Render im Claymorphism-Stil, matte Oberfläche, sanftes Studiolicht, " +
  "abgerundete Formen, wie eine kleine Figur aus Knete. " +
  "KEIN Schlagschatten auf dem Hintergrund, die Figur schwebt frei. " +
  HINTERGRUND +
  " Immer dieselbe Figur, gleiche Proportionen, zentriert.";

// gemini.js WIRFT nicht, sondern gibt { ok:false, fehler } zurueck. Wer nur
// try/catch nutzt, haelt einen Fehlschlag faelschlich fuer Erfolg und stolpert
// erst spaeter ueber ein undefined ' + dash + ' genau das ist hier passiert.
async function mitWiederholung(fn, versuche = 3) {
  let letzter;
  for (let n = 0; n < versuche; n++) {
    try {
      const r = await fn();
      if (r && r.ok !== false && r.bildBase64) return r;
      letzter = new Error(r && r.fehler ? r.fehler : "kein Bild geliefert");
    } catch (e) { letzter = e; }
    await new Promise((r) => setTimeout(r, 1500 * (n + 1)));
  }
  throw letzter;
}

// Rohbild sofort auf die Platte: Ein Fehler beim Auswerten soll nicht die
// bereits bezahlte Generierung wegwerfen.
function merke(zustand, base64) {
  fs.mkdirSync(AUSGABE, { recursive: true });
  fs.writeFileSync(path.join(AUSGABE, "roh-" + zustand + ".png"), Buffer.from(base64, "base64"));
  return base64;
}

// Wie sauber ist der Hintergrund? Zählt, wie viele Randpixel NACH dem
// Freistellen noch undurchsichtig sind. Ein Schlagschatten zeigt sich hier.
function randBefund(pngBase64) {
  // Eigener Dekoder statt npm-Paket: Das Projekt ist bewusst dependency-frei
  // (package.json hat keine einzige Abhaengigkeit).
  const { width, height, pixel: data } = dekodierePng(pngBase64);
  let rand = 0, undurchsichtig = 0;
  const pruefe = (x, y) => {
    const i = (y * width + x) * 4;
    rand++;
    if (data[i + 3] > 40) undurchsichtig++;
  };
  for (let x = 0; x < width; x++) { pruefe(x, 0); pruefe(x, height - 1); }
  for (let y = 0; y < height; y++) { pruefe(0, y); pruefe(width - 1, y); }
  return { rand, undurchsichtig, anteil: (undurchsichtig / rand * 100).toFixed(1) + " %" };
}

(async () => {
  if (!konfiguriert()) { console.error("GEMINI_API_KEY fehlt."); process.exit(1); }
  fs.mkdirSync(AUSGABE, { recursive: true });
  console.log("Probe: 3D-Stil mit fünf Zuständen\n");

  console.log("1/5  Basisbild (idle) …");
  const basis = await mitWiederholung(() => generiereBild({
    prompt: STIL_3D + " Ausdruck: neutraler, freundlicher Ruheausdruck, leichtes Lächeln, schaut nach vorne.",
  }));
  const bilder = { idle: merke("idle", basis.bildBase64) };

  let n = 2;
  for (const [zustand, ausdruck] of Object.entries(AUSDRUECKE)) {
    console.log(n + "/5  " + zustand + " (Edit aus dem Basisbild) …");
    const r = await mitWiederholung(() => bearbeiteBild({
      bild: basis.bildBase64,
      mimeType: basis.mimeType,
      anweisung: "Exakt dieselbe Figur, derselbe Stil, dieselben Farben und Proportionen — " +
        "ändere NUR den Gesichtsausdruck/die Pose zu: " + ausdruck + ". " + HINTERGRUND,
    }));
    bilder[zustand] = merke(zustand, r.bildBase64);
    n++;
  }

  console.log("5/5  Mund offen (Klappmaul) …");
  const offen = await mitWiederholung(() => bearbeiteBild({
    bild: bilder.sprechen, mimeType: "image/png",
    anweisung: "Exakt dieselbe Figur, derselbe Stil, dieselben Farben, dieselbe Pose — " +
      "öffne NUR den Mund weit, als würde die Figur gerade einen Vokal sprechen. " +
      "Sonst absolut identisch. " + HINTERGRUND,
  }));
  bilder.sprechen_offen = merke("sprechen_offen", offen.bildBase64);

  console.log("\nFreistellen und messen:\n");
  console.log("Zustand          roh KB   frei KB   Rand noch sichtbar");
  console.log("-".repeat(60));
  for (const [zustand, roh] of Object.entries(bilder)) {
    const frei = freistellen(roh);
    fs.writeFileSync(path.join(AUSGABE, zustand + ".png"), Buffer.from(frei, "base64"));
    const b = randBefund(frei);
    console.log(zustand.padEnd(16) +
      String(Math.round(roh.length * 0.75 / 1024)).padStart(6) +
      String(Math.round(frei.length * 0.75 / 1024)).padStart(10) +
      "   " + b.anteil.padStart(7) +
      (parseFloat(b.anteil) > 3 ? "   <- Rest am Rand (Schatten?)" : "   sauber"));
  }
  console.log("\nBilder liegen in " + AUSGABE);
})();
