// Ordnet charaktere-galerie-prompts.md nach den acht Bereichen der Startseite.
//
// Warum: Die Liste war eine Aufzählung ohne Prinzip und hatte genau dort eine
// Lücke, wo der grösste KMU-Block sitzt — Handwerk. Zwei Fahrzeug-Werkstätten
// (Velo, Auto), aber kein Maler, kein Elektriker, kein Sanitär. Ausserdem
// fehlten Fahrschule und Musikschule.
//
// Die Bereiche stammen aus start.html (#branchen) und sind nach dem ANLIEGEN
// geschnitten, nicht nach dem Gewerbe: Zahnarzt und Coiffeur sind verschiedene
// Welten, aber der Agent tut dasselbe — Termin.
//
// Einmal ausführen: node scripts/galerie-neu-ordnen.js

const fs = require("fs");
const path = require("path");
const DATEI = path.join(__dirname, "..", "charaktere-galerie-prompts.md");

const text = fs.readFileSync(DATEI, "utf8");

// Kopf = alles bis zum ersten nummerierten Block.
const ersterBlock = text.search(/^## 1 — /m);
if (ersterBlock < 0) { console.error("Kein Block '## 1 — ' gefunden."); process.exit(1); }
const kopf = text.slice(0, ersterBlock);

// Bestehende Blöcke einsammeln, nach Namen greifbar machen.
const blockTexte = text.slice(ersterBlock).split(/^(?=## \d+ — )/m).filter((b) => b.trim());
const vorhanden = new Map();
for (const b of blockTexte) {
  const name = b.match(/^## \d+ — ([^·\n]+)/)[1].trim();
  // Überschrift und Nummer fallen weg, den Rest übernehmen wir unverändert.
  vorhanden.set(name, b.replace(/^## \d+ — [^\n]*\n/, ""));
}
console.log("gefunden: " + vorhanden.size + " Figuren");

// Ein neuer Eintrag: Kommentarsatz + zwei Prompts nach derselben Formel.
function neu(gegenstand, utensil, farbe, satz, ton) {
  const dreiD =
    "A cute 3D icon mascot of " + gegenstand + ", two simple round black dot eyes and a small curved smile, " +
    (ton === "Verspielt"
      ? "thin black wire-line arms and legs in a light walking pose, holding " + utensil + ". "
      : "thin black wire-line arms only, no visible legs, calm upright pose, holding " + utensil + ". ") +
    "Matte soft clay-like plastic finish, " + farbe + ". " +
    "Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. " +
    "Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.";
  const flach =
    "A charming 2D vector character illustration of " + gegenstand + ", clean bold dark-outlined linework with soft " +
    "two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side " +
    "— no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line " +
    "above each, rosy cheek blushes, and a warm curved smile, " +
    (ton === "Verspielt"
      ? "thin dark-outlined arms and legs in a light walking pose, holding " + utensil + ", "
      : "thin dark-outlined arms only, no visible legs, calm upright pose, holding " + utensil + ", ") +
    "rendered with the same clean linework and a touch of surface texture. Colour palette: " + farbe +
    ", with one soft shadow tone for depth. " +
    "Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.";
  return satz + "\n\n**3D-Icon**\n```\n" + dreiD + "\n```\n**Flach-Vektor**\n```\n" + flach + "\n```\n\n";
}

// Die acht Bereiche, je zwei bis drei Figuren. Wer nicht in der Liste steht,
// fällt raus — nachlesbar am Ende dieser Datei.
const BEREICHE = [
  ["Restaurants", ["Café", "Bäckerei", "Restaurant"]],
  ["Arztpraxen", ["Zahnarztpraxis", "Physiotherapie", "Tierarztpraxis"]],
  ["Coiffeure", ["Coiffeursalon", "Kosmetikstudio"]],
  ["Handwerker", ["Malerbetrieb", "Elektriker", "Autogarage"]],
  ["Treuhänder", ["Treuhandbüro", "Anwaltskanzlei", "Architekturbüro"]],
  ["Läden", ["Blumenladen", "Buchhandlung"]],
  ["Immobilien", ["Immobilienbüro", "Umzugsfirma"]],
  ["Studios & Schulen", ["Fitnessstudio", "Fahrschule"]],
];

// Die sechs neuen Figuren. Gegenstand, Utensil und Farbe folgen der Formel aus
// dem Kopf der Datei: Branchen-Gegenstand + Punktaugen + Draht-Gliedmassen +
// kleines Utensil.
const NEUE = {
  "Kosmetikstudio": neu(
    "a rounded cosmetic cream jar with a lid",
    "a tiny makeup brush",
    "soft blush-pink jar body with a warm cream lid",
    "Die Coiffeur-Ecke braucht eine zweite Figur, sonst steht der Salon allein\nfür Kosmetik, Massage und Nagelstudio mit.",
    "Verspielt"),
  "Malerbetrieb": neu(
    "a paint bucket with a slight drip of colour running down one side",
    "a tiny paint roller",
    "cool slate-blue bucket with a bright white paint drip",
    "Handwerk war die grösste Lücke der alten Liste: zwei Fahrzeug-Werkstätten,\naber kein einziger Bau-Beruf.",
    "Verspielt"),
  "Elektriker": neu(
    "a chunky wall power socket with two round holes forming a face plate",
    "a tiny screwdriver",
    "warm off-white socket body with a soft grey frame",
    "Zusammen mit Maler und Garage decken drei verschiedene Handwerke die Kachel\nab, statt zweimal dasselbe zu zeigen.",
    "Verspielt"),
  "Architekturbüro": neu(
    "a rolled-up architectural blueprint tied with a thin band",
    "a tiny folding ruler",
    "muted teal-blue rolled paper with a warm sand-coloured band",
    "Ergänzt Treuhand und Anwalt um den planenden Beruf. Zurückhaltender Ton wie\ndie beiden anderen in dieser Kachel.",
    "Zurückhaltend"),
  "Umzugsfirma": neu(
    "a sturdy cardboard moving box with the flaps slightly open",
    "a tiny roll of packing tape",
    "warm kraft-brown cardboard with a soft beige tape strip",
    "Immobilien ist mehr als Makeln: Umzug und Reinigung gehören zur selben\nFrage, wer wann in die Wohnung kommt.",
    "Zurückhaltend"),
  "Fahrschule": neu(
    "a friendly car steering wheel seen from the front",
    "a tiny set of car keys",
    "deep navy-blue wheel rim with a warm grey centre hub",
    "Fitness stand allein für alles, was Anmeldung und Kursplan braucht. Die\nFahrschule zeigt, dass damit auch Schulen gemeint sind.",
    "Verspielt"),
};

// Ton je Figur, damit die Überschrift stimmt.
const TON = {
  "Café": "Verspielt", "Bäckerei": "Verspielt", "Restaurant": "Verspielt",
  "Zahnarztpraxis": "Verspielt", "Physiotherapie": "Zurückhaltend", "Tierarztpraxis": "Verspielt",
  "Coiffeursalon": "Verspielt", "Kosmetikstudio": "Verspielt",
  "Malerbetrieb": "Verspielt", "Elektriker": "Verspielt", "Autogarage": "Verspielt",
  "Treuhandbüro": "Zurückhaltend", "Anwaltskanzlei": "Zurückhaltend", "Architekturbüro": "Zurückhaltend",
  "Blumenladen": "Verspielt", "Buchhandlung": "Verspielt",
  "Immobilienbüro": "Zurückhaltend", "Umzugsfirma": "Zurückhaltend",
  "Fitnessstudio": "Verspielt", "Fahrschule": "Verspielt",
};

let n = 0;
let raus = [...vorhanden.keys()];
const teile = [];
for (const [bereich, figuren] of BEREICHE) {
  teile.push("---\n\n# " + bereich + "\n\n");
  for (const figur of figuren) {
    n++;
    const koerper = NEUE[figur] || vorhanden.get(figur);
    if (!koerper) { console.error("FEHLT: " + figur); process.exit(1); }
    if (!NEUE[figur]) raus = raus.filter((x) => x !== figur);
    teile.push("## " + n + " — " + figur + " · " + TON[figur] + "\n" + koerper);
  }
}

const abschluss =
  "---\n\n" +
  "## Nicht mehr in der Liste\n\n" +
  "Aus der ersten Fassung gestrichen, weil sie einen Bereich doppelt besetzten\n" +
  "oder in keine der acht Kacheln fallen: " + raus.join(", ") + ".\n\n" +
  "Die Prompts dazu stehen in der Git-Historie, falls einer davon zurücksoll.\n";

fs.writeFileSync(DATEI, kopf + teile.join("") + abschluss);
console.log("neu geordnet: " + n + " Figuren in " + BEREICHE.length + " Bereichen");
console.log("gestrichen: " + raus.join(", "));
