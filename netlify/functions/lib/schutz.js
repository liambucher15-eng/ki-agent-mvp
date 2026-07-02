// Geteilte Schutz-Helfer für die öffentlichen Functions:
//   - json(): einheitliche JSON-Antwort
//   - holeIp(): Client-IP aus den Netlify-Headern
//   - originErlaubt(): blockt fremde Origins (Same-Origin + Allowlist)
//   - rateOk(): Rate-Limit über eine Supabase-RPC (fail-open, wenn nicht konfiguriert)
//
// Rate-Limit und Origin sind zusätzliche Schichten. Die WICHTIGSTE Bremse gegen
// Kostenmissbrauch sind die Input-Limits direkt in den einzelnen Functions.

const URL_BASIS = process.env.SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || "";
const IST_DEV = process.env.NETLIFY_DEV === "true";

function json(statusCode, obj, extraHeaders) {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...(extraHeaders || {}) },
    body: JSON.stringify(obj),
  };
}

function holeIp(event) {
  const h = event.headers || {};
  return (
    h["x-nf-client-connection-ip"] ||
    (h["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unbekannt"
  );
}

// Erlaubt Same-Origin-Aufrufe (Browser sendet Origin = eigene Domain) sowie
// optionale Extra-Origins aus ERLAUBTE_ORIGINS. Ohne Origin (curl/Server) -> ok,
// da greift stattdessen das Rate-Limit. In dev alles erlaubt.
function originErlaubt(event) {
  const h = event.headers || {};
  const origin = h.origin || h.Origin || "";
  if (!origin || IST_DEV) return true;
  try {
    const oHost = new URL(origin).host;
    const host = h.host || h.Host || "";
    if (host && oHost === host) return true; // Same-Origin
  } catch { /* kaputter Origin -> fällt auf Allowlist zurück */ }
  const erlaubt = (process.env.ERLAUBTE_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return erlaubt.includes(origin);
}

// true = Anfrage erlaubt. Nutzt die Postgres-Funktion rate_hit (siehe schema.sql).
// Fail-open: Ist Supabase/die RPC nicht verfügbar, wird NICHT blockiert (der Chat
// soll nicht wegen eines fehlenden Limits ausfallen).
async function rateOk(kennung, limit, fensterSek) {
  if (!URL_BASIS || !ANON) return true;
  try {
    const res = await fetch(URL_BASIS + "/rest/v1/rpc/rate_hit", {
      method: "POST",
      headers: { "content-type": "application/json", apikey: ANON, authorization: "Bearer " + ANON },
      body: JSON.stringify({ p_key: kennung, p_limit: limit, p_fenster: fensterSek }),
    });
    if (!res.ok) return true;
    return (await res.json()) === true;
  } catch { return true; }
}

module.exports = { json, holeIp, originErlaubt, rateOk, IST_DEV };
