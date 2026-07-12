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

function baueCharakterPrompt({ beschreibung, farbe } = {}) {
  const stil =
    `Ein einfaches, freundliches Maskottchen. ${beschreibung || "rundes, sympathisches Wesen"}. ` +
    `Flacher, stilisierter Cartoon-Stil, klare Konturen, einfarbiger heller Hintergrund, ` +
    `Hauptfarbe ${farbe || "#3f7d5a"}. Immer dieselbe Figur, gleiche Proportionen, zentriert.`;

  const prompts = {};
  const edits = {};
  for (const [zustand, ausdruck] of Object.entries(AUSDRUECKE)) {
    prompts[zustand] = `${stil} Ausdruck: ${ausdruck}.`;
    edits[zustand] =
      `Exakt dieselbe Figur, derselbe Stil, dieselben Farben und Proportionen — ` +
      `ändere NUR den Gesichtsausdruck/die Pose zu: ${ausdruck}. ` +
      `Hintergrund unverändert einfarbig hell.`;
  }
  // Klappmaul-Frame (Milestone 12): Mund-offen-Variante des Sprechen-Bilds.
  // Wird beim Sprechen mit dem (geschlossenen) Sprechen-Bild abgewechselt, damit
  // sich der Mund des Maskottchens wirklich bewegt (nicht nur wippt).
  const mundOffenEdit =
    `Exakt dieselbe Figur, derselbe Stil, dieselben Farben, dieselbe Pose — ` +
    `öffne NUR den Mund weit, als würde die Figur gerade einen Vokal sprechen. ` +
    `Sonst absolut identisch, Hintergrund unverändert einfarbig hell.`;
  return { stil, prompts, edits, mundOffenEdit };
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

function baueRichtungen({ beschreibung, farbe } = {}) {
  const { stil } = baueCharakterPrompt({ beschreibung, farbe });
  return RICHTUNGEN.map((r) => ({
    key: r.key,
    label: r.label,
    prompt: `${stil} Stil-Richtung: ${r.zusatz}. Neutraler, freundlicher Ruheausdruck, schaut nach vorne.`,
  }));
}

module.exports = { baueCharakterPrompt, baueRichtungen, AUSDRUECKE, RICHTUNGEN };
