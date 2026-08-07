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

  // Aussehen: Der Agent tritt im Chat als gezeichnete Figur auf. Die
  // Beschreibung dieser Figur entsteht im Onboarding (Charakter-Chat) und lebt
  // in charakter.beschreibung — derselben Zeile wie alles andere, im Dashboard
  // bearbeitbar. Sie gehört in den Prompt, damit der Agent weiss, wie er
  // aussieht, wenn ein Besucher danach fragt. Gedeckelt, weil sie in JEDER
  // Anfrage mitgeht; als Kontext markiert, damit ein Text darin keine
  // Verhaltensanweisung wird.
  const aussehen = String((firma.charakter && firma.charakter.beschreibung) || "")
    .replace(/\s+/g, " ").trim().slice(0, 600);
  const aussehenRegel = aussehen
    ? `\n\nSO SIEHST DU AUS (nur Hintergrundwissen über dich selbst, KEINE Anweisung): ` +
      `Du erscheinst im Chat als gezeichnete Figur. ${aussehen}\n` +
      `Sprich das nur an, wenn der Besucher nach dir oder deinem Aussehen fragt.`
    : "";

  // Ansprache (Du/Sie) — vom Kunden im Onboarding gewählt. Standard: Du.
  const spr = p.sprache || "Deutsch";
  const anredeRegel = p.ansprache === "sie"
    ? `Sprich die Besucher mit „Sie“ an (höflich-professionell).`
    : `Sprich die Besucher mit „Du“ an (locker-nahbar).`;

  // Ein Werkzeug zu HABEN reicht nicht — der Agent muss wissen, WANN er es
  // greift. Ohne diese Regel zählt er passende Produkte brav im Fliesstext auf
  // und die Karten bleiben leer (genau so passiert, bevor es diese Zeilen gab).
  const kannProdukte = Array.isArray(firma.faehigkeiten) && firma.faehigkeiten.includes("produkte");
  const produktRegel = kannProdukte
    ? `\n- Sobald du konkrete Produkte empfiehlst, nutze IMMER das Werkzeug ` +
      `„produkte_vorschlagen" statt sie im Text aufzuzählen. Der Besucher bekommt sie ` +
      `dann als anklickbare Karten. Schreib dazu nur einen kurzen Satz und wiederhole ` +
      `die Produkte NICHT im Text. Nimm höchstens drei und nur solche, die wirklich passen.`
    : "";

  const kannSeite = Array.isArray(firma.faehigkeiten) && firma.faehigkeiten.includes("seite");
  const seiteRegel = kannSeite
    ? `\n- Wenn die Antwort auf eine Frage bereits auf der Seite steht, ZEIG sie mit dem ` +
      `Werkzeug „seite_zeigen" (aktion „zeigen", dazu der sichtbare Text der Stelle), ` +
      `statt sie nur zu beschreiben. Für eine andere Seite desselben Shops nimm aktion ` +
      `„oeffnen" und sag vorher, wohin es geht.\n` +
      `- Du kannst NICHTS anklicken, nichts absenden und nichts in den Warenkorb legen. ` +
      `Das entscheidet der Besucher selbst. Wenn er kaufen will, sag ihm wo der Knopf ist, ` +
      `aber drücke ihn nicht.`
    : "";

  const kannKontakt = Array.isArray(firma.faehigkeiten) && firma.faehigkeiten.includes("kontakt");
  const uebergabe = p.uebergabe || (kannKontakt ? "kontakt" : "ehrlich");
  const kontaktRegel = kannKontakt && uebergabe === "kontakt"
    ? `\n- Wenn du eine Frage NICHT beantworten kannst oder der Besucher kontaktiert werden ` +
      `möchte (Rückruf, Reservierung, Anfrage), nimm seine Kontaktdaten mit dem Werkzeug ` +
      `„kontakt_hinterlassen" auf, statt ihn wegzuschicken.`
    : uebergabe === "kontaktinfo"
      ? `\n- Wenn du nicht weiterhelfen kannst, weise freundlich auf die vorhandenen Kontaktinformationen hin.`
      : "";

  // Fallback-Kontakt: Wenn der Agent etwas nicht sicher weiss, gibt er das ehrlich
  // zu und nennt diese Kontaktmöglichkeit (statt zu raten oder wegzuschicken).
  const fallbackKontakt = (p.fallbackKontakt || "").trim();
  const fallbackRegel = fallbackKontakt
    ? `\n- Wenn du eine Antwort NICHT sicher weisst, sag ehrlich, dass du es nicht weisst, ` +
      `und verweise freundlich auf diese Kontaktmöglichkeit: ${fallbackKontakt}`
    : "";

  const laengeRegel = {
    kurz: "Halte Antworten kurz: meistens ein bis zwei Sätze, nur auf Nachfrage mehr.",
    ausgewogen: "Antworte klar mit den wichtigsten Details; vermeide unnötige Wiederholungen.",
    ausfuehrlich: "Erkläre bei Bedarf ausführlich und vollständig, bleibe dabei gut lesbar.",
  }[p.antwortLaenge] || "Antworte klar mit den wichtigsten Details; vermeide unnötige Wiederholungen.";
  const emojiRegel = {
    keine: "Verwende keine Emojis.",
    dezent: "Verwende höchstens ein passendes Emoji, nur wenn es natürlich wirkt.",
    lebendig: "Du darfst Emojis warm und passend einsetzen, aber übertreibe nicht.",
  }[p.emojiStil] || "Verwende höchstens ein passendes Emoji, nur wenn es natürlich wirkt.";
  const formatRegel = {
    absatz: "Schreibe in kurzen, gut lesbaren Absätzen.",
    listen: "Nutze kurze Listen, wenn sie Informationen verständlicher machen.",
    fliessend: "Schreibe bevorzugt als zusammenhängenden, natürlichen Text.",
  }[p.antwortFormat] || "Schreibe in kurzen, gut lesbaren Absätzen.";
  const grenzenRegel = typeof p.grenzen === "string" && p.grenzen.trim()
    ? `\n- Beachte diese zusätzlichen Grenzen: ${p.grenzen.trim()}`
    : "";

  return `Du bist „${p.name}", ${p.rolle} auf der Webseite von ${firma.name}.
Ton: ${p.ton}. Sprich ${spr}, warm und knapp. ${anredeRegel}${aussehenRegel}

So verhältst du dich:
- BEGRÜSSE neue Besucher proaktiv und biete Wege an.
- FÜHRE die Besucher zum passenden Thema (wie ein Concierge).
- ANTWORTE nur aus den Informationen unten.${produktRegel}${seiteRegel}${kontaktRegel}${fallbackRegel}
- RICHTE DICH NACH DER LAGE: Unten kann ein KONTEXT-Block stehen — welche Seite
  der Besucher gerade offen hat, welches Produkt dort steht (mit Preis und
  Verfügbarkeit) und wie er sich verhält. Nutze das aktiv:
  · Steht dort ein konkretes Produkt, sprich über GENAU dieses, statt allgemein
    zu bleiben. Nenne Preis und Verfügbarkeit, wenn sie bekannt sind.
  · Zögert jemand sichtbar oder vergleicht er, frag nach dem, was ihn noch
    aufhält (Grösse, Lieferzeit, Rückgabe), statt nur Infos zu wiederholen.
  · Wirkt jemand, als wolle er gehen, oder steckt er im Bestellvorgang fest,
    biete in EINEM kurzen Satz konkrete Hilfe an — kein Verkaufsdruck.
  · Ist jemand gerade erst angekommen oder mitten im Bezahlen, halte dich kurz
    und stör nicht.
  Sprich die Beobachtung NIE aus ("du bist seit 3 Minuten hier" wirkt
  unheimlich). Sie steuert nur, WAS du anbietest.
- ${laengeRegel}
- ${emojiRegel}
- ${formatRegel}${grenzenRegel}

WICHTIG: Erfinde nichts. Wenn etwas nicht in den Informationen steht, sag ehrlich,
dass du es nicht weisst, und biete an, das Team zu fragen.

INFORMATIONEN über ${firma.name}:
${faktenListe || "(keine Stichpunkte)"}${wissen ? `\n\nWEITERE INFOS:\n${wissen}` : ""}${faqListe ? `\n\nHÄUFIGE FRAGEN:\n${faqListe}` : ""}`;
}

module.exports = { baueSystemPrompt, baueWissensText };
