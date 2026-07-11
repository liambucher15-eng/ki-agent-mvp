// Unit-Tests für den System-Prompt-Bau — die wichtigste Funktion des Produkts:
// aus den Firmen-Daten (DB/Seed) wird die Anweisung an Claude.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { baueSystemPrompt, baueWissensText } = require("../netlify/functions/lib/baueSystemPrompt");

const firma = {
  name: "Restaurant Salbei",
  persona: { name: "Salbei-Concierge", rolle: "der Gastgeber", ton: "warm", sprache: "Deutsch" },
  fakten: { "Öffnungszeiten": "Di–Sa", Adresse: "Musterstrasse 1" },
  faq: [{ frage: "Vegan?", antwort: "Ja, täglich." }],
  wissen: "Angebot: saisonale Küche",
};

test("baut Persona, Fakten, FAQ und Wissen ein", () => {
  const p = baueSystemPrompt(firma);
  assert.match(p, /Salbei-Concierge/);
  assert.match(p, /der Gastgeber/);
  assert.match(p, /Ton: warm/);
  assert.match(p, /- Öffnungszeiten: Di–Sa/);
  assert.match(p, /- Adresse: Musterstrasse 1/);
  assert.match(p, /F: Vegan\?\nA: Ja, täglich\./);
  assert.match(p, /WEITERE INFOS:\nAngebot: saisonale Küche/);
});

test("enthält die Anti-Halluzinations-Regel", () => {
  const p = baueSystemPrompt(firma);
  assert.match(p, /Erfinde nichts/);
  assert.match(p, /ANTWORTE nur aus den Informationen unten/);
});

test("leere Firma: robust, mit Platzhalter statt Absturz", () => {
  const p = baueSystemPrompt({ name: "X" });
  assert.match(p, /\(keine Stichpunkte\)/);
  assert.doesNotMatch(p, /WEITERE INFOS/);
  assert.doesNotMatch(p, /HÄUFIGE FRAGEN/);
});

test("Standard-Sprache ist Deutsch", () => {
  const p = baueSystemPrompt({ name: "X", persona: { name: "A", rolle: "B", ton: "C" } });
  assert.match(p, /Sprich Deutsch/);
});

test("FAQ ohne Einträge erzeugt keinen FAQ-Block", () => {
  const p = baueSystemPrompt({ ...firma, faq: [] });
  assert.doesNotMatch(p, /HÄUFIGE FRAGEN/);
});

// --- wissensquellen[] (Milestone 3) ---
const quellen = [
  { id: "scan", typ: "scan", titel: "Webseiten-Scan", stand: "2026-07-05", text: "Wir sind ein Restaurant." },
  { id: "d1", typ: "dokument", titel: "menu.pdf", stand: "2026-07-05", text: "Pasta 18 CHF" },
];

test("wissensquellen: jede Quelle mit Titel und Stand im Prompt", () => {
  const p = baueSystemPrompt({ ...firma, wissen: undefined, wissensquellen: quellen });
  assert.match(p, /── Webseiten-Scan \(Stand: 2026-07-05\) ──\nWir sind ein Restaurant\./);
  assert.match(p, /── menu\.pdf \(Stand: 2026-07-05\) ──\nPasta 18 CHF/);
});

test("wissensquellen: gelöschte Quelle taucht NICHT mehr auf", () => {
  const ohneDoc = quellen.filter((q) => q.id !== "d1");
  const p = baueSystemPrompt({ ...firma, wissensquellen: ohneDoc });
  assert.doesNotMatch(p, /menu\.pdf/);
  assert.doesNotMatch(p, /Pasta 18 CHF/);
  assert.match(p, /Webseiten-Scan/);
});

test("wissensquellen: haben Vorrang vor altem wissen-String", () => {
  const p = baueSystemPrompt({ ...firma, wissen: "ALTER STRING", wissensquellen: quellen });
  assert.doesNotMatch(p, /ALTER STRING/);
});

test("wissensquellen: leere/kaputte Einträge werden übersprungen", () => {
  const t = baueWissensText({ wissensquellen: [null, { titel: "leer", text: "  " }, { text: "ohne Titel" }] });
  assert.equal(t, "── Quelle ──\nohne Titel");
});

test("Fallback: ohne wissensquellen zählt weiter der wissen-String (Seeds)", () => {
  const p = baueSystemPrompt({ ...firma, wissensquellen: [] });
  assert.match(p, /WEITERE INFOS:\nAngebot: saisonale Küche/);
});

// Welle 1, §3: Anrede (Du/Sie) fliesst in den Prompt
test("Anrede 'sie' erzeugt Sie-Regel, Standard ist Du", () => {
  const mitSie = baueSystemPrompt({ name: "X", persona: { name: "A", rolle: "Gastgeber", ansprache: "sie" } });
  assert.match(mitSie, /mit .?Sie.? an/i);
  const standard = baueSystemPrompt({ name: "X", persona: { name: "A", rolle: "Gastgeber" } });
  assert.match(standard, /mit .?Du.? an/i);
});
