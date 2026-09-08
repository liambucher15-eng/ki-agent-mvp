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

// ── Einbettung auf der Kunden-Domain ────────────────────────────────────────
// Das Widget ist GENAU DAFÜR gebaut, auf fremden Domains zu laufen: eine Zeile
// im Quelltext des Kunden, danach läuft es auf seiner Seite. Für solche Aufrufe
// ist originErlaubt() oben zwangsläufig falsch — die Kunden-Domain ist weder
// Same-Origin noch steht sie in ERLAUBTE_ORIGINS.
//
// ERLAUBTE_ORIGINS kann das auch nicht lösen: Dort müsste bei JEDEM neuen
// Kunden von Hand eine Domain nachgetragen und neu deployt werden. Bis dahin
// bekäme jeder frisch eingerichtete Agent ein stilles 403 — also genau der
// Fall, der hier zu prüfen war.
//
// Die Freigabe pflegt sich deshalb selbst: Im Onboarding gibt der Kunde seine
// Webseite an (onboarding.js speichert sie als firma.webseite), und genau diese
// Domain darf seinen Agenten aufrufen. Wer nur die firmaId abschreibt und das
// Widget auf einer fremden Seite einbettet, bleibt draussen.
function originPasstZuFirma(event, firma) {
  const h = event.headers || {};
  const origin = h.origin || h.Origin || "";
  const webseite = (firma && firma.webseite) || "";
  if (!origin || !webseite) return false;
  try {
    const oHost = new URL(origin).host.toLowerCase();
    // Die hinterlegte Webseite kann mit oder ohne Protokoll gespeichert sein —
    // "example.ch" genauso wie "https://www.example.ch/ueber-uns".
    const wHost = new URL(/^https?:\/\//i.test(webseite) ? webseite : "https://" + webseite)
      .host.toLowerCase();
    if (!oHost || !wHost) return false;
    // www. ist dieselbe Seite. Ohne diese Normalisierung scheitert der
    // häufigste Fall überhaupt: eingetragen "example.ch", eingebettet auf
    // "www.example.ch".
    const ohneWww = (x) => x.replace(/^www\./, "");
    return ohneWww(oHost) === ohneWww(wHost);
  } catch {
    return false;
  }
}

// CORS-Kopfzeilen für Aufrufe von der Kunden-Domain.
//
// Der Origin wird zurückgespiegelt statt "*", weil "*" zusammen mit
// Anmeldedaten nicht erlaubt wäre und wir uns diese Tür nicht zubauen wollen.
// Vary: Origin ist dabei Pflicht — sonst könnte ein Cache die Antwort für
// Domain A an Domain B ausliefern.
function corsKopf(event) {
  const h = event.headers || {};
  const origin = h.origin || h.Origin || "";
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "vary": "Origin",
  };
}

// Antwort auf den Vorab-Check des Browsers (OPTIONS).
//
// Ein POST mit content-type: application/json löst immer einen Preflight aus.
// Ohne Antwort darauf blockiert der Browser die eigentliche Anfrage, noch bevor
// sie den Server erreicht — die Function liefe nie an, egal wie ihre Prüfungen
// aussehen.
//
// Der Preflight wird bewusst für JEDEN Origin bejaht: Er verrät nichts und gibt
// nichts frei, er beantwortet nur "welche Methode/Kopfzeile ist erlaubt". Die
// eigentliche Berechtigung prüft danach die POST-Anfrage selbst
// (originPasstZuFirma), und die kennt die firmaId, die dem Preflight fehlt.
function preflightAntwort(event) {
  return {
    statusCode: 204,
    headers: {
      ...corsKopf(event),
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
    body: "",
  };
}

// Ein Treffer auf den Zähler. Wirft, wenn die RPC nicht erreichbar ist — die
// beiden Hüllen darunter entscheiden, was in diesem Fall gilt.
async function rateHit(kennung, limit, fensterSek) {
  const res = await fetch(URL_BASIS + "/rest/v1/rpc/rate_hit", {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON, authorization: "Bearer " + ANON },
    body: JSON.stringify({ p_key: kennung, p_limit: limit, p_fenster: fensterSek }),
  });
  if (!res.ok) throw new Error("rate_hit antwortete " + res.status);
  return (await res.json()) === true;
}

