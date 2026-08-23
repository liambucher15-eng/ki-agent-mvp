// Zentraler Claude-Aufruf für alle Functions (Chat, Scan, Dokument-Lesen).
// EINE Stelle für Modell, API-Version und Timeout-Handling — Modellwechsel ist
// damit eine Ein-Zeilen-Änderung, und ein späteres Kosten-Logging pro Mandant
// hat hier seinen natürlichen Platz.

const MODELL = "claude-haiku-4-5-20251001"; // günstig + schnell; mehr Qualität: claude-sonnet-5

// Ruft die Messages-API auf. Gibt { ok, status, data } zurück — die Fehler-
// Behandlung (HTTP-Antwort bauen vs. werfen) bleibt bewusst beim Aufrufer,
// weil sie sich je Function unterscheidet.
// Bei Zeitüberschreitung wirft fetch einen AbortError (wie bisher).
// Ab wann sich Caching ueberhaupt einschaltet. Modellabhaengig und NICHT
// verhandelbar: Haiku 4.5 verlangt 4096 Tokens, Haiku 3.5 verlangte 2048,
// Sonnet/Opus 1024. Liegt der Prompt darunter, wird die Anfrage ohne Caching
// verarbeitet — ohne Fehler, ohne Hinweis.
const CACHE_MINIMUM_TOKENS = 4096;

// Grobe Schaetzung, absichtlich konservativ (~3.6 Zeichen je Token fuer
// deutschen Text; englischer Text liegt eher bei 4). Sie dient nur der
// Protokollzeile, nicht der Abrechnung — die echte Zahl steht in data.usage.
const schaetzeTokens = (s) => Math.round(String(s || "").length / 3.6);

async function rufeClaude({ system, messages, maxTokens = 600, temperature = 0.5, timeout = 25000, tools }) {
  const body = { model: MODELL, max_tokens: maxTokens, temperature, messages };

  // Prompt-Caching fuer den System-Prompt.
  //
  // WAS ES HEUTE BRINGT: nichts. Gemessen liegen die echten System-Prompts bei
  // 858 bis 2590 Tokens (nordlicht bis aurachat), die Schwelle bei Haiku 4.5
  // liegt aber bei 4096. Die Anfrage laeuft dann einfach ungecacht durch.
  //
  // WARUM ES TROTZDEM DRINSTEHT: Es kostet nichts und schaltet sich von selbst
  // ein, sobald ein Kunde genug Wissen hinterlegt — eigene Dokumente, ein
  // groesserer Scan, eine lange FAQ. Genau die Kunden, bei denen es sich lohnt,
  // sind die mit den langen Prompts. Ohne diese Zeilen muesste jemand daran
  // denken, sie nachzuruesten; mit ihnen passiert es automatisch.
  //
  // Der Block deckt tools UND system ab: Die Reihenfolge im Cache-Praefix ist
  // tools -> system -> messages, ein Haltepunkt am System-Prompt schliesst die
  // Werkzeuge davor also mit ein.
  if (system) {
    body.system = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
  }
  if (tools && tools.length) body.tools = tools;

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

  // Verbrauch protokollieren. Ohne das ist jede Aussage ueber Kosten geraten —
  // und Preisentscheidungen wuerden auf Schaetzungen beruhen statt auf Zahlen.
  // "cache" zeigt zugleich, OB das Caching oben greift: Stehen beide Werte auf
  // 0, war der Prompt unter der Schwelle.
  const v = data && data.usage;
  if (v) {
    console.log(JSON.stringify({
      claude: MODELL,
      ein: v.input_tokens || 0,
      aus: v.output_tokens || 0,
      cacheGeschrieben: v.cache_creation_input_tokens || 0,
      cacheGelesen: v.cache_read_input_tokens || 0,
      systemGeschaetzt: schaetzeTokens(system),
      cacheAktiv: (v.cache_creation_input_tokens || 0) + (v.cache_read_input_tokens || 0) > 0,
    }));
  }

  return { ok: res.ok, status: res.status, data };
}

module.exports = { rufeClaude, MODELL, CACHE_MINIMUM_TOKENS };
