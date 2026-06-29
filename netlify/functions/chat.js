// T2 — Proxy-Funktion
// Nimmt den Gesprächsverlauf + die firmaId vom Frontend entgegen, lädt die
// passenden Firmen-Daten, baut daraus den System-Prompt und ruft die Claude-API auf.
// Der API-Schlüssel bleibt hier auf dem Server — er kommt NIE in den Browser.

const { ladeFirma } = require("./lib/firmen");
const { baueSystemPrompt } = require("./lib/baueSystemPrompt");

exports.handler = async (event) => {
  // kleine Hilfe: immer sauberes JSON zurückgeben
  const json = (statusCode, obj) => ({
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  });

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Nur POST erlaubt" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: "ANTHROPIC_API_KEY fehlt — Umgebungsvariable setzen (.env)" });
  }

  let messages, firmaId, firmaConfig;
  try {
    ({ messages, firmaId, firmaConfig } = JSON.parse(event.body || "{}"));
  } catch {
    return json(400, { error: "Ungültiges JSON" });
  }

  // Welche Firma?
  // a) firmaConfig = ein Entwurf direkt vom Browser (Onboarding/Vorschau).
  //    HINWEIS: nur Prototyp — in Produktion baut der Server den Prompt aus der
  //    Datenbank der angemeldeten Firma, nicht aus Client-Daten.
  // b) sonst firmaId -> data/<firmaId>.json über die Registry (Seed-Firmen).
  let firma = firmaConfig || null;
  if (!firma) {
    if (!firmaId) {
      return json(400, { error: "firmaId oder firmaConfig fehlt" });
    }
    firma = ladeFirma(firmaId);
    if (!firma) {
      return json(404, { error: `Unbekannte Firma: ${firmaId}` });
    }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: "messages muss ein nicht-leeres Array sein" });
  }

  // T3 — System-Prompt wird aus den Firmen-Daten gebaut (für alle Firmen gleicher Code).
  const SYSTEM_PROMPT = baueSystemPrompt(firma);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // günstig + schnell; für mehr Qualität: claude-sonnet-4-6
        max_tokens: 600,
        temperature: 0.5,
        system: SYSTEM_PROMPT,
        messages, // [{ role: "user"|"assistant", content: "..." }, ...]
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return json(502, { error: data.error?.message || "API-Fehler" });
    }

    const reply = data.content?.[0]?.text ?? "(keine Antwort)";
    return json(200, { reply });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
