// Cache für die proaktiven Seiten-Hinweise (Milestone 8) über die Supabase-
// REST-API (Tabelle "seiten_hinweise", Primärschlüssel firma_id+pfad).
// Die /seiten-hinweis-Function generiert den Satz einmal pro Seite und legt ihn
// hier ab — jeder weitere Besucher derselben Seite bekommt ihn ohne API-Kosten.
//
// Service-Key (server-exklusiv, umgeht RLS). Kein npm-Paket — reines fetch.

const URL_BASIS = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";
const TTL_TAGE = 7;

function konfiguriert() {
  return !!URL_BASIS && !!KEY;
}
function kopf() {
  return { "content-type": "application/json", apikey: KEY, authorization: "Bearer " + KEY };
}

// Gecachten Hinweis lesen — null, wenn keiner da oder älter als TTL_TAGE.
async function leseHinweis(firmaId, pfad) {
  if (!konfiguriert()) return null;
  const url = URL_BASIS + "/rest/v1/seiten_hinweise?firma_id=eq." + encodeURIComponent(firmaId) +
    "&pfad=eq." + encodeURIComponent(pfad) + "&select=text,erstellt";
  try {
    const res = await fetch(url, { headers: kopf() });
    if (!res.ok) return null;
    const zeilen = await res.json();
    const z = Array.isArray(zeilen) && zeilen[0];
    if (!z) return null;
    const alter = Date.now() - new Date(z.erstellt).getTime();
    if (alter > TTL_TAGE * 24 * 60 * 60 * 1000) return null; // abgelaufen -> neu generieren
    return z.text || null;
  } catch { return null; }
}

// Hinweis speichern/aktualisieren (Upsert auf firma_id+pfad).
async function setzeHinweis(firmaId, pfad, text) {
  if (!konfiguriert()) return;
  try {
    await fetch(URL_BASIS + "/rest/v1/seiten_hinweise", {
      method: "POST",
      headers: { ...kopf(), prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ firma_id: firmaId, pfad, text, erstellt: new Date().toISOString() }),
    });
  } catch { /* Cache-Fehler sind unkritisch — nächster Aufruf generiert neu */ }
}

module.exports = { leseHinweis, setzeHinweis, konfiguriert };
