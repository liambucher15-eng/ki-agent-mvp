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
    "(Maskottchen) für ihren Chat-Agenten zu entwickeln. Der Kunde kann KEINE guten Bild-Prompts " +
    "schreiben — das ist DEIN Job.\n\n" +
    "So arbeitest du:\n" +
    "- Der Kunde beschreibt seine Idee in eigenen Worten, auch sehr grob.\n" +
    "- Fehlt etwas Wichtiges (Wesen/Typ, Stil, ein Merkmal), stell HÖCHSTENS EINE kurze Rückfrage " +
    "und mach gleichzeitig einen konkreten Vorschlag. Frage nie mehrfach dasselbe.\n" +
    "- Sobald du genug hast (im Zweifel lieber früher), schreibe den fertigen Bild-Prompt: eine " +
    "konkrete, bildhafte Beschreibung der Figur (Wesen, Stil, Kleidung/Detail, freundlicher " +
    "Ausdruck), 1 bis 2 Sätze, auf Deutsch. Passe sie dezent zur Firma an, wenn Kontext da ist.\n" +
    "- Bei Änderungswünschen: gib den KOMPLETTEN, aktualisierten Prompt zurück, nicht nur die Änderung.\n\n" +
    "Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown:\n" +
    '{"antwort":"kurze, freundliche Chat-Antwort (max. 2 Sätze, Deutsch)",' +
    '"prompt":"der fertige Bild-Prompt oder leerer String, wenn du noch nachfragst",' +
    '"bereit":true oder false}\n' +
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
    const antwort = str(erg.antwort, 400) || "Erzähl mir etwas mehr über deine Idee.";
    const prompt = str(erg.prompt, 500);
    return json(200, { antwort, prompt, bereit: !!erg.bereit && !!prompt });
  } catch {
    return json(502, { error: "KI gerade nicht erreichbar." });
  }
};
