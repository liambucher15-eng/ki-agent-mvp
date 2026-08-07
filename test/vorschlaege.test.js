// Tests für die Säuberung der Produktvorschläge.
//
// Diese Daten stammen aus einer Modell-Antwort und landen ungeprüft in der
// Oberfläche — insbesondere die URL als echter Link. Das ist die eine Stelle,
// an der aus einem erfundenen Wert Schaden entstehen könnte.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const V = require("../netlify/functions/lib/vorschlaege");

// ── Links ───────────────────────────────────────────────────────────────────

test("saubereUrl: relative Pfade und http(s) sind erlaubt", () => {
  assert.equal(V.saubereUrl("/p/eichentisch"), "/p/eichentisch");
  assert.equal(V.saubereUrl("https://shop.example/p/1"), "https://shop.example/p/1");
  assert.equal(V.saubereUrl("http://shop.example/p/1"), "http://shop.example/p/1");
});

test("saubereUrl: javascript: und data: werden verworfen", () => {
  assert.equal(V.saubereUrl("javascript:alert(1)"), "");
  assert.equal(V.saubereUrl("JavaScript:alert(1)"), "");
  assert.equal(V.saubereUrl("data:text/html,<script>x</script>"), "");
  assert.equal(V.saubereUrl("vbscript:msgbox"), "");
});

test("saubereUrl: protokoll-relative Links werden verworfen", () => {
  // "//fremde.example/x" landet auf einer fremden Domain — nicht erwünscht.
  assert.equal(V.saubereUrl("//fremde.example/x"), "");
});

test("saubereUrl: Unsinn und Leeres ergibt leer", () => {
  assert.equal(V.saubereUrl(""), "");
  assert.equal(V.saubereUrl(null), "");
  assert.equal(V.saubereUrl(42), "");
  assert.equal(V.saubereUrl("einfach text"), "");
});

// ── Karten ──────────────────────────────────────────────────────────────────

test("saubereVorschlaege: gültiger Vorschlag kommt vollständig durch", () => {
  const v = V.saubereVorschlaege([
    { name: "Stuhl Lund", preis: "249 €", grund: "Gleiche Eiche wie dein Tisch.", url: "/p/lund" },
  ]);
  assert.equal(v.length, 1);
  assert.deepEqual(v[0], {
    name: "Stuhl Lund", grund: "Gleiche Eiche wie dein Tisch.", preis: "249 €", url: "/p/lund",
  });
});

test("saubereVorschlaege: ohne Namen oder ohne Grund keine Karte", () => {
  // Ohne Namen ist es keine Karte; ohne Grund ist es keine Empfehlung.
  const v = V.saubereVorschlaege([
    { preis: "10 €", grund: "passt" },
    { name: "Ohne Grund", preis: "10 €" },
    { name: "Gut", grund: "passt" },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].name, "Gut");
});

test("saubereVorschlaege: höchstens drei Karten", () => {
  const viele = [];
  for (let i = 0; i < 9; i++) viele.push({ name: "P" + i, grund: "weil" });
  assert.equal(V.saubereVorschlaege(viele).length, 3);
});

test("saubereVorschlaege: dasselbe Produkt doppelt erscheint einmal", () => {
  const v = V.saubereVorschlaege([
    { name: "Stuhl Lund", grund: "a" },
    { name: "stuhl lund", grund: "b" },
  ]);
  assert.equal(v.length, 1);
});

test("saubereVorschlaege: unsicherer Link wird entfernt, die Karte bleibt", () => {
  // Der Vorschlag selbst kann brauchbar sein — nur der Link fliegt raus.
  const v = V.saubereVorschlaege([
    { name: "Stuhl Lund", grund: "passt", url: "javascript:alert(1)" },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].url, undefined);
});

test("saubereVorschlaege: lange Texte werden gekappt", () => {
  const v = V.saubereVorschlaege([
    { name: "N".repeat(300), grund: "G".repeat(500), preis: "P".repeat(90) },
  ]);
  assert.equal(v[0].name.length, 80);
  assert.equal(v[0].grund.length, 160);
  assert.equal(v[0].preis.length, 24);
});

test("saubereVorschlaege: Markup im Namen bleibt harmloser Text", () => {
  // Die Oberfläche setzt per textContent ein — hier wird nur bestätigt, dass
  // nichts umgeschrieben oder entfernt wird und die Länge greift.
  const v = V.saubereVorschlaege([
    { name: "<img src=x onerror=alert(1)>", grund: "test" },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].name, "<img src=x onerror=alert(1)>");
});

test("saubereVorschlaege: kaputte Eingaben ergeben eine leere Liste", () => {
  assert.deepEqual(V.saubereVorschlaege(null), []);
  assert.deepEqual(V.saubereVorschlaege("keine Liste"), []);
  assert.deepEqual(V.saubereVorschlaege([null, 42, "x"]), []);
  assert.deepEqual(V.saubereVorschlaege([]), []);
});

test("saubereVorschlaege: Preis ist optional", () => {
  const v = V.saubereVorschlaege([{ name: "Auf Anfrage", grund: "Sondermass" }]);
  assert.equal(v[0].preis, undefined);
  assert.equal(v[0].name, "Auf Anfrage");
});
