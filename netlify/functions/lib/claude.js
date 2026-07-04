// Zentraler Claude-Aufruf für alle Functions (Chat, Scan, Dokument-Lesen).
// EINE Stelle für Modell, API-Version und Timeout-Handling — Modellwechsel ist
// damit eine Ein-Zeilen-Änderung, und ein späteres Kosten-Logging pro Mandant
// hat hier seinen natürlichen Platz.

const MODELL = "claude-haiku-4-5-20251001"; // günstig + schnell; mehr Qualität: claude-sonnet-5

// Ruft die Messages-API auf. Gibt { ok, status, data } zurück — die Fehler-
// Behandlung (HTTP-Antwort bauen vs. werfen) bleibt bewusst beim Aufrufer,
// weil sie sich je Function unterscheidet.
// Bei Zeitüberschreitung wirft fetch einen AbortError (wie bisher).
async function rufeClaude({ system, messages, maxTokens = 600, temperature = 0.5, timeout = 25000 }) {
  const body = { model: MODELL, max_tokens: maxTokens, temperature, messages };
  if (system) body.system = system;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(t);
  }
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

module.exports = { rufeClaude, MODELL };