// true = Anfrage erlaubt. Nutzt die Postgres-Funktion rate_hit (siehe schema.sql).
// Fail-open: Ist Supabase/die RPC nicht verfügbar, wird NICHT blockiert.
//
// Das ist für die billigen Endpunkte richtig — scan-status etwa soll nicht
// ausfallen, bloss weil ein Zähler klemmt. Für alles, was Geld kostet, gibt es
// darunter rateOkStreng().
async function rateOk(kennung, limit, fensterSek) {
  if (!URL_BASIS || !ANON) return true;
  try { return await rateHit(kennung, limit, fensterSek); }
  catch { return true; }
}

// Wie rateOk, aber FAIL-CLOSED: Ist der Zähler nicht erreichbar, wird
// abgelehnt.
//
// Für Endpunkte, hinter denen ein bezahlter Modellaufruf steht (chat.js,
// charakter-background.js). Fällt Supabase aus, gilt sonst gar kein Limit mehr
// — ausgerechnet in dem Moment, in dem niemand hinschaut. Ein paar Minuten
// "Bitte gleich nochmal" sind billiger als eine offene Rechnung.
//
// Dasselbe Muster steht schon in chat.js beim Probefahrt-Zähler, mit derselben
// Begründung.
async function rateOkStreng(kennung, limit, fensterSek) {
  if (!URL_BASIS || !ANON) {
    // Ohne konfigurierten Speicher gibt es keinen Zähler — dann greift diese
    // Bremse gar nicht, und das soll auffallen.
    if (IST_DEV) return true;
    sicherheitsLog("rate", "Zähler nicht konfiguriert, strenge Prüfung abgelehnt");
    return false;
  }
  try { return await rateHit(kennung, limit, fensterSek); }
  catch (e) {
    sicherheitsLog("rate", "Zähler nicht erreichbar (" + e.message + ") -> abgelehnt: " + kennung);
    return false;
  }
}

// ── Sicherheits-Ereignisse protokollieren ───────────────────────────────────
//
// Abgewiesene Herkunft, gerissene Limits, ungültige Signaturen: All das
// verschwand bisher spurlos. Wer nicht mitschreibt, merkt einen Angriff erst
// an der Rechnung.
//
// Einheitlicher Präfix, damit die Netlify-Logsuche eine Handhabe hat:
//   SICHERHEIT <bereich>: <text>
// Bewusst nur console.error und kein Fremddienst — es soll nichts kosten und
// nichts ausfallen können.
function sicherheitsLog(bereich, text) {
  console.error("SICHERHEIT " + bereich + ": " + text);
}

// ── Fehler, die der Browser NICHT erfahren soll ─────────────────────────────
//
// Vorher gaben chat.js, abo-checkout.js und abo-portal.js die rohe
// Fehlermeldung an den Browser weiter. Darin stehen Stripe- und
// Anthropic-Interna: welche Bibliothek, welcher Endpunkt, manchmal Teile der
// Konfiguration. Für den Besucher nutzlos, für einen Angreifer eine Landkarte.
//
// Stattdessen: Der Grund bleibt im Log, der Browser bekommt eine Kennung. Wer
// anruft, nennt die Kennung, und im Log steht sie daneben.
function serverFehler(bereich, e, text) {
  const kennung = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error("FEHLER " + bereich + " [" + kennung + "]:", (e && e.stack) || e);
  return json(500, {
    error: text || "Da ist etwas schiefgelaufen. Bitte später nochmal.",
    kennung,
  });
}

module.exports = {
  json, holeIp, originErlaubt, rateOk, rateOkStreng, IST_DEV,
  originPasstZuFirma, corsKopf, preflightAntwort,
  sicherheitsLog, serverFehler,
};
