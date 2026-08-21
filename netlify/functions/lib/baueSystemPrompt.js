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
  // Die Regel ist bewusst ABSOLUT formuliert ("nenne nie einen Produktnamen im
  // Text") statt bedingt ("wenn du empfiehlst"). Die bedingte Fassung verlangte
  // vom Agenten eine Selbsteinschätzung — und "was passt dazu?" zählte für ihn
  // nicht als Empfehlung, also schrieb er die Produkte doch in den Fliesstext.
  // Eine Regel, die man ohne Auslegung befolgen kann, wird zuverlässig befolgt.
  const produktRegel = kannProdukte
    ? `\n- PRODUKTNAMEN GEHÖREN NIE IN DEINEN ANTWORTTEXT. Sobald du auch nur ein ` +
      `bestimmtes Produkt nennen willst — ob als Empfehlung, als Antwort auf „was passt ` +
      `dazu", als Vergleich oder als Aufzählung — übergib es stattdessen dem Werkzeug ` +
      `„produkte_vorschlagen". Der Besucher bekommt es dann als Karte mit Bild, Preis ` +
      `und Knopf. Dein Text daneben ist EIN kurzer Satz, der die Produkte nicht ` +
      `wiederholt. Höchstens drei Stück, und nur solche, die wirklich passen. Gib immer ` +
      `Link und Bild mit, wenn sie in deinen Informationen stehen — ohne sie ist die ` +
      `Karte nur halb so nützlich.`
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

  // „warm und knapp" stand hier früher fest hinter dem gewählten Ton — und hat
  // ihn damit weitgehend aufgehoben. Wer „sachlich, ohne Ausschmückungen" oder
  // „gehoben, elegant und exklusiv" gewählt hatte, bekam im selben Atemzug
  // „warm" befohlen; das Modell folgt der unbedingten Anweisung und nicht der
  // Beschreibung davor. Nachgemessen: Vier verschiedene Töne lieferten auf
  // dieselbe Frage praktisch dieselbe Antwort, „professionell" und „humorvoll"
  // begannen beide mit „Hey!".
  //
  // „knapp" war ausserdem doppelt — die Antwortlänge steht unten als eigene
  // Regel (laengeRegel) und ist dort vom Kunden einstellbar.
  // NUR-BELEGT-MODUS (firma.nurBelegt).
  //
  // Gesetzt fuer die oeffentliche Probefahrt (public/probe.html): Dort hat der
  // Agent NICHTS ausser einer frisch gescannten fremden Webseite. Die normalen
  // Regeln reichen dafuer nicht - "Erfinde nichts" laesst dem Modell die Tuer
  // offen, aus seinem Weltwissen zu antworten. Bei einem Zahnarzt, einem
  // Restaurant oder einem Treuhandbuero WEISS das Modell viel Branchenuebliches,
  // und genau das wuerde es einsetzen: "Eine Dentalhygiene kostet ueblicherweise
  // 150 Franken". Auf der eigenen Seite des Kunden gelesen ist so ein Satz eine
  // Erfindung im Gewand einer Auskunft - und sie entwertet das ganze Produkt.
  //
  // Die Regel steht deshalb ABSOLUT, ohne Auslegungsspielraum, und GANZ OBEN
  // statt unten: Was zuerst im Prompt steht, bindet staerker.
  // Nur die Probefahrt kennt WIRKLICH nur eine gescannte Seite. Beim bezahlten
  // Agenten kommt zum Scan das dazu, was der Betrieb im Onboarding ergaenzt hat
  // — der Satz waere dort schlicht falsch.
  // Der Kundenagent bekommt von chat.js zusaetzlich einen KONTEXT-Block: welche
  // Seite offen ist, welches Produkt dort steht, mit Preis und Verfuegbarkeit.
  // Der steht NACH den INFORMATIONEN und waere von der Grundregel sonst
  // ausgeschlossen — der Prompt widerspraeche sich dann selbst, denn weiter
  // unten wird ausdruecklich verlangt, Preis und Verfuegbarkeit zu nennen.
  // Die Probefahrt kennt keinen solchen Block; dort bleibt die Regel eng.
  const kontextQuelle = firma.probefahrt
    ? ""
    : "\nDazu kann weiter unten ein KONTEXT-Block stehen, der die Seite" +
      " beschreibt, auf der der Besucher gerade ist. Auch der ist eine" +
      "\nerlaubte Quelle — er stammt von der Seite dieses Betriebs.";
  const woEsStehenMuss = firma.probefahrt ? "unten nicht steht" : "an keiner dieser Stellen steht";

  const herkunftSatz = firma.probefahrt
    ? "\nSie stammen aus EINEM Scan der Webseite dieses Betriebs."
    : "";

  const nurBelegtRegel = firma.nurBelegt
    ? `ABSOLUTE GRUNDREGEL — DU WEISST NUR, WAS UNTEN STEHT:
Alles, was du sagst, muss aus den INFORMATIONEN weiter unten hervorgehen.${herkunftSatz}${kontextQuelle}
Etwas anderes hast du nicht.
- Du hast KEIN Allgemeinwissen. Was du über diese Branche, diesen Ort, übliche
  Preise, übliche Öffnungszeiten oder ähnliche Betriebe zu wissen glaubst,
  zählt hier NICHT und darf in keine Antwort einfliessen.
- Rate nicht, schätze nicht, runde nicht, leite nichts ab und ergänze nichts,
  was „üblich“ wäre — auch nicht als Vermutung, auch nicht mit „wahrscheinlich“.
- Nenne KEINE Zahl, keinen Preis, keine Uhrzeit, keinen Namen, keine Adresse und
  keine Telefonnummer, die ${woEsStehenMuss}.
- Steht die Antwort unten nicht, sagst du das offen. Sag es lieber einmal zu
  oft als einmal zu wenig — es ist hier die BESTE Antwort, kein Versagen.
- Im Zweifel gilt: Wenn du nicht sicher bist, ob etwas unten steht, steht es
  nicht unten.

`
    : "";

  // Bei der PROBEFAHRT faellt die proaktive Begruessung weg: Der Besucher hat
  // gerade selbst einen Scan ausgeloest und hat drei GEZAEHLTE Fragen. Ein
  // "Wie kann ich helfen?" waere eine davon.
  //
  // Beim bezahlten Agenten ist die Begruessung dagegen erwuenscht — deshalb
  // haengt sie an firma.probefahrt und NICHT an firma.nurBelegt. Die beiden
  // Dinge waren erst gekoppelt und mussten getrennt werden, als die
  // Ehrlichkeitsregel auch fuer den Kundenagenten gelten sollte: Sonst haette
  // dieser mit der Regel zugleich seine Begruessung und die Uebergabe ans Team
  // verloren, also zwei Faehigkeiten, fuer die der Kunde bezahlt.
  const verhaltenKopf = firma.probefahrt
    ? "- ANTWORTE ausschliesslich aus den Informationen unten."
    : `- BEGRÜSSE neue Besucher proaktiv und biete Wege an.
- FÜHRE die Besucher zum passenden Thema (wie ein Concierge).
- ANTWORTE nur aus den Informationen unten.`;

  // Der Schlusssatz ebenfalls: "biete an, das Team zu fragen" geht bei der
  // Probefahrt ins Leere - es gibt kein Team, das erreichbar waere. Beim
  // Kundenagenten gibt es eins.
  const schlussRegel = firma.probefahrt
    ? "WICHTIG: Erfinde nichts. Was unten nicht steht, weisst du nicht. Sag das offen."
    : `WICHTIG: Erfinde nichts. Wenn etwas nicht in den Informationen steht, sag ehrlich,
dass du es nicht weisst, und biete an, das Team zu fragen.`;

  return `${nurBelegtRegel}Du bist „${p.name}", ${p.rolle} auf der Webseite von ${firma.name}.
Ton: ${p.ton}. Sprich ${spr}. ${anredeRegel}${aussehenRegel}

So verhältst du dich:
${verhaltenKopf}${produktRegel}${seiteRegel}${kontaktRegel}${fallbackRegel}
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

${schlussRegel}

INFORMATIONEN über ${firma.name}:
${faktenListe || "(keine Stichpunkte)"}${wissen ? `\n\nWEITERE INFOS:\n${wissen}` : ""}${faqListe ? `\n\nHÄUFIGE FRAGEN:\n${faqListe}` : ""}`;
}

module.exports = { baueSystemPrompt, baueWissensText };
