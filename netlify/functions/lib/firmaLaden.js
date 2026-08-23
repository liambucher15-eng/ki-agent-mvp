// Lädt die Firmen-Daten SERVERSEITIG (vertrauenswürdig):
//   1) Seed-Firmen aus data/*.json (salbei, nordlicht)
//   2) sonst aus der Supabase-Tabelle "firmen" (per Onboarding angelegt)
//
// Wichtig fürs Sicherheitsmodell: Der System-Prompt wird aus DIESEN Daten gebaut,
// nicht aus etwas, das der Browser mitschickt. So kann kein Besucher dem Agenten
// eine fremde Persönlichkeit/Anweisung unterschieben.

const { ladeFirma: ladeSeed } = require("./firmen");

const URL_BASIS = process.env.SUPABASE_URL || "";
// Bevorzugt der SERVICE-Key (nur serverseitig, umgeht RLS): Seit der Milestone-0-
// Migration dürfen Anonyme die firmen-Tabelle nicht mehr lesen — der Browser sieht
// Firmendaten nur noch über die gefilterte /firma-Function. Fallback anon-Key,
// damit alte Setups (ohne Migration) weiterlaufen.
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";

async function ladeFirmaServer(id) {
  if (!id) return null;
  const seed = ladeSeed(id);
  if (seed) return seed;

  if (!URL_BASIS || !KEY) return null;
  try {
    const res = await fetch(
      URL_BASIS + "/rest/v1/firmen?id=eq." + encodeURIComponent(id) + "&select=daten,plan",
      { headers: { apikey: KEY, authorization: "Bearer " + KEY } }
    );
    if (!res.ok) return null;
    const zeilen = await res.json();
    if (!Array.isArray(zeilen) || !zeilen.length) return null;
    // plan kommt aus der EIGENEN Spalte (Server-Wahrheit, künftig Stripe) und
    // überschreibt einen evtl. noch im JSONB liegenden Wert.
    const { daten, plan } = zeilen[0];
    return { ...daten, plan: plan || daten.plan || "basis" };
  } catch {
    return null;
  }
}

// Setzt den Plan einer Firma (nur Server, via Service-Key -> umgeht RLS).
// Wird vom Stripe-Webhook gerufen: bezahlt -> "plus", gekündigt -> "basis".
// Optional wird die Stripe-Kunden-ID mitgespeichert (für Kündigungs-Webhooks).
async function setzePlanServer(firmaId, plan, stripeKunde) {
  if (!firmaId || !URL_BASIS || !KEY) return false;
  const felder = { plan };
  if (stripeKunde) felder.stripe_kunde = stripeKunde;
  try {
    const res = await fetch(
      URL_BASIS + "/rest/v1/firmen?id=eq." + encodeURIComponent(firmaId),
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          apikey: KEY,
          authorization: "Bearer " + KEY,
          prefer: "return=minimal",
        },
        body: JSON.stringify(felder),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Findet eine Firma über die gespeicherte Stripe-Kunden-ID (Kündigungs-Webhook
// liefert nur die customer-ID, nicht die firma_id).
async function firmaZuStripeKunde(stripeKunde) {
  if (!stripeKunde || !URL_BASIS || !KEY) return null;
  try {
    const res = await fetch(
      URL_BASIS + "/rest/v1/firmen?stripe_kunde=eq." + encodeURIComponent(stripeKunde) + "&select=id",
      { headers: { apikey: KEY, authorization: "Bearer " + KEY } }
    );
    if (!res.ok) return null;
    const zeilen = await res.json();
    return Array.isArray(zeilen) && zeilen.length ? zeilen[0].id : null;
  } catch {
    return null;
  }
}

// Zaehlt EINE Antwort fuer diese Firma und gibt den neuen Monatsstand zurueck.
//
// Gibt -1 zurueck, wenn nicht gezaehlt werden konnte — bei Seed-Firmen (die
// stehen in data/*.json und haben keine Zeile in der Tabelle), bei fehlender
// Konfiguration oder bei einem Fehler. Der Aufrufer behandelt -1 als
// "unbekannt" und drosselt dann NICHT: Ein ausgefallener Zaehler ist ein
// Problem auf UNSERER Seite und darf keinen zahlenden Kunden ausbremsen.
//
// Absichtlich ohne throw: Der Chat soll nie an der Buchhaltung scheitern.
async function zaehleAntwort(firmaId) {
  if (!firmaId || !URL_BASIS || !KEY) return -1;
  try {
    const res = await fetch(URL_BASIS + "/rest/v1/rpc/antwort_zaehlen", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: KEY,
        authorization: "Bearer " + KEY,
      },
      body: JSON.stringify({ firma_id: firmaId }),
    });
    if (!res.ok) return -1;
    const stand = Number(await res.json());
    return Number.isFinite(stand) ? stand : -1;
  } catch {
    return -1;
  }
}

module.exports = { ladeFirmaServer, setzePlanServer, firmaZuStripeKunde, zaehleAntwort };
