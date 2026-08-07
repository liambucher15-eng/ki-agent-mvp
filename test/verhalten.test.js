// Tests für die Verhaltensdeutung — WANN braucht ein Besucher Hilfe?
// Reine Funktionen: fertige Zahlen rein, Deutung raus. Kein DOM, keine Uhr.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const V = require("../netlify/functions/lib/verhalten");

// ── Normalisierung ──────────────────────────────────────────────────────────

test("normalisiere: unsinnige Werte werden auf plausible Grenzen gezogen", () => {
  // Die Zahlen kommen aus dem Browser einer fremden Seite — darauf ist kein Verlass.
  const s = V.normalisiere({
    verweildauer: -50, scrolltiefe: 999, leerlauf: "abc",
    seitenInSitzung: 0, produkteGesehen: -3, wiederkehr: 1e9,
  });
  assert.equal(s.verweildauer, 0);
  assert.equal(s.scrolltiefe, 100);
  assert.equal(s.leerlauf, 0);
  assert.equal(s.seitenInSitzung, 1);
  assert.equal(s.produkteGesehen, 0);
  assert.equal(s.wiederkehr, 50);
});

test("normalisiere: fehlende Eingabe ergibt neutrale Ausgangswerte", () => {
  const s = V.normalisiere(null);
  assert.equal(s.verweildauer, 0);
  assert.equal(s.seitenInSitzung, 1);
  assert.equal(s.exitAbsicht, false);
});

test("normalisiere: exitAbsicht wird immer zu einem echten Wahrheitswert", () => {
  assert.equal(V.normalisiere({ exitAbsicht: "ja" }).exitAbsicht, true);
  assert.equal(V.normalisiere({ exitAbsicht: 0 }).exitAbsicht, false);
});

// ── Phasen ──────────────────────────────────────────────────────────────────

test("phaseAus: frisch angekommen", () => {
  const s = V.normalisiere({ verweildauer: 5, scrolltiefe: 0 });
  assert.equal(V.phaseAus(s, "produkt"), "angekommen");
});

test("phaseAus: aufmerksam lesen ist 'vertieft'", () => {
  const s = V.normalisiere({ verweildauer: 60, scrolltiefe: 70 });
  assert.equal(V.phaseAus(s, "produkt"), "vertieft");
});

test("phaseAus: lange da und alles gelesen, aber nichts passiert -> 'zoegert'", () => {
  const s = V.normalisiere({ verweildauer: 150, scrolltiefe: 80 });
  assert.equal(V.phaseAus(s, "produkt"), "zoegert");
});

test("phaseAus: zurück zu einem schon gesehenen Produkt -> 'vergleicht'", () => {
  const s = V.normalisiere({ verweildauer: 30, produkteGesehen: 3, wiederkehr: 1 });
  assert.equal(V.phaseAus(s, "produkt"), "vergleicht");
});

test("phaseAus: schnell durch viele Seiten -> 'sucht'", () => {
  const s = V.normalisiere({ verweildauer: 8, seitenInSitzung: 6 });
  assert.equal(V.phaseAus(s, "kategorie"), "sucht");
});

test("phaseAus: im Warenkorb/an der Kasse ist die Phase 'im_kauf'", () => {
  const s = V.normalisiere({ verweildauer: 20, leerlauf: 2 });
  assert.equal(V.phaseAus(s, "warenkorb"), "im_kauf");
  assert.equal(V.phaseAus(s, "kasse"), "im_kauf");
});

test("phaseAus: an der Kasse nichts mehr tun -> 'steckt_fest'", () => {
  const s = V.normalisiere({ verweildauer: 90, leerlauf: 40 });
  assert.equal(V.phaseAus(s, "kasse"), "steckt_fest");
});

test("phaseAus: Exit-Absicht schlägt alles andere", () => {
  const s = V.normalisiere({ verweildauer: 200, scrolltiefe: 90, exitAbsicht: true });
  assert.equal(V.phaseAus(s, "produkt"), "abbruchgefahr");
});

