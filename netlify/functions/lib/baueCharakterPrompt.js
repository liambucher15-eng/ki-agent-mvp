// Baut die Bild-Prompts für die 4 Charakter-Zustände aus der Firmen-Eingabe.
// EINE Stilklammer sorgt dafür, dass alle 4 Ausdrücke dieselbe Figur zeigen.
// Genutzt von der echten Generierung (charakter-background.js, Milestone 6):
//   prompts.idle  -> erzeugt das Basisbild
//   edits.<z>     -> wandelt das Basisbild in die anderen Ausdrücke um
//                    (Edit statt Neu-Generierung = die Figur bleibt identisch)

const AUSDRUECKE = {
  idle: "neutraler, freundlicher Ruheausdruck, leichtes Lächeln, schaut nach vorne",
  denken: "nachdenklicher Ausdruck, Blick nach oben, Hand am Kinn",
  sprechen: "offener Mund beim Sprechen, lebhaft und einladend",
  verlegen: "verlegen, leicht errötet, schaut zur Seite, entschuldigendes Lächeln",
};

// Chroma-Key-Hintergrund (muss zu lib/freistellen.js passen): Gemini liefert
// keinen echten Alphakanal, egal was man im Prompt verlangt (getestet — bei
// "transparent" malt es ein Schachbrettmuster als Pixel). Stattdessen zeichnet
// das Modell auf einer möglichst reinen, gleichmässigen Magenta-Fläche, die wir
// nach der Generierung freistellen. Der genaue Farbton driftet vom Prompt ab
// (gemessen z.B. (219,41,133) statt (255,0,255)), darum liest freistellen()
// die tatsächliche Farbe aus dem Bild selbst statt sie fest anzunehmen —
// wichtig ist hier nur, dass die Fläche EINHEITLICH ist, nicht der exakte Ton.
const HINTERGRUND_ANWEISUNG =
  "Hintergrund: eine EINZIGE, VOLLSTÄNDIG FLACHE Fläche in kräftigem Magenta/Pink, " +
  "absolut gleichmässig, keine Farbverläufe, kein Schatten, keine Textur, kein Muster. " +
  "Die Figur selbst darf kein Magenta/Pink enthalten.";

// Die beiden Stilrichtungen, die das Freistellen tragen.
//
// "flach" war lange die einzige, und zwar aus einem technischen Grund: Das
// Freistellen flutete vom Bildrand her und brauchte eine harte Kontur als
// Barriere (lib/freistellen.js). Seit dort ein zweites Verfahren daneben
// steht — Abstand im Farbton statt Fluten — kommt auch ein 3D-Render durch.
//
// Was beim 3D-Stil im Prompt stehen MUSS, gemessen und nicht geraten:
//   "kein Schlagschatten, keine Bodenflaeche": Ein Render setzt die Figur
//   sonst auf einen Boden. Der Schatten macht den Hintergrund uneinheitlich.
//   "Licht nur auf der Figur": Studiolicht faellt sonst auf den Hintergrund
//   und erzeugt dort einen Verlauf (gemessen: RGB-Abstand 59 bis 97 zwischen
//   oben und unten).
// Beides bekommt man nicht vollstaendig weg, aber deutlich reduziert — den
// Rest faengt das Freistellen ab.
const STILE = {
  flach: {
    label: "Gezeichnet",
    hinweis: "Flache Illustration mit klaren Linien",
    text: "Flacher, stilisierter Cartoon-Stil, klare Konturen,",
  },
  "3d": {
    label: "Plastisch (3D)",
    hinweis: "Weiches 3D wie eine kleine Knetfigur",
    text: "Weiches 3D-Render im Claymorphism-Stil, matte Oberflaeche, abgerundete Formen, " +
      "wie eine kleine Figur aus Knete. Das Licht trifft NUR die Figur: kein Schlagschatten, " +
      "keine Bodenflaeche, kein Lichtabfall auf dem Hintergrund. Die Figur schwebt frei.",
  },
};

// Unbekannter Wert -> flach. Das ist der Stil, der seit je funktioniert; ein
// Tippfehler darf niemanden in den neueren Weg draengen.
function stilFuer(wunsch) {
  return STILE[wunsch] ? wunsch : "flach";
}

function baueCharakterPrompt({ beschreibung, farbe, stilWahl } = {}) {
  const gewaehlt = stilFuer(stilWahl);
  const stil =
    `Ein einfaches, freundliches Maskottchen. ${beschreibung || "rundes, sympathisches Wesen"}. ` +
    `${STILE[gewaehlt].text} ${HINTERGRUND_ANWEISUNG} ` +
    `Hauptfarbe der Figur ${farbe || "#3f7d5a"}. Immer dieselbe Figur, gleiche Proportionen, zentriert.`;

  const prompts = {};
  const edits = {};
  for (const [zustand, ausdruck] of Object.entries(AUSDRUECKE)) {
    prompts[zustand] = `${stil} Ausdruck: ${ausdruck}.`;
    edits[zustand] =
      `Exakt dieselbe Figur, derselbe Stil, dieselben Farben und Proportionen — ` +
      `ändere NUR den Gesichtsausdruck/die Pose zu: ${ausdruck}. ` +
      `${HINTERGRUND_ANWEISUNG}`;
  }
  // Klappmaul-Frame (Milestone 12): Mund-offen-Variante des Sprechen-Bilds.
  // Wird beim Sprechen mit dem (geschlossenen) Sprechen-Bild abgewechselt, damit
  // sich der Mund des Maskottchens wirklich bewegt (nicht nur wippt).
  const mundOffenEdit =
    `Exakt dieselbe Figur, derselbe Stil, dieselben Farben, dieselbe Pose — ` +
    `öffne NUR den Mund weit, als würde die Figur gerade einen Vokal sprechen. ` +
    `Sonst absolut identisch. ${HINTERGRUND_ANWEISUNG}`;
  return { stil, prompts, edits, mundOffenEdit, stilWahl: gewaehlt };
}

// Vier bewusst UNTERSCHIEDLICHE Stil-Richtungen für die Vorschau (Welle 1, §4).
// Der Kunde wählt eine, erst dann werden daraus die 5 Zustände erzeugt — so gibt
// es mehr Auswahl und weniger Kosten (nicht 5 Bilder pro verworfener Richtung).
const RICHTUNGEN = [
  { key: "rund",    label: "Freundlich & rund",       zusatz: "sehr freundlich, runde weiche Formen, grosse Kulleraugen, einladend und niedlich" },
  { key: "elegant", label: "Elegant & hochwertig",    zusatz: "elegant, hochwertig, edel und reduziert, feine Linien, dezente Farben" },
  { key: "mutig",   label: "Verspielt & mutig",       zusatz: "verspielt und mutig, kräftige satte Farben, dynamische Pose, ausdrucksstark" },
  { key: "modern",  label: "Zurückhaltend & modern",  zusatz: "zurückhaltend und modern, minimalistisch, klare geometrische Formen, ruhig" },
];

function baueRichtungen({ beschreibung, farbe, stilWahl } = {}) {
  const { stil } = baueCharakterPrompt({ beschreibung, farbe, stilWahl });
  return RICHTUNGEN.map((r) => ({
    key: r.key,
    label: r.label,
    prompt: `${stil} Stil-Richtung: ${r.zusatz}. Neutraler, freundlicher Ruheausdruck, schaut nach vorne.`,
  }));
}

module.exports = { baueCharakterPrompt, baueRichtungen, AUSDRUECKE, RICHTUNGEN, STILE, stilFuer, HINTERGRUND_ANWEISUNG };
