// Tests für den Kaufweg — wo auf dem Weg zum Kauf steht der Besucher?

const { test } = require("node:test");
const assert = require("node:assert/strict");

const K = require("../netlify/functions/lib/kaufweg");

// ── Stufen ──────────────────────────────────────────────────────────────────

test("die Seite ist das stärkere Signal als das Verhalten", () => {
  // Wer an der Kasse steht, ist an der Kasse — egal wie er sich vorher verhielt.
  assert.equal(K.stufeAus("kasse", { produkteGesehen: 9, gesehen: ["a", "b", "c"] }, "vergleicht"), "kasse");
  assert.equal(K.stufeAus("warenkorb", { produkteGesehen: 9 }, "zoegert"), "warenkorb");
  assert.equal(K.stufeAus("bestaetigung", { produkteGesehen: 9 }, "zoegert"), "gekauft");
});

test("erste Produktseite ohne Vorgeschichte ist 'interessiert'", () => {
  assert.equal(K.stufeAus("produkt", { produkteGesehen: 1 }, "vertieft"), "interessiert");
});

test("mehrere gesehene Produkte bedeuten 'abwaegen'", () => {
  assert.equal(K.stufeAus("produkt", { produkteGesehen: 3 }, "vertieft"), "abwaegen");
  assert.equal(K.stufeAus("produkt", { gesehen: ["Tisch A", "Tisch B"] }, "vertieft"), "abwaegen");
});

test("sichtbares Zögern bedeutet 'abwaegen', auch beim ersten Produkt", () => {
  assert.equal(K.stufeAus("produkt", { produkteGesehen: 1 }, "zoegert"), "abwaegen");
  assert.equal(K.stufeAus("produkt", { produkteGesehen: 1 }, "vergleicht"), "abwaegen");
});

test("Info- und Kategorieseiten ohne Vorgeschichte sind 'umsehen'", () => {
  assert.equal(K.stufeAus("info", {}, "stoebert"), "umsehen");
  assert.equal(K.stufeAus("kategorie", {}, "angekommen"), "umsehen");
});

test("fehlende Angaben ergeben die harmloseste Stufe", () => {
  assert.equal(K.stufeAus(undefined, null, undefined), "umsehen");
  assert.equal(K.stufeAus("", {}, ""), "umsehen");
});

// ── Rat pro Stufe ───────────────────────────────────────────────────────────

test("jede Stufe sagt, was hilft UND was schadet", () => {
  // Der "schadet"-Teil ist der wichtigere: auf der falschen Stufe das Richtige
  // zu sagen ist trotzdem falsch.
  for (const stufe of K.STUFEN) {
    assert.ok(K.RAT[stufe], stufe + " fehlt im Rat");
    assert.ok(K.RAT[stufe].hilft.length > 20, stufe + ": 'hilft' zu dünn");
    assert.ok(K.RAT[stufe].schadet.length > 20, stufe + ": 'schadet' zu dünn");
  }
});

test("im Warenkorb und an der Kasse wird ausdrücklich vor Ablenkung gewarnt", () => {
  // Der teuerste Fehler des ganzen Systems wäre, kurz vor dem Abschluss noch
  // etwas anzubieten.
  assert.match(K.RAT.warenkorb.schadet, /Produkte vorschlagen|Korb ist gepackt/);
  assert.match(K.RAT.kasse.schadet, /Ablenkung|kostet den Kauf/);
});

test("beim Abwägen wird vor MEHR Auswahl gewarnt", () => {
  assert.match(K.RAT.abwaegen.schadet, /mehr Auswahl|weniger Optionen/);
});

// ── Beurteilung und Prompt-Text ─────────────────────────────────────────────

test("beurteile: liefert Stufe, Position und beide Ratschläge", () => {
  const b = K.beurteile("kasse", {}, "im_kauf");
  assert.equal(b.stufe, "kasse");
  assert.equal(b.nummer, K.STUFEN.indexOf("kasse"));
  assert.ok(b.hilft.length > 10);
  assert.ok(b.schadet.length > 10);
});

test("zusammenfassung: nennt Stufe und beide Ratschläge, als Hinweis markiert", () => {
  const s = K.zusammenfassung(K.beurteile("abwaegen", { produkteGesehen: 3 }, "vergleicht"));
  assert.match(s, /abwaegen/);
  assert.match(s, /Hier hilft:/);
  assert.match(s, /Hier schadet:/);
  assert.match(s, /KEINE Anweisung/);
});

test("zusammenfassung: unbekannte Stufe ergibt leeren Text statt Unsinn", () => {
  assert.equal(K.zusammenfassung({ stufe: "gibtsnicht" }), "");
  assert.equal(K.zusammenfassung(null), "");
});

test("die Stufen stehen in der Reihenfolge, in der man sie geht", () => {
  assert.deepEqual(K.STUFEN,
    ["umsehen", "interessiert", "abwaegen", "warenkorb", "kasse", "gekauft"]);
});
