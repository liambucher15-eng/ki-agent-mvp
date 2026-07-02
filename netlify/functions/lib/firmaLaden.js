// Lädt die Firmen-Daten SERVERSEITIG (vertrauenswürdig):
//   1) Seed-Firmen aus data/*.json (salbei, nordlicht)
//   2) sonst aus der Supabase-Tabelle "firmen" (per Onboarding angelegt)
//
// Wichtig fürs Sicherheitsmodell: Der System-Prompt wird aus DIESEN Daten gebaut,
// nicht aus etwas, das der Browser mitschickt. So kann kein Besucher dem Agenten
// eine fremde Persönlichkeit/Anweisung unterschieben.

const { ladeFirma: ladeSeed } = require("./firmen");

const URL_BASIS = process.env.SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || "";

async function ladeFirmaServer(id) {
  if (!id) return null;
  const seed = ladeSeed(id);
  if (seed) return seed;

  if (!URL_BASIS || !ANON) return null;
  try {
    const res = await fetch(
      URL_BASIS + "/rest/v1/firmen?id=eq." + encodeURIComponent(id) + "&select=daten",
      { headers: { apikey: ANON, authorization: "Bearer " + ANON } }
    );
    if (!res.ok) return null;
    const zeilen = await res.json();
    return Array.isArray(zeilen) && zeilen.length ? zeilen[0].daten : null;
  } catch {
    return null;
  }
}

module.exports = { ladeFirmaServer };
