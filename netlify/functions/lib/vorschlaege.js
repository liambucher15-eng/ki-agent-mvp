// Produktvorschläge säubern, bevor sie in die Oberfläche gehen.
//
// Die Vorschläge kommen aus einer Modell-Antwort. Das Modell arbeitet mit dem
// Wissen der Firma, aber es formuliert frei — also ist alles hier ungeprüfte
// Eingabe und wird behandelt wie jede andere: gekappt, begrenzt, gefiltert.
//
// Besonders die URL: sie landet als Link in der Seite. Erlaubt sind deshalb nur
// relative Pfade und http(s) — kein javascript:, kein data:. Das ist die eine
// Stelle, an der aus einem erfundenen Wert echter Schaden entstehen könnte.

(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.Vorschlaege = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAX_VORSCHLAEGE = 3;   // mehr Karten sind keine Empfehlung mehr, sondern ein Katalog
  const MAX_NAME = 80;
  const MAX_PREIS = 24;
  const MAX_GRUND = 160;
  const MAX_URL = 300;

  function text(wert, max) {
    if (typeof wert === "number") wert = String(wert);
    if (typeof wert !== "string") return "";
    return wert.replace(/\s+/g, " ").trim().slice(0, max);
  }

  // Nur Links, die harmlos sind: relativer Pfad oder http(s). Alles andere
  // (javascript:, data:, vbscript:, Protokoll-relativ) fliegt raus.
  function saubereUrl(wert) {
    const roh = text(wert, MAX_URL);
    if (!roh) return "";
    if (roh.startsWith("//")) return "";           // protokoll-relativ -> fremde Herkunft
    if (roh.startsWith("/")) return roh;           // relativer Pfad auf derselben Seite
    if (/^https?:\/\/[^\s]+$/i.test(roh)) return roh;
    return "";
  }

  function saubereVorschlaege(liste) {
    if (!Array.isArray(liste)) return [];
    const raus = [];
    const gesehen = new Set();
    for (const eintrag of liste) {
      if (raus.length >= MAX_VORSCHLAEGE) break;
      if (!eintrag || typeof eintrag !== "object") continue;
      const name = text(eintrag.name, MAX_NAME);
      const grund = text(eintrag.grund, MAX_GRUND);
      // Ohne Namen ist es keine Karte; ohne Grund ist es keine Empfehlung.
      if (!name || !grund) continue;
      const schluessel = name.toLowerCase();
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      const karte = { name, grund };
      const preis = text(eintrag.preis, MAX_PREIS);
      if (preis) karte.preis = preis;
      const url = saubereUrl(eintrag.url);
      if (url) karte.url = url;
      raus.push(karte);
    }
    return raus;
  }

  return { saubereVorschlaege, saubereUrl, MAX_VORSCHLAEGE };
});
