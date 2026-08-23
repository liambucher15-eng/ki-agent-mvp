// Tests für die Verbrauchsstufen (netlify/functions/lib/verbrauch.js).
//
// Der Kern, den diese Tests festhalten: Der BESUCHER der Kundenseite darf die
// Grenze so lange wie irgend möglich nicht merken. Die ersten beiden Stufen
// ändern für ihn gar nichts; erst weit über der Grenze wird die Antwort
// knapper, und selbst ganz oben sieht er keinen Fehler, sondern einen
// beschäftigten Agenten, der seine Nachricht aufnimmt.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  GRENZEN, stufeFuer, kuerzeVerlauf, promptZusatz, SPAR_VERLAUF,
} = require("../netlify/functions/lib/verbrauch");

test("normal: weit unter der Grenze passiert gar nichts", () => {
  const l = stufeFuer(100, "basis");
  assert.equal(l.stufe, "normal");
  assert.equal(l.sparmodus, false);
  assert.equal(l.nurNachricht, false);
  assert.equal(l.hinweis, false);
});

test("hinweis ab 80 Prozent — aber NUR im Dashboard, nicht beim Besucher", () => {
  const l = stufeFuer(Math.ceil(GRENZEN.basis * 0.8), "basis");
  assert.equal(l.stufe, "hinweis");
  assert.equal(l.hinweis, true);
  // Das ist der Punkt: Der Besucher merkt an dieser Stelle noch nichts.
  assert.equal(l.sparmodus, false);
  assert.equal(l.nurNachricht, false);
});

test("erreicht: auf der Grenze laeuft der Agent noch VOLL weiter", () => {
  const l = stufeFuer(GRENZEN.basis, "basis");
  assert.equal(l.stufe, "erreicht");
  assert.equal(l.hinweis, true);
  // Kein Sparmodus direkt an der Grenze — das ist die Kulanz, die dem Kunden
  // Zeit gibt, selbst hochzustufen, ohne dass seine Besucher darunter leiden.
  assert.equal(l.sparmodus, false);
});

test("sparmodus erst bei 150 Prozent", () => {
  assert.equal(stufeFuer(GRENZEN.basis * 1.49, "basis").sparmodus, false);
  const l = stufeFuer(GRENZEN.basis * 1.5, "basis");
  assert.equal(l.stufe, "sparmodus");
  assert.equal(l.sparmodus, true);
  assert.equal(l.nurNachricht, false);
});

test("nachrichtendienst erst bei 500 Prozent", () => {
  assert.equal(stufeFuer(GRENZEN.basis * 4.99, "basis").nurNachricht, false);
  const l = stufeFuer(GRENZEN.basis * 5, "basis");
  assert.equal(l.stufe, "nachricht");
  assert.equal(l.nurNachricht, true);
});

test("ein ausgefallener Zaehler drosselt NICHT", () => {
  // -1 heisst "konnte nicht zaehlen". Das ist ein Problem auf UNSERER Seite;
  // ein zahlender Kunde darf deswegen nicht ausgebremst werden.
  for (const kaputt of [-1, null, undefined, NaN, "viel"]) {
    const l = stufeFuer(kaputt, "basis");
    assert.equal(l.stufe, "unbekannt", "Stand " + String(kaputt));
    assert.equal(l.sparmodus, false);
    assert.equal(l.nurNachricht, false);
  }
});

test("jeder Plan hat seine eigene Grenze, plus mehr als basis", () => {
  assert.ok(GRENZEN.plus > GRENZEN.basis);
  assert.ok(GRENZEN.enterprise > GRENZEN.plus);
  // Derselbe Stand, der bei basis schon Sparmodus ausloest, ist bei plus normal.
  const stand = GRENZEN.basis * 2;
  assert.equal(stufeFuer(stand, "basis").sparmodus, true);
  assert.equal(stufeFuer(stand, "plus").sparmodus, false);
});

test("unbekannter Plan faellt auf die kleinste Grenze zurueck", () => {
  assert.equal(stufeFuer(0, "gibtsnicht").grenze, GRENZEN.basis);
});

test("kuerzeVerlauf greift nur im Sparmodus und behaelt das ENDE", () => {
  const lang = Array.from({ length: 20 }, (_, i) => ({ role: "user", content: "n" + i }));
  assert.equal(kuerzeVerlauf(lang, false).length, 20, "ohne Sparmodus unveraendert");
  const kurz = kuerzeVerlauf(lang, true);
  assert.equal(kurz.length, SPAR_VERLAUF);
  // Die aktuelle Frage steht am ENDE — die darf auf keinen Fall wegfallen.
  assert.equal(kurz[kurz.length - 1].content, "n19");
});

test("promptZusatz: normal fuegt nichts an", () => {
  assert.equal(promptZusatz(stufeFuer(10, "basis"), true), "");
});

test("promptZusatz: Nachrichtendienst wirkt beschaeftigt, nicht defekt", () => {
  const z = promptZusatz(stufeFuer(GRENZEN.basis * 5, "basis"), true);
  assert.match(z, /viel los/);
  assert.match(z, /kontakt_hinterlassen/);
  // Ausdruecklich: Der Agent soll NICHT wie ein Fehler wirken.
  assert.match(z, /nicht defekt/);
});

test("promptZusatz ohne Kontakt-Werkzeug verweist nicht darauf", () => {
  const z = promptZusatz(stufeFuer(GRENZEN.basis * 5, "basis"), false);
  assert.doesNotMatch(z, /kontakt_hinterlassen/);
  assert.match(z, /spaeter noch einmal/);
});
