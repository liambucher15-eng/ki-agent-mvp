// Unit-Tests für den System-Prompt-Bau — die wichtigste Funktion des Produkts:
// aus den Firmen-Daten (DB/Seed) wird die Anweisung an Claude.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { baueSystemPrompt } = require("../netlify/functions/lib/baueSystemPrompt");

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
