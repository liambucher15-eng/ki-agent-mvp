// Kleiner Job-Speicher über die Supabase-REST-API (Tabelle "scan_jobs").
// Die Background-Function schreibt hier das Scan-Ergebnis, die Status-Function
// liest es. So teilen sich zwei getrennte Function-Aufrufe denselben Zustand —
// lokal (netlify dev) wie live identisch.
//
// Nutzt bevorzugt den SERVICE-Key (nur serverseitig, umgeht RLS) — seit der
// Milestone-0-Migration hat scan_jobs KEINE offenen Policies mehr, d.h. nur noch
// der Server darf schreiben/lesen. Fallback anon-Key nur für alte Setups.
// Kein zusätzliches npm-Paket nötig — reines fetch gegen PostgREST.

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
  };
}

// Job anlegen/aktualisieren (Upsert auf den Primärschlüssel id).
async function setzeJob(id, felder) {
  if (!konfiguriert()) throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY fehlen (.env)");
  const res = await fetch(URL_BASIS + "/rest/v1/scan_jobs", {
    method: "POST",
    headers: { ...kopf(), prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id, ...felder }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Job speichern fehlgeschlagen (" + res.status + "): " + t.slice(0, 200));
  }
}

// Job lesen — gibt { status, ergebnis, fehler, probe, fragen } zurück oder null,
// wenn (noch) nicht vorhanden. probe/fragen stammen aus migration-probe.sql.
async function leseJob(id) {
  if (!konfiguriert()) throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY fehlen (.env)");
  const url = URL_BASIS + "/rest/v1/scan_jobs?id=eq." + encodeURIComponent(id) + "&select=status,ergebnis,fehler,probe,fragen";
  const res = await fetch(url, { headers: kopf() });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Job lesen fehlgeschlagen (" + res.status + "): " + t.slice(0, 200));
  }
  const zeilen = await res.json();
  return Array.isArray(zeilen) && zeilen.length ? zeilen[0] : null;
}

// Alte Jobs löschen (älter als 1 Tag). Wird von der Background-Function bei jedem
// Scan nebenbei aufgerufen — so wächst die Tabelle nicht unbegrenzt, ganz ohne Cron.
// Fehler sind unkritisch (nächster Scan räumt wieder auf).
async function raeumeAlteJobs() {
  if (!konfiguriert()) return;
  const grenze = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    await fetch(URL_BASIS + "/rest/v1/scan_jobs?erstellt=lt." + encodeURIComponent(grenze), {
      method: "DELETE",
      headers: kopf(),
    });
  } catch { /* beim nächsten Mal */ }
}

// Zählt EINE Frage für einen Probefahrt-Job und sagt, ob sie gewährt wird.
//
// Warum das eine Datenbank-Function ist und kein leseJob/setzeJob-Paar: Der
// Zähler ist der eigentliche Kostendeckel der öffentlichen Probefahrt. Läse man
// erst den Stand und schriebe ihn dann zurück, kämen drei gleichzeitig
// abgeschickte Fragen alle durch — alle drei sähen dieselbe 0. probe_frage_zaehlen
// erhöht und prüft in einer einzigen UPDATE-Anweisung (migration-probe.sql).
//
// Gibt { ok, stand, uebrig } zurück. ok=false heisst: Job unbekannt, keine
// Probefahrt, noch nicht fertig gescannt, oder Kontingent aufgebraucht. Welcher
// Fall es war, verrät die Function bewusst nicht — der Aufrufer soll fremde
// jobIds nicht durchprobieren können.
async function zaehleProbeFrage(id, grenze) {
  if (!konfiguriert()) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_KEY fehlen (.env)");
  const res = await fetch(URL_BASIS + "/rest/v1/rpc/probe_frage_zaehlen", {
    method: "POST",
    headers: kopf(),
    body: JSON.stringify({ job_id: id, grenze }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Fragen-Zähler fehlgeschlagen (" + res.status + "): " + t.slice(0, 200));
  }
  const stand = Number(await res.json());
  // Ein fehlgeschlagener Zählversuch darf NIE als Erlaubnis durchgehen: Alles,
  // was nicht eindeutig eine gültige Zahl im erlaubten Bereich ist, ist ein Nein.
  if (!Number.isFinite(stand) || stand < 1 || stand > grenze) return { ok: false, stand: grenze, uebrig: 0 };
  return { ok: true, stand, uebrig: grenze - stand };
}

module.exports = { setzeJob, leseJob, konfiguriert, raeumeAlteJobs, zaehleProbeFrage };
