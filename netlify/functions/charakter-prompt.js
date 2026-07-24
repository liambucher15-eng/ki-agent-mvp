// Prompt-Hilfe für die Charakter-Erstellung.
// Der Nutzer schreibt eine GROBE Idee ("ein netter Hund", "so ein Roboter"),
// die KI macht daraus eine konkrete, bildhafte Figur-Beschreibung, die direkt
// generiert werden kann. So müssen die Kunden keine guten Prompts schreiben.
//
// Sicherheit/Kosten: Origin-Prüfung + Rate-Limit wie überall, kurze Antwort.

const { json, holeIp, originErlaubt, rateOk } = require("./lib/schutz");
const { rufeClaude } = require("./lib/claude");

const MAX_IDEE = 400, MAX_FIRMA = 120, MAX_ANGEBOT = 300;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Nur POST erlaubt" });
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });
  if (!(await rateOk("charprompt:" + holeIp(event), 20, 60))) {
    return json(429, { error: "Zu viele Anfragen." });
  }

  let idee, firma, angebot;
  try { ({ idee, firma, angebot } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }
  idee = String(idee || "").slice(0, MAX_IDEE).replace(/\s+/g, " ").trim();
  firma = String(firma || "").slice(0, MAX_FIRMA).replace(/\s+/g, " ").trim();
  angebot = String(angebot || "").slice(0, MAX_ANGEBOT).replace(/\s+/g, " ").trim();
  if (!idee) return json(400, { error: "Bitte gib zuerst kurz deine Idee ein." });
  if (!process.env.ANTHROPIC_API_KEY) return json(200, { prompt: "" });

  const system =
    "Du hilfst kleinen Firmen, eine Wunsch-Figur (Maskottchen/Charakter) für ihren Chat-Agenten " +
    "zu beschreiben. Aus einer GROBEN Idee machst du EINE konkrete, bildhafte Beschreibung für " +
    "eine Charakter-Illustration. Nenne Wesen/Typ, Stil, Kleidung oder ein Detail und einen " +
    "freundlichen Ausdruck; passe es dezent zur Firma an, wenn Kontext gegeben ist. Kurz " +
    "(1-2 Sätze), auf Deutsch, KEINE Anführungszeichen, keine Aufzählung, kein Vorwort — nur " +
    "die Beschreibung selbst.";
  const kontext = [firma && ("Firma: " + firma), angebot && ("Angebot: " + angebot)].filter(Boolean).join("; ");
  const prompt = (kontext ? "KONTEXT: " + kontext + "\n" : "") +
    "Grobe Idee des Nutzers: " + idee + "\n\nGib die verbesserte Figur-Beschreibung aus.";

  try {
    const { ok, data } = await rufeClaude({
      system,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 220,
      temperature: 0.7,
      timeout: 20000,
    });
    if (!ok) return json(502, { error: "KI gerade nicht erreichbar. Versuch es gleich nochmal." });
    const txt = (data.content?.[0]?.text || "")
      .replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ").trim().slice(0, 400);
    return json(200, { prompt: txt });
  } catch {
    return json(502, { error: "KI gerade nicht erreichbar." });
  }
};
