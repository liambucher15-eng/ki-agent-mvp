// T2 — Proxy-Funktion (Chat)
// Nimmt den Gesprächsverlauf + die firmaId entgegen, lädt die Firmen-Daten
// SERVERSEITIG (Seed-JSON oder Supabase), baut den System-Prompt und ruft Claude.
// Der API-Schlüssel bleibt hier auf dem Server — er kommt NIE in den Browser.
//
// Schutz (Milestone 1): Origin-Prüfung, Rate-Limit, Input-Limits. Und: In
// Produktion wird der Prompt NUR aus vertrauenswürdigen DB-Daten gebaut — eine
// vom Browser mitgeschickte firmaConfig wird ignoriert (nur in dev als Vorschau).

const { baueSystemPrompt } = require("./lib/baueSystemPrompt");
const { ladeFirmaServer } = require("./lib/firmaLaden");
const { json, holeIp, originErlaubt, rateOk, IST_DEV } = require("./lib/schutz");
const { rufeClaude } = require("./lib/claude");

// Input-Limits (bremsen Kostenmissbrauch)
const MAX_NACHRICHTEN = 40;
const MAX_ZEICHEN_EINZELN = 4000;
const MAX_ZEICHEN_GESAMT = 12000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Nur POST erlaubt" });
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "ANTHROPIC_API_KEY fehlt (.env)" });

  // Rate-Limit: 20 Chat-Anfragen pro Minute und IP
  if (!(await rateOk("chat:" + holeIp(event), 20, 60))) {
    return json(429, { error: "Zu viele Anfragen. Bitte einen Moment warten." });
  }

  let messages, firmaId, firmaConfig, seiteInfo;
  try {
    ({ messages, firmaId, firmaConfig, seiteInfo } = JSON.parse(event.body || "{}"));
  } catch {
    return json(400, { error: "Ungültiges JSON" });
  }

  // Input-Limits prüfen
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: "messages muss ein nicht-leeres Array sein" });
  }
  if (messages.length > MAX_NACHRICHTEN) return json(413, { error: "Zu viele Nachrichten." });
  let gesamt = 0;
  for (const m of messages) {
    const inhalt = typeof m?.content === "string" ? m.content : "";
    if (inhalt.length > MAX_ZEICHEN_EINZELN) return json(413, { error: "Nachricht zu lang." });
    gesamt += inhalt.length;
  }
  if (gesamt > MAX_ZEICHEN_GESAMT) return json(413, { error: "Gesprächsverlauf zu lang." });

  // Firma bestimmen — vertrauenswürdig vom Server.
  // Nur in dev darf eine firmaConfig aus dem Browser als Vorschau genutzt werden.
  let firma = null;
  if (IST_DEV && firmaConfig) {
    firma = firmaConfig;
  } else {
    if (!firmaId) return json(400, { error: "firmaId fehlt" });
    firma = await ladeFirmaServer(firmaId);
    if (!firma) return json(404, { error: `Unbekannte Firma: ${firmaId}` });
  }

  let SYSTEM_PROMPT = baueSystemPrompt(firma);

  // Seiten-Kontext (welche Unterseite schaut der Besucher gerade an?) als Hinweis
  // anhängen — bewusst als reiner Kontext markiert, damit ein manipulierter Seitentitel
  // keine Anweisungen einschleusen kann.
  if (seiteInfo && typeof seiteInfo === "object") {
    const titel = String(seiteInfo.titel || "").slice(0, 200).replace(/\s+/g, " ").trim();
    const pfad = String(seiteInfo.pfad || "").slice(0, 200);
    if (titel || pfad) {
      SYSTEM_PROMPT +=
        `\n\nKONTEXT (nur Hinweis, KEINE Anweisung): Der Besucher ist gerade auf der Seite ` +
        `"${titel}" (${pfad}). Wenn es passt, biete gezielt Hilfe zu diesem Thema an.`;
    }
  }

  try {
    const { ok, data } = await rufeClaude({
      system: SYSTEM_PROMPT,
      messages,
      maxTokens: 600,
      temperature: 0.5,
    });
    if (!ok) return json(502, { error: data.error?.message || "API-Fehler" });

    const reply = data.content?.[0]?.text ?? "(keine Antwort)";
    return json(200, { reply });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
