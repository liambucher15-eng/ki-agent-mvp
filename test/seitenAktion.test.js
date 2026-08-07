// Tests für die Seiten-Aktionen — was der Agent auf der Seite TUN darf.
//
// Der grösste Teil dieser Tests prüft, was NICHT geht. Das ist der Punkt: die
// Anweisung stammt aus einer Modell-Antwort, und das Modell liest Seitentexte,
// die ihm jeder unterschieben kann. Die Erlaubnisliste ist die Sicherung.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const A = require("../netlify/functions/lib/seiten-aktion");

// ── Was erlaubt ist ─────────────────────────────────────────────────────────

test("zeigen: gültiges Ziel kommt durch", () => {
  assert.deepEqual(A.saubereAktion({ aktion: "zeigen", ziel: "Lieferzeit" }),
    { aktion: "zeigen", ziel: "Lieferzeit" });
});

test("oeffnen: Pfad auf derselben Seite kommt durch", () => {
  assert.deepEqual(A.saubereAktion({ aktion: "oeffnen", pfad: "/shop/stuehle" }),
    { aktion: "oeffnen", pfad: "/shop/stuehle" });
});

test("oeffnen: nimmt den Pfad auch aus dem Feld 'ziel'", () => {
  // Das Modell verwechselt die Felder gelegentlich — das soll nicht scheitern.
  assert.deepEqual(A.saubereAktion({ aktion: "oeffnen", ziel: "/shop" }),
    { aktion: "oeffnen", pfad: "/shop" });
});

test("zeigen: Ziel wird gekappt und normalisiert", () => {
  const a = A.saubereAktion({ aktion: "zeigen", ziel: "  Liefer\n  zeit  " });
  assert.equal(a.ziel, "Liefer zeit");
  const lang = A.saubereAktion({ aktion: "zeigen", ziel: "x".repeat(300) });
  assert.equal(lang.ziel.length, A.MAX_ZIEL);
});

// ── Was NICHT geht ──────────────────────────────────────────────────────────

test("unbekannte Aktionen werden verworfen", () => {
  // Die Erlaubnisliste ist abschliessend: klicken, absenden, ausfüllen gibt es nicht.
  assert.equal(A.saubereAktion({ aktion: "klicken", ziel: "In den Warenkorb" }), null);
  assert.equal(A.saubereAktion({ aktion: "absenden", ziel: "Bestellung" }), null);
  assert.equal(A.saubereAktion({ aktion: "ausfuellen", ziel: "E-Mail" }), null);
  assert.equal(A.saubereAktion({ aktion: "eval", ziel: "x" }), null);
});

test("auf Kauf- und Absendeknöpfe wird nicht gezeigt", () => {
  // Der Agent darf über den Kauf reden, aber nicht zum Knopf schubsen.
  for (const ziel of ["Jetzt kaufen", "Bestellen", "Zahlungspflichtig bestellen",
                      "Absenden", "Buy now", "Checkout"]) {
    assert.equal(A.saubereAktion({ aktion: "zeigen", ziel }), null, ziel + " sollte abgelehnt werden");
  }
});

test("oeffnen: fremde Domains sind ausgeschlossen", () => {
  assert.equal(A.saubereAktion({ aktion: "oeffnen", pfad: "https://fremd.example/x" }), null);
  assert.equal(A.saubereAktion({ aktion: "oeffnen", pfad: "//fremd.example/x" }), null);
  assert.equal(A.saubereAktion({ aktion: "oeffnen", pfad: "http://localhost/x" }), null);
});

test("oeffnen: javascript: und data: sind ausgeschlossen", () => {
  assert.equal(A.saubereAktion({ aktion: "oeffnen", pfad: "javascript:alert(1)" }), null);
  assert.equal(A.saubereAktion({ aktion: "oeffnen", pfad: "data:text/html,x" }), null);
});

test("oeffnen: relative Pfade ohne führenden Schrägstrich werden verworfen", () => {
  // "shop/x" wäre relativ zur aktuellen Seite und damit schwer vorhersagbar.
  assert.equal(A.saubereAktion({ aktion: "oeffnen", pfad: "shop/stuehle" }), null);
  assert.equal(A.saubereAktion({ aktion: "oeffnen", pfad: "../admin" }), null);
});

test("leere und kaputte Eingaben ergeben null statt eines Fehlers", () => {
  assert.equal(A.saubereAktion(null), null);
  assert.equal(A.saubereAktion({}), null);
  assert.equal(A.saubereAktion("zeigen"), null);
  assert.equal(A.saubereAktion({ aktion: "zeigen" }), null);       // kein Ziel
  assert.equal(A.saubereAktion({ aktion: "zeigen", ziel: "   " }), null);
  assert.equal(A.saubereAktion({ aktion: "oeffnen" }), null);      // kein Pfad
});

test("Gross-/Kleinschreibung hebelt die Erlaubnisliste nicht aus", () => {
  assert.deepEqual(A.saubereAktion({ aktion: "ZEIGEN", ziel: "Lieferzeit" }),
    { aktion: "zeigen", ziel: "Lieferzeit" });
  assert.equal(A.saubereAktion({ aktion: "zeigen", ziel: "JETZT KAUFEN" }), null);
});

test("die Erlaubnisliste enthält ausschliesslich folgenlose Aktionen", () => {
  // Wächter gegen ein versehentliches Aufweichen: hier darf nur dazukommen,
  // was der Besucher selbst rückgängig machen kann.
  assert.deepEqual(Object.keys(A.ERLAUBT).sort(), ["oeffnen", "zeigen"]);
});