test("phaseAus: Exit-Absicht an der Kasse zählt sofort, auch ganz früh", () => {
  // Dort ist Weggehen am teuersten — da darf nicht erst gewartet werden.
  const s = V.normalisiere({ verweildauer: 3, exitAbsicht: true });
  assert.equal(V.phaseAus(s, "kasse"), "abbruchgefahr");
});

test("phaseAus: Exit-Absicht direkt nach dem Ankommen wird ignoriert", () => {
  // Wer nach zwei Sekunden die Maus hochbewegt, will meist nur einen Tab wechseln.
  const s = V.normalisiere({ verweildauer: 2, exitAbsicht: true });
  assert.notEqual(V.phaseAus(s, "produkt"), "abbruchgefahr");
});

// ── Dringlichkeit ───────────────────────────────────────────────────────────

test("dringlichkeit: laufender Kauf wird NIE gestört", () => {
  const b = V.beurteile({ verweildauer: 30, leerlauf: 3 }, "kasse");
  assert.equal(b.phase, "im_kauf");
  assert.equal(b.dringlichkeit, 0);
});

test("dringlichkeit: frisch angekommen wird nicht angesprungen", () => {
  assert.equal(V.beurteile({ verweildauer: 3 }, "produkt").dringlichkeit, 0);
  assert.equal(V.beurteile({ verweildauer: 20 }, "produkt").dringlichkeit, 0); // stoebert
});

test("dringlichkeit: Abbruch und Feststecken haben Vorrang vor allem", () => {
  assert.equal(V.beurteile({ verweildauer: 60, exitAbsicht: true }, "produkt").dringlichkeit, 3);
  assert.equal(V.beurteile({ verweildauer: 90, leerlauf: 40 }, "kasse").dringlichkeit, 3);
});

test("dringlichkeit: aufmerksames Lesen ist nur schwach dringlich", () => {
  assert.equal(V.beurteile({ verweildauer: 60, scrolltiefe: 70 }, "produkt").dringlichkeit, 1);
});

test("dringlichkeit: Zögern und Vergleichen liegen dazwischen", () => {
  assert.equal(V.beurteile({ verweildauer: 150, scrolltiefe: 80 }, "produkt").dringlichkeit, 2);
  assert.equal(V.beurteile({ produkteGesehen: 3, wiederkehr: 1 }, "produkt").dringlichkeit, 2);
});

test("beurteile: liefert immer Signale, Phase und Dringlichkeit", () => {
  const b = V.beurteile(null, "info");
  assert.equal(typeof b.phase, "string");
  assert.equal(typeof b.dringlichkeit, "number");
  assert.equal(typeof b.signale.verweildauer, "number");
});

// ── Prompt-Text ─────────────────────────────────────────────────────────────

test("zusammenfassung: beschreibt das Verhalten und nennt die Zahlen", () => {
  const s = V.zusammenfassung(V.beurteile({ verweildauer: 150, scrolltiefe: 80, seitenInSitzung: 3 }, "produkt"));
  assert.ok(/zögert/.test(s), s);
  assert.ok(s.includes("150s"));
  assert.ok(s.includes("80%"));
  assert.ok(s.includes("3 Seiten"));
});

test("zusammenfassung: ist als Beobachtung markiert, nicht als Befehl", () => {
  // Sonst könnte der Agent sie als Anweisung lesen und stur danach handeln.
  const s = V.zusammenfassung(V.beurteile({ verweildauer: 200, exitAbsicht: true }, "produkt"));
  assert.ok(/KEINE Anweisung/.test(s), s);
});

test("zusammenfassung: lässt Zahlen weg, die nichts aussagen", () => {
  const s = V.zusammenfassung(V.beurteile({ verweildauer: 4, scrolltiefe: 2 }, "produkt"));
  assert.ok(!s.includes("%"), s);
  assert.ok(!s.includes("Seiten im Besuch"), s);
});

test("zusammenfassung: unbekannte Phase ergibt leeren Text statt Unsinn", () => {
  assert.equal(V.zusammenfassung({ phase: "gibtsnicht", signale: {} }), "");
  assert.equal(V.zusammenfassung(null), "");
});
