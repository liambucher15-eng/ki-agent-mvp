// Charakter-Berater: ein CHAT, der beim Entwickeln der Figur hilft.
// Der Nutzer erzählt seine Idee in eigenen Worten (auch ganz grob), die KI fragt
// bei Bedarf kurz nach und schreibt daraus den fertigen BILD-PROMPT. Mit dem
// Prompt wird dann EIN Entwurf generiert; Änderungswünsche laufen wieder über
// diesen Chat. So muss der Kunde selbst keinen guten Prompt schreiben können.
//
// Antwortet immer als JSON: { antwort, prompt, bereit }
//   antwort = was im Chat steht, prompt = aktueller Bild-Prompt (kann "" sein),
//   bereit  = true, wenn der Prompt aus Sicht der KI generierbar ist.
//
// Sicherheit/Kosten: Origin-Prüfung + Rate-Limit, Verlauf und Felder gedeckelt.

const { json, holeIp, originErlaubt, rateOk } = require("./lib/schutz");
const { rufeClaude } = require("./lib/claude");

const MAX_NACHRICHT = 600, MAX_VERLAUF = 16, MAX_FIRMA = 120, MAX_ANGEBOT = 300;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Nur POST erlaubt" });
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });
  if (!(await rateOk("charprompt:" + holeIp(event), 40, 60))) {
    return json(429, { error: "Zu viele Anfragen." });
  }

  let verlauf, firma, angebot;
  try { ({ verlauf, firma, angebot } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }

  firma = String(firma || "").slice(0, MAX_FIRMA).replace(/\s+/g, " ").trim();
  angebot = String(angebot || "").slice(0, MAX_ANGEBOT).replace(/\s+/g, " ").trim();

  // Verlauf säubern und deckeln: nur die letzten Nachrichten, jede gekürzt.
  const nachrichten = (Array.isArray(verlauf) ? verlauf : [])
    .filter((n) => n && typeof n.text === "string" && n.text.trim())
    .slice(-MAX_VERLAUF)
    .map((n) => ({
      role: n.rolle === "kmi" || n.rolle === "ki" ? "assistant" : "user",
      content: String(n.text).slice(0, MAX_NACHRICHT),
    }));
  if (!nachrichten.length) return json(400, { error: "Bitte schreib zuerst deine Idee." });
  // Claude erwartet, dass das Gespräch mit einer Nutzer-Nachricht beginnt.
  while (nachrichten.length && nachrichten[0].role === "assistant") nachrichten.shift();
  if (!nachrichten.length) return json(400, { error: "Bitte schreib zuerst deine Idee." });

  if (!process.env.ANTHROPIC_API_KEY) return json(200, { antwort: "", prompt: "", bereit: false });

  const kontext = [firma && ("Firma: " + firma), angebot && ("Angebot: " + angebot)]
    .filter(Boolean).join("; ");
  const system =
    "Du bist ein freundlicher Charakter-Designer. Du entwickelst mit einer kleinen Firma zusammen " +
    "die Wunsch-Figur (Maskottchen) für ihren Chat-Agenten. Ihr spinnt die Idee erst GEMEINSAM " +
    "weiter, gezeichnet wird erst, wenn der Kunde sich für eine Richtung entschieden hat.\n\n" +
    "So arbeitest du:\n" +
    "- ZUERST BRAINSTORMEN. Auf die erste Idee des Kunden antwortest du NIE mit einer Zeichnung.\n" +
    "- Schon in deiner ERSTEN Antwort stehen zwei oder drei KONKRETE, deutlich verschiedene " +
    "Vorschläge, wie die Figur aussehen könnte, jeder in wenigen Worten. Frag NICHT einfach nur " +
    "nach dem Stil, ohne selbst etwas vorzuschlagen.\n" +
    "- Danach stellst du EINE einzige Frage, die den Kunden weiterbringt, meistens welche " +
    "Richtung ihm gefällt. Nie mehrere Fragen auf einmal, nie zweimal dasselbe fragen.\n" +
    "- Ist dem Kunden egal, welche Richtung, oder stimmt er unklar zu, wähle du selbst EINE " +
    "Richtung aus (keine Mischung aus allen) und sag ihm, welche du nimmst.\n" +
    "- Denk mit: du kennst die Branche des Kunden und schlägst Dinge vor, auf die er selbst nicht " +
    "kommt (ein passendes Requisit, ein Kleidungsstück, ein Charakterzug).\n" +
    "- ERST ZEICHNEN, wenn der Kunde einer Richtung zustimmt ('ja', 'das erste', 'mach das', " +
    "'gefällt mir') oder von sich aus sagt, dass es losgehen soll. Dann setzt du bereit auf true " +
    "und schreibst die vollständige Figur-Beschreibung ins Feld prompt.\n" +
    "- Zieht sich das Gespräch, biete nach zwei bis drei Runden von dir aus an, es einfach mal zu " +
    "zeichnen. Der Kunde soll nie das Gefühl haben, im Gespräch festzustecken.\n" +
    "- Bei Änderungswünschen an einer schon gezeichneten Figur: nicht neu brainstormen, sondern " +
    "sofort bereit true und die KOMPLETTE, aktualisierte Beschreibung zurückgeben.\n\n" +
    "SO SPRICHST DU IM FELD \"antwort\":\n" +
    "- Wie ein Mensch, der gern zeichnet. Locker, kurz, höchstens drei Sätze.\n" +
    "- Verwende NIEMALS die Wörter Prompt, Bild-Prompt, Beschreibung, KI oder Eingabe. Zeige dem " +
    "Kunden nie den Text aus dem Feld \"prompt\" und kündige ihn auch nicht an.\n" +
    "- Keine Doppelpunkte am Satzende, keine Aufzählungen, keine Emojis, keine Gedankenstriche.\n\n" +
    "Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown:\n" +
    '{"antwort":"deine Chat-Antwort auf Deutsch, max. 3 Sätze",' +
    '"prompt":"die vollständige Figur-Beschreibung für den Zeichner, sonst leerer String",' +
    '"bereit":true oder false}\n' +
    "Solange ihr noch brainstormt: \"prompt\" MUSS ein leerer String sein und \"bereit\" MUSS " +
    "false sein. Schreib in \"prompt\" niemals einen Platzhalter.\n" +
    (kontext ? "\nKONTEXT zur Firma: " + kontext : "");

  try {
    const { ok, data } = await rufeClaude({
      system,
      messages: nachrichten,
      maxTokens: 500,
      temperature: 0.7,
      timeout: 25000,
    });
    if (!ok) return json(502, { error: "KI gerade nicht erreichbar. Versuch es gleich nochmal." });

    let txt = (data.content?.[0]?.text || "{}").replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    if (a >= 0 && b > a) txt = txt.slice(a, b + 1);
    let erg;
    try {
      erg = JSON.parse(txt);
    } catch {
      // Ein einziges unmaskiertes Anführungszeichen im Fliesstext hat sonst zur
      // Folge, dass der Kunde eine belanglose Ersatzantwort bekommt. Die Felder
      // stehen immer in derselben Reihenfolge, darum fischen wir sie notfalls
      // über ihre Nachbarn aus dem Rohtext.
      const sauber = (m) => (m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() : "");
      erg = {
        antwort: sauber(/"antwort"\s*:\s*"([\s\S]*?)"\s*,\s*"prompt"/.exec(txt)),
        prompt: sauber(/"prompt"\s*:\s*"([\s\S]*?)"\s*,\s*"bereit"/.exec(txt)),
        bereit: /"bereit"\s*:\s*true/.test(txt),
      };
    }

    const str = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
    const prompt = str(erg.prompt, 500);

    // Gezeichnet wird erst, wenn der Kunde einer Richtung zugestimmt hat. Auf die
    // allererste Nachricht wird NIE gezeichnet, egal was das Modell meldet: da
    // gehört das gemeinsame Überlegen hin, sonst kostet jede halbe Idee ein Bild.
    const ersteRunde = nachrichten.filter((n) => n.role === "user").length < 2;
    const bereit = !!prompt && erg.bereit === true && !ersteRunde;

    // Der Kunde soll NIE die Werkstatt sehen. Rutscht dem Modell trotz Anweisung
    // ein "hier kommt dein Bild-Prompt:" durch, ersetzen wir den Satz hart. Der
    // Ersatztext muss zum Zustand passen: "ich zeichne jetzt" darf nur stehen,
    // wenn auch wirklich gezeichnet wird.
    let antwort = str(erg.antwort, 400);
    if (!antwort || /\b(prompt|bild-?prompt|eingabe(text)?)\b/i.test(antwort)) {
      antwort = bereit
        ? "Alles klar, ich zeichne sie dir jetzt."
        : "Erzähl mir noch kurz, in welche Richtung es gehen soll.";
    }
    // Ankündigungen, die auf einen nachfolgenden Text zeigen ("... folgendermassen:"),
    // enden ins Leere, weil der Prompt gar nicht angezeigt wird.
    antwort = antwort.replace(/\s*:\s*$/, ".");
    antwort = antwort.replace(/\s+[–—]\s+/g, ", "); // Gedankenstriche gibt es hier nicht

    return json(200, { antwort, prompt: bereit ? prompt : "", bereit });
  } catch {
    return json(502, { error: "KI gerade nicht erreichbar." });
  }
};
