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
      // erstellt kommt mit, weil daraus das Ende des Testzeitraums gerechnet
      // wird (lib/testzeit.js). Ein eigenes Ablauf-Feld waere eine zweite
      // Wahrheit, die mit dieser auseinanderlaufen kann.
      URL_BASIS + "/rest/v1/firmen?id=eq." + encodeURIComponent(id) + "&select=daten,plan,erstellt",
      { headers: { apikey: KEY, authorization: "Bearer " + KEY } }
    );
    if (!res.ok) return null;
    const zeilen = await res.json();
    if (!Array.isArray(zeilen) || !zeilen.length) return null;
    // plan kommt aus der EIGENEN Spalte (Server-Wahrheit, künftig Stripe) und
    // überschreibt einen evtl. noch im JSONB liegenden Wert.
    const { daten, plan, erstellt } = zeilen[0];
    return { ...daten, plan: plan || daten.plan || "basis", erstellt: erstellt || null };
  } catch {
    return null;
  }
}

// Traegt das bezahlte Abo beim NUTZER ein (nur Server, via Service-Key).
//
// Warum nicht mehr direkt auf firmen.plan:
//  Der Kunde bezahlt, bevor er seinen Agenten einrichtet — in diesem Moment gibt
//  es noch keine Firma. Das Abo haengt deshalb am Clerk-Nutzer (Tabelle abos),
//  und ein Trigger uebertraegt den Plan auf jede Firma, die dieser Nutzer anlegt
//  (migration-abo.sql). Ein zweiter Trigger schreibt Aenderungen sofort auf
//  bestehende Firmen durch, damit eine Kuendigung nicht erst wirkt, wenn der
//  Kunde zufaellig etwas speichert.
//
//  Der frueher hier stehende PATCH auf firmen.plan waere heute WIRKUNGSLOS: Der
//  Trigger setzt plan bei jedem Schreibvorgang aus abos und haette die Zahlung
//  im selben Atemzug verworfen.
//
// prefer: resolution=merge-duplicates macht daraus ein Upsert — der zweite
// Kauf desselben Nutzers aktualisiert seine Zeile, statt am Primaerschluessel
// zu scheitern.
async function setzeAboServer(nutzer, plan, stripeKunde) {
  if (!nutzer || !URL_BASIS || !KEY) return false;
  const zeile = { nutzer, plan, aktualisiert: new Date().toISOString() };
  if (stripeKunde) zeile.stripe_kunde = stripeKunde;
  try {
    const res = await fetch(URL_BASIS + "/rest/v1/abos", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: KEY,
        authorization: "Bearer " + KEY,
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(zeile),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Das Abo eines Nutzers lesen (Server, Service-Key).
//
// Gebraucht vom Kundenportal: Die Stripe-Kunden-ID darf NICHT aus dem Browser
// kommen — wer eine fremde mitschickte, saehe sonst fremde Rechnungen und
// Zahlungsmittel. Der Browser sagt nur, wer er ist; die Zuordnung macht die
// Datenbank.
async function holeAboServer(nutzer) {
  if (!nutzer || !URL_BASIS || !KEY) return null;
  try {
    const res = await fetch(
      URL_BASIS + "/rest/v1/abos?nutzer=eq." + encodeURIComponent(nutzer) + "&select=plan,firma,stripe_kunde",
      { headers: { apikey: KEY, authorization: "Bearer " + KEY } }
    );
    if (!res.ok) return null;
    const zeilen = await res.json();
    return Array.isArray(zeilen) && zeilen.length ? zeilen[0] : null;
  } catch {
    return null;
  }
}

// Findet den Nutzer ueber die gespeicherte Stripe-Kunden-ID (der Kuendigungs-
// Webhook liefert nur die customer-ID, wenn die Metadaten fehlen).
async function nutzerZuStripeKunde(stripeKunde) {
  if (!stripeKunde || !URL_BASIS || !KEY) return null;
  try {
    const res = await fetch(
      URL_BASIS + "/rest/v1/abos?stripe_kunde=eq." + encodeURIComponent(stripeKunde) + "&select=nutzer",
      { headers: { apikey: KEY, authorization: "Bearer " + KEY } }
    );
    if (!res.ok) return null;
    const zeilen = await res.json();
    return Array.isArray(zeilen) && zeilen.length ? zeilen[0].nutzer : null;
  } catch {
    return null;
  }
}

// Wem gehoert diese Firma? Nur fuer den Rueckwaertsgang im Webhook: Eine
// Checkout-Session aus der Zeit VOR dieser Umstellung kennt nur firma_id.
// Ohne diese Bruecke liefe eine solche Zahlung ins Leere.
async function besitzerVonFirma(firmaId) {
  if (!firmaId || !URL_BASIS || !KEY) return null;
  try {
    const res = await fetch(
      URL_BASIS + "/rest/v1/firmen?id=eq." + encodeURIComponent(firmaId) + "&select=besitzer",
      { headers: { apikey: KEY, authorization: "Bearer " + KEY } }
    );
    if (!res.ok) return null;
    const zeilen = await res.json();
    return Array.isArray(zeilen) && zeilen.length ? zeilen[0].besitzer : null;
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

module.exports = { ladeFirmaServer, setzeAboServer, holeAboServer, nutzerZuStripeKunde, besitzerVonFirma, zaehleAntwort };
