// Tests für den Testzeitraum (netlify/functions/lib/testzeit.js).
//
// Drei Dinge halten diese Tests fest, und sie ziehen in verschiedene
// Richtungen — genau deshalb stehen sie hier:
//
//  1) Der Test muss WIRKLICH ablaufen. Der Vorgänger ("free" ohne Frist) war
//     für viele Betriebe die Dauerlösung, und es zahlte nie jemand.
//
//  2) Ein bezahlter Agent darf NIE in den Testzeitraum geraten. Ein Kunde,
//     dessen Agent nach vierzehn Tagen verstummt, obwohl er zahlt, ist ein
//     Ausfall, den wir verursacht haben.
//
//  3) Fehlt das Datum, gilt der Test als LAUFEND. Ein Problem auf unserer
//     Seite darf keinen Agenten abschalten, der auf einer Kundenwebseite
//     steht — dieselbe Regel wie beim Verbrauchszähler.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { TESTTAGE, testLage, promptZusatzTest } = require("../netlify/functions/lib/testzeit");

const TAG = 24 * 60 * 60 * 1000;
const JETZT = Date.parse("2026-09-15T12:00:00Z");
// Ein Datum, das um so viele Tage zurückliegt.
const vorTagen = (n) => new Date(JETZT - n * TAG).toISOString();

test("testzeit: frisch angelegte Firma testet, mit voller Frist", () => {
  const l = testLage({ plan: "free", erstellt: vorTagen(0) }, JETZT);
  assert.equal(l.testet, true);
  assert.equal(l.abgelaufen, false);
  assert.equal(l.tageUebrig, TESTTAGE);
});

test("testzeit: am vorletzten Tag läuft er noch", () => {
  const l = testLage({ plan: "free", erstellt: vorTagen(TESTTAGE - 1) }, JETZT);
  assert.equal(l.abgelaufen, false);
  assert.equal(l.tageUebrig, 1);
});

test("testzeit: exakt auf den Tag ist er vorbei", () => {
  // Die Grenze gehört zum Ablauf, nicht zur Frist: Nach genau vierzehn Tagen
  // ist Schluss, nicht erst am fünfzehnten.
  const l = testLage({ plan: "free", erstellt: vorTagen(TESTTAGE) }, JETZT);
  assert.equal(l.abgelaufen, true);
  assert.equal(l.tageUebrig, 0);
});

test("testzeit: lange abgelaufen bleibt abgelaufen", () => {
  const l = testLage({ plan: "free", erstellt: vorTagen(400) }, JETZT);
  assert.equal(l.abgelaufen, true);
});

test("testzeit: bezahlte Pläne haben KEINEN Testzeitraum", () => {
  // Auch bei uralter Firma: Wer zahlt, wird nie abgeschaltet.
  for (const plan of ["start", "grow", "scale", "basis", "plus", "enterprise"]) {
    const l = testLage({ plan, erstellt: vorTagen(400) }, JETZT);
    assert.equal(l.testet, false, plan + " sollte nicht testen");
    assert.equal(l.abgelaufen, false, plan + " darf nie ablaufen");
  }
});

test("testzeit: ohne Datum läuft der Test weiter, statt abzuschalten", () => {
  for (const kaputt of [undefined, null, "", "morgen", "0000-13-45"]) {
    const l = testLage({ plan: "free", erstellt: kaputt }, JETZT);
    assert.equal(l.abgelaufen, false, JSON.stringify(kaputt) + " darf nicht abschalten");
    assert.equal(l.testet, true);
    assert.equal(l.tageUebrig, null);
  }
});

test("testzeit: ohne Firma passiert gar nichts", () => {
  for (const nichts of [null, undefined]) {
    const l = testLage(nichts, JETZT);
    assert.equal(l.testet, false);
    assert.equal(l.abgelaufen, false);
  }
});

test("testzeit: die Anweisung verrät dem Besucher nichts über Geld", () => {
  // Der Besucher der Kundenseite hat nichts falsch gemacht — er darf nicht
  // erfahren, dass sein Gegenüber nicht bezahlt hat. Geprüft wird deshalb,
  // dass die ANWEISUNG das Verschweigen ausdrücklich verlangt.
  const text = promptZusatzTest(true);
  assert.match(text, /Erwaehne WEDER Testzeitraum NOCH Bezahlung/);
  assert.match(text, /kontakt_hinterlassen/);
});

test("testzeit: ohne Kontakt-Fähigkeit verweist er auf den Betrieb", () => {
  const text = promptZusatzTest(false);
  assert.ok(!text.includes("kontakt_hinterlassen"));
  assert.match(text, /direkt zu kontaktieren/);
});
