// Tests für die Verbrauchsstufen (netlify/functions/lib/verbrauch.js).
//
// Zwei Dinge halten diese Tests fest, und sie ziehen in verschiedene
// Richtungen — genau deshalb sind sie hier festgenagelt:
//
//  1) Der SCHUTZ muss greifen, BEVOR das Abo aufgebraucht ist. Die erste
//     Fassung sparte erst bei 150 % und stoppte bei 500 %; da war das Geld
//     laengst ausgegeben. Jetzt liegt alles innerhalb der 100 %.
//
//  2) Der BESUCHER der Kundenseite soll so lange wie moeglich nichts merken.
//     Bis 90 % aendert sich fuer ihn gar nichts, und selbst am Ende sieht er
//     keinen Fehler, sondern einen beschaeftigten Agenten, der seine
//     Nachricht aufnimmt.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  GRENZEN, HINWEIS_AB, SPARMODUS_AB, NACHRICHT_AB,
  stufeFuer, kuerzeVerlauf, promptZusatz, SPAR_VERLAUF,
} = require("../netlify/functions/lib/verbrauch");

test("normal: weit unter der Grenze passiert gar nichts", () => {
  const l = stufeFuer(100, "basis");
  assert.equal(l.stufe, "normal");
  assert.equal(l.sparmodus, false);
  assert.equal(l.nurNachricht, false);
  assert.equal(l.hinweis, false);
});

test("hinweis ab 75 Prozent — aber NUR im Dashboard, nicht beim Besucher", () => {
  const l = stufeFuer(Math.ceil(GRENZEN.basis * 0.75), "basis");
  assert.equal(l.stufe, "hinweis");
  assert.equal(l.hinweis, true);
  // Das ist der Punkt: Der Besucher merkt an dieser Stelle noch nichts.
  // Zwischen 75 und 90 Prozent hat der Kunde Zeit, selbst hochzustufen,
  // bevor irgendjemand etwas bemerkt.
  assert.equal(l.sparmodus, false);
  assert.equal(l.nurNachricht, false);
});

test("sparmodus ab 90 Prozent — also NOCH INNERHALB des bezahlten Kontingents", () => {
  // Der entscheidende Punkt gegenueber der ersten Fassung: Gespart wird,
  // BEVOR das Abo aufgebraucht ist. Sparte man erst bei 150 Prozent, waere
  // das Geld laengst ausgegeben, wenn der Schutz greift.
  assert.equal(stufeFuer(GRENZEN.basis * 0.89, "basis").sparmodus, false);
  const l = stufeFuer(GRENZEN.basis * 0.9, "basis");
  assert.equal(l.stufe, "sparmodus");
  assert.equal(l.sparmodus, true);
  assert.equal(l.nurNachricht, false);
});

test("nachrichtendienst genau bei 100 Prozent", () => {
  assert.equal(stufeFuer(GRENZEN.basis - 1, "basis").nurNachricht, false);
  const l = stufeFuer(GRENZEN.basis, "basis");
  assert.equal(l.stufe, "nachricht");
  assert.equal(l.nurNachricht, true);
});

test("die Stufen liegen ALLE innerhalb des Kontingents", () => {
  // Waechter gegen ein Zurueckrutschen in die erste Fassung: Kein Schwellwert
  // darf ueber 100 Prozent liegen, sonst greift der Schutz erst nach dem
  // Schaden.
  assert.ok(HINWEIS_AB < SPARMODUS_AB, "Hinweis muss vor dem Sparmodus kommen");
  assert.ok(SPARMODUS_AB < NACHRICHT_AB, "Sparmodus muss vor der Kontaktaufnahme kommen");
  assert.ok(NACHRICHT_AB <= 1, "Bei 100 Prozent ist Schluss — nicht spaeter");
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
  // Derselbe Stand, der bei basis schon den Nachrichtendienst ausloest, ist
  // bei plus noch voellig normal.
  const stand = GRENZEN.basis;
  assert.equal(stufeFuer(stand, "basis").nurNachricht, true);
  assert.equal(stufeFuer(stand, "plus").stufe, "normal");
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
  const z = promptZusatz(stufeFuer(GRENZEN.basis, "basis"), true);
  assert.match(z, /viel los/);
  assert.match(z, /kontakt_hinterlassen/);
  // Ausdruecklich: Der Agent soll NICHT wie ein Fehler wirken.
  assert.match(z, /nicht defekt/);
});

test("promptZusatz ohne Kontakt-Werkzeug verweist nicht darauf", () => {
  const z = promptZusatz(stufeFuer(GRENZEN.basis, "basis"), false);
  assert.doesNotMatch(z, /kontakt_hinterlassen/);
  assert.match(z, /spaeter noch einmal/);
});
