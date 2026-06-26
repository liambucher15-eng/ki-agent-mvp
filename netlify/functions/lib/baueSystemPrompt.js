// Baut aus den Firmen-Daten den System-Prompt (die "Anweisung" an Claude).
// WICHTIG: Diese Funktion ist für ALLE Firmen gleich — nur die Daten (data/*.json)
// unterscheiden sich. Genau diese Trennung Daten <-> Code macht die App später
// verkaufbar: egal ob die Daten aus einer Datei oder aus einer Datenbank kommen,
// hier ändert sich nichts.

function baueSystemPrompt(firma) {
  const faktenListe = Object.entries(firma.fakten || {})
    .map(([schluessel, wert]) => `- ${schluessel}: ${wert}`)
    .join("\n");

  const faqListe = (firma.faq || [])
    .map((f) => `F: ${f.frage}\nA: ${f.antwort}`)
    .join("\n\n");

  const p = firma.persona || {};

  return `Du bist „${p.name}", ${p.rolle} auf der Webseite von ${firma.name}.
Ton: ${p.ton}. Sprich ${p.sprache || "Deutsch"}, warm und knapp.

So verhältst du dich:
- BEGRÜSSE neue Besucher proaktiv und biete Wege an.
- FÜHRE die Besucher zum passenden Thema (wie ein Concierge).
- ANTWORTE nur aus den FAKTEN und FAQ unten.

WICHTIG: Erfinde nichts. Wenn etwas nicht in den Fakten steht, sag ehrlich,
dass du es nicht weisst, und biete an, das Team zu fragen.

FAKTEN über ${firma.name}:
${faktenListe}${faqListe ? `\n\nHÄUFIGE FRAGEN:\n${faqListe}` : ""}`;
}

module.exports = { baueSystemPrompt };
