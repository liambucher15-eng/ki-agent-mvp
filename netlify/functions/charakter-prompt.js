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
    "Du bist ein freundlicher Charakter-Designer. Du hilfst einer kleinen Firma, die Wunsch-Figur " +
    "(Maskottchen) für ihren Chat-Agenten zu entwickeln. Der Kunde beschreibt seine Idee in " +
    "eigenen Worten, du machst daraus die Figur.\n\n" +
    "So arbeitest du:\n" +
    "- ZEICHNE SOFORT. Auch wenn die Idee sehr grob ist, ergänze die fehlenden Details selbst " +
    "(Stil, Farbe, ein passendes Merkmal) und lege los. Der Kunde sieht dann ein Bild und kann " +
    "danach sagen, was anders soll. Das ist immer besser als eine Rückfrage.\n" +
    "- Nur wenn die Nachricht überhaupt keine Idee enthält (z.B. nur 'hallo'), stell EINE kurze " +
    "Frage und mach dabei gleich einen konkreten Vorschlag.\n" +
    "- Bei Änderungswünschen: gib die KOMPLETTE, aktualisierte Beschreibung zurück, nicht nur die " +
    "Änderung.\n\n" +
    "SO SPRICHST DU IM FELD \"antwort\":\n" +
    "- Wie ein Zeichner, nicht wie ein Werkzeug. Sag in EINEM Satz, WAS du gleich zeichnest, " +
    "z.B. \"Alles klar, ich zeichne dir einen freundlichen Hund mit Bäckermütze.\"\n" +
    "- Verwende NIEMALS die Wörter Prompt, Bild-Prompt, Beschreibung, KI oder Eingabe. Zeige dem " +
    "Kunden nie den Text aus dem Feld \"prompt\" und kündige ihn auch nicht an.\n" +
    "- Keine Doppelpunkte am Satzende, keine Aufzählungen, keine Emojis, keine Gedankenstriche.\n\n" +
    "Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown:\n" +
    '{"antwort":"ein kurzer Satz, was du jetzt zeichnest (Deutsch)",' +
    '"prompt":"die bildhafte Beschreibung der Figur für den Zeichner, 1 bis 2 Sätze",' +
    '"bereit":true oder false}\n' +
    "Wenn du ausnahmsweise nachfragst: \"prompt\" MUSS ein leerer String sein und " +
    "\"bereit\" MUSS false sein. Schreib in \"prompt\" niemals einen Platzhalter.\n" +
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
    try { erg = JSON.parse(txt); } catch { erg = {}; }

    const str = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
    let antwort = str(erg.antwort, 400) || "Alles klar, ich zeichne sie dir jetzt.";
    const prompt = str(erg.prompt, 500);

    // Der Kunde soll NIE die Werkstatt sehen. Rutscht dem Modell trotz Anweisung
    // ein "hier kommt dein Bild-Prompt:" durch, ersetzen wir den Satz hart.
    if (/\b(prompt|bild-?prompt|eingabe(text)?)\b/i.test(antwort)) {
      antwort = "Alles klar, ich zeichne sie dir jetzt.";
    }
    // Ankündigungen, die auf einen nachfolgenden Text zeigen ("... folgendermassen:"),
    // enden ins Leere, weil der Prompt gar nicht angezeigt wird.
    antwort = antwort.replace(/\s*:\s*$/, ".");
    antwort = antwort.replace(/\s+[–—]\s+/g, ", "); // Gedankenstriche gibt es hier nicht

    // Sobald eine Beschreibung da ist, wird gezeichnet. Nachfragen kosten den
    // Kunden nur Zeit; korrigieren kann er am fertigen Bild sowieso besser.
    // Ausnahme: sagt das Modell ausdrücklich "noch nicht bereit" (nichts als
    // Gruss in der Nachricht), fragt es einmal nach statt ins Blaue zu zeichnen.
    return json(200, { antwort, prompt, bereit: !!prompt && erg.bereit !== false });
  } catch {
    return json(502, { error: "KI gerade nicht erreichbar." });
  }
};
