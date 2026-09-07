// Konto-Werkzeuge: alle eigenen Daten ausgeben und alles loeschen.
//
// WARUM ES DAS GIBT
// Bis hierher konnte ein Kunde einzelne Wissensquellen loeschen — sein Konto
// aber nicht. Es gab keinen Weg, die eigenen Daten zu bekommen, und keinen,
// sie loszuwerden. Das ist DSGVO Art. 15 (Auskunft), Art. 17 (Loeschung) und
// Art. 20 (Uebertragbarkeit), und es steht auch auf der App-Checkliste der
// Videos ("account deletion").
//
// ALLES LAEUFT UEBER DEN SERVICE-KEY
// Also an der RLS vorbei. Deshalb ist die Reihenfolge in loescheKonto()
// zwingend: Zuerst wird festgestellt, welche Firmen dem Anmelder wirklich
// gehoeren, und danach wird AUSSCHLIESSLICH auf dieser Liste gearbeitet.
// Niemals auf einer ID, die aus dem Browser kam.

const URL_BASIS = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_KEY || "";

function konfiguriert() {
  return !!URL_BASIS && !!KEY;
}

function kopf(extra) {
  return {
    apikey: KEY,
    authorization: "Bearer " + KEY,
    "content-type": "application/json",
    ...(extra || {}),
  };
}

async function hole(pfad) {
  const res = await fetch(URL_BASIS + "/rest/v1/" + pfad, { headers: kopf() });
  if (!res.ok) throw new Error(pfad.split("?")[0] + " lesen: Status " + res.status);
  return res.json();
}

async function loesche(pfad) {
  const res = await fetch(URL_BASIS + "/rest/v1/" + pfad, { method: "DELETE", headers: kopf() });
  if (!res.ok) throw new Error(pfad.split("?")[0] + " loeschen: Status " + res.status);
}

// PostgREST-Filter fuer "in dieser Liste". Leere Liste ergaebe "in.()" — das
// ist kein gueltiger Filter und wuerde je nach Laune ALLES treffen. Deshalb
// prueft jeder Aufrufer vorher auf Laenge.
function inListe(werte) {
  return "in.(" + werte.map((w) => '"' + String(w).replace(/"/g, '\\"') + '"').join(",") + ")";
}

// Welche Firmen gehoeren diesem Nutzer? Die einzige Quelle fuer alles Weitere.
async function firmenVonNutzer(nutzer) {
  return hole("firmen?besitzer=eq." + encodeURIComponent(nutzer) + "&select=id,daten,plan,erstellt");
}

/**
 * Alle Daten eines Nutzers als einfaches Objekt — zum Herunterladen als JSON.
 *
 * Bewusst maschinenlesbar und vollstaendig statt huebsch: Art. 20 verlangt ein
 * "strukturiertes, gaengiges und maschinenlesbares Format".
 */
async function exportiereKonto(nutzer) {
  if (!konfiguriert()) throw new Error("Datenbank ist nicht eingerichtet.");

  const firmen = await firmenVonNutzer(nutzer);
  const ids = firmen.map((f) => f.id);

  // Gespraeche und Kontaktanfragen haengen an der Firma, nicht am Nutzer.
  // Ohne eigene Firma gibt es beides nicht — und die Abfrage duerfte dann
  // auch gar nicht laufen (siehe inListe).
  const gespraeche = ids.length
    ? await hole("gespraeche?firma_id=" + inListe(ids) + "&select=firma_id,frage,antwort,seite,erstellt&order=erstellt.desc")
    : [];
  const kontakte = ids.length
    ? await hole("kontaktanfragen?firma_id=" + inListe(ids) + "&select=firma_id,name,kontakt,nachricht,erledigt,erstellt&order=erstellt.desc")
    : [];

  const abos = await hole("abos?nutzer=eq." + encodeURIComponent(nutzer) + "&select=plan,firma,aktualisiert");

  return {
    erstellt_am: new Date().toISOString(),
    nutzer,
    hinweis:
      "Alle Daten, die AuraChat zu diesem Konto gespeichert hat. Zahlungsdaten " +
      "liegen bei Stripe, Anmeldedaten bei Clerk — beide sind hier nicht enthalten " +
      "und dort direkt abrufbar.",
    agenten: firmen,
    gespraeche,
    kontaktanfragen: kontakte,
    abo: abos[0] || null,
  };
}

/**
 * Loescht das Konto mit allem, was daran haengt.
 *
 * REIHENFOLGE MIT ABSICHT — von aussen nach innen:
 *   1. Gespraeche und Kontaktanfragen (haengen an der Firma)
 *   2. Bilder im Storage
 *   3. Firmen
 *   4. Abo-Zeile
 * Andersherum blieben Waisen zurueck: Ohne die firmen-Zeile findet niemand
 * mehr heraus, zu wem die uebrigen Gespraeche gehoerten — sie waeren nicht
 * mehr loeschbar, nur noch unauffindbar.
 *
 * Das Stripe-Abo kuendigt der AUFRUFER vorher (konto-loeschen.js). Es zuerst
 * zu kuendigen ist richtig: Wuerde erst geloescht und die Kuendigung schluege
 * fehl, liefe die Abbuchung fuer ein Konto weiter, das es nicht mehr gibt.
 */
async function loescheKonto(nutzer) {
  if (!konfiguriert()) throw new Error("Datenbank ist nicht eingerichtet.");

  const firmen = await firmenVonNutzer(nutzer);
  const ids = firmen.map((f) => f.id);
  const bericht = { agenten: ids.length, gespraeche: 0, kontaktanfragen: 0, bilder: 0 };

  if (ids.length) {
    const filter = inListe(ids);
    await loesche("gespraeche?firma_id=" + filter);
    bericht.gespraeche = "geloescht";
    await loesche("kontaktanfragen?firma_id=" + filter);
    bericht.kontaktanfragen = "geloescht";

    // Charakterbilder. Der Bucket ist oeffentlich lesbar (schema.sql) — wer
    // die URL hat, kommt an das Bild. Genau deshalb muessen die Dateien mit
    // weg und nicht nur die Verweise darauf.
    bericht.bilder = await loescheBilder(nutzer);

    await loesche("firmen?besitzer=eq." + encodeURIComponent(nutzer));
  }

  await loesche("abos?nutzer=eq." + encodeURIComponent(nutzer));
  return bericht;
}

// Charakterbilder aus dem Storage-Bucket raeumen.
//
// Fehler hier brechen die Loeschung NICHT ab: Ein zurueckgebliebenes Bild ist
// aergerlich, ein halb geloeschtes Konto waere schlimmer — der Nutzer haette
// dann weder seine Daten noch sein Konto zurueck.
async function loescheBilder(nutzer) {
  try {
    const res = await fetch(URL_BASIS + "/storage/v1/object/list/charaktere", {
      method: "POST",
      headers: kopf(),
      body: JSON.stringify({ prefix: nutzer + "/", limit: 1000 }),
    });
    if (!res.ok) return "Status " + res.status;
    const dateien = await res.json();
    if (!Array.isArray(dateien) || !dateien.length) return 0;

    const weg = await fetch(URL_BASIS + "/storage/v1/object/charaktere", {
      method: "DELETE",
      headers: kopf(),
      body: JSON.stringify({ prefixes: dateien.map((d) => nutzer + "/" + d.name) }),
    });
    return weg.ok ? dateien.length : "Status " + weg.status;
  } catch (e) {
    console.error("konto: Bilder loeschen fehlgeschlagen:", e.message);
    return "Fehler";
  }
}

module.exports = { exportiereKonto, loescheKonto, firmenVonNutzer, konfiguriert, inListe };
