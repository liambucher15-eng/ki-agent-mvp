// Baut aus den Firmen-Daten den System-Prompt (die "Anweisung" an Claude).
// WICHTIG: Diese Funktion ist für ALLE Firmen gleich — nur die Daten (data/*.json)
// unterscheiden sich. Genau diese Trennung Daten <-> Code macht die App später
// verkaufbar: egal ob die Daten aus einer Datei oder aus einer Datenbank kommen,
// hier ändert sich nichts.

// Wissen einer Firma als Text für den Prompt.
// NEU (Milestone 3): wissensquellen[] — jede Quelle kennt Herkunft und Stand
//   { id, typ: "scan"|"dokument"|"manuell", titel, text, stand, quelle? }
// Damit lässt sich Wissen einzeln aktualisieren/löschen (Dashboard, Re-Scan).
// ALT (Fallback): ein einzelner wissen-String (Seed-Firmen, alte Zeilen).
function baueWissensText(firma) {
  if (Array.isArray(firma.wissensquellen) && firma.wissensquellen.length) {
    return firma.wissensquellen
      .filter((q) => q && typeof q.text === "string" && q.text.trim())
      .map((q) => {
        const kopf = `── ${q.titel || "Quelle"}${q.stand ? ` (Stand: ${q.stand})` : ""} ──`;
        return `${kopf}\n${q.text.trim()}`;
      })
      .join("\n\n");
  }
  return firma.wissen || "";
}

function baueSystemPrompt(firma) {
  const faktenListe = Object.entries(firma.fakten || {})
    .map(([schluessel, wert]) => `- ${schluessel}: ${wert}`)
    .join("\n");

  const faqListe = (firma.faq || [])
    .map((f) => `F: ${f.frage}\nA: ${f.antwort}`)
    .join("\n\n");

  const p = firma.persona || {};
  const wissen = baueWissensText(firma);

  // Ansprache (Du/Sie) — vom Kunden im Onboarding gewählt. Standard: Du.
  const spr = p.sprache || "Deutsch";
  const anredeRegel = p.ansprache === "sie"
    ? `Sprich die Besucher mit „Sie“ an (höflich-professionell).`
    : `Sprich die Besucher mit „Du“ an (locker-nahbar).`;

  const kannKontakt = Array.isArray(firma.faehigkeiten) && firma.faehigkeiten.includes("kontakt");
  const kontaktRegel = kannKontakt
    ? `\n- Wenn du eine Frage NICHT beantworten kannst oder der Besucher kontaktiert werden ` +
      `möchte (Rückruf, Reservierung, Anfrage), nimm seine Kontaktdaten mit dem Werkzeug ` +
      `„kontakt_hinterlassen" auf, statt ihn wegzuschicken.`
    : "";

  return `Du bist „${p.name}", ${p.rolle} auf der Webseite von ${firma.name}.
Ton: ${p.ton}. Sprich ${spr}, warm und knapp. ${anredeRegel}

So verhältst du dich:
- BEGRÜSSE neue Besucher proaktiv und biete Wege an.
- FÜHRE die Besucher zum passenden Thema (wie ein Concierge).
- ANTWORTE nur aus den Informationen unten.${kontaktRegel}

WICHTIG: Erfinde nichts. Wenn etwas nicht in den Informationen steht, sag ehrlich,
dass du es nicht weisst, und biete an, das Team zu fragen.

INFORMATIONEN über ${firma.name}:
${faktenListe || "(keine Stichpunkte)"}${wissen ? `\n\nWEITERE INFOS:\n${wissen}` : ""}${faqListe ? `\n\nHÄUFIGE FRAGEN:\n${faqListe}` : ""}`;
}

module.exports = { baueSystemPrompt, baueWissensText };
