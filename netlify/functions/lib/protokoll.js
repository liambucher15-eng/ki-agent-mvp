// Schreibt Gespräche und Kontaktanfragen (Leads) serverseitig in Supabase.
// Nutzt den SERVICE-Key (umgeht RLS) — die Tabellen sind sonst nur vom
// Firmen-Besitzer LESBAR, geschrieben wird ausschliesslich hier.
// Reines fetch gegen PostgREST, kein npm-Paket nötig. Fehler sind unkritisch
// (der Chat soll nicht scheitern, nur weil das Loggen hakt) -> fail-safe.

const URL_BASIS = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";

function konfiguriert() {
  return !!URL_BASIS && !!KEY;
}
function kopf() {
  return {
    "content-type": "application/json",
    apikey: KEY,
    authorization: "Bearer " + KEY,
    prefer: "return=minimal",
  };
}
async function einfuegen(tabelle, zeile) {
  if (!konfiguriert()) return;
  try {
    await fetch(URL_BASIS + "/rest/v1/" + tabelle, {
      method: "POST",
      headers: kopf(),
      body: JSON.stringify(zeile),
    });
  } catch (e) {
    console.error("protokoll: " + tabelle + " schreiben fehlgeschlagen:", e.message);
  }
}

// Ein Gespräch (letzte Frage + Antwort) mitschreiben. Datensparsam: nur Text +
// Seite, keine IP, kein Name. Längen gekappt, damit die Tabelle klein bleibt.
async function speichereGespraech(firmaId, frage, antwort, seite) {
  if (!firmaId || !frage) return;
  await einfuegen("gespraeche", {
    firma_id: String(firmaId).slice(0, 80),
    frage: String(frage).slice(0, 2000),
    antwort: String(antwort || "").slice(0, 4000),
    seite: String(seite || "").slice(0, 200) || null,
  });
}

// Eine Kontaktanfrage (Lead) speichern — kommt aus dem Tool "kontakt_hinterlassen".
async function speichereKontakt(firmaId, { name, kontakt, nachricht }) {
  if (!firmaId || !nachricht) return;
  await einfuegen("kontaktanfragen", {
    firma_id: String(firmaId).slice(0, 80),
    name: name ? String(name).slice(0, 200) : null,
    kontakt: kontakt ? String(kontakt).slice(0, 200) : null,
    nachricht: String(nachricht).slice(0, 2000),
  });
}

module.exports = { speichereGespraech, speichereKontakt, konfiguriert };
