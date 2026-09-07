// Aufbewahrungsfristen: Alte Daten verschwinden von selbst.
//
// WARUM
// gespraeche und kontaktanfragen wuchsen bisher unbegrenzt. Jede Frage jedes
// Besuchers jeder Kundenwebseite blieb fuer immer liegen. Das ist zweierlei:
// ein Datenschutzproblem (DSGVO Art. 5 Abs. 1 lit. e — nicht laenger
// speichern als noetig) und ein wachsender Schaden fuer den Fall, dass die
// Datenbank je in falsche Haende geraet.
//
// DIE FRISTEN SIND EINE ZUSAGE
// Was hier als Zahl steht, steht auch in public/datenschutz.html. Wer eine
// aendert, aendert beide. Eine Datenschutzerklaerung, die 90 Tage verspricht,
// waehrend die Datenbank alles behaelt, ist schlimmer als gar keine Frist —
// sie ist eine nachweisbar falsche Angabe.
//
// KEIN CRON
// Genau wie raeumeAlteJobs() in lib/jobSpeicher.js: Das Aufraeumen laeuft
// nebenbei mit, wenn ohnehin eine Background-Function arbeitet. Damit braucht
// es keinen Scheduler, kein zusaetzliches Netlify-Feature und nichts, was
// unbemerkt ausfallen kann. Der Preis: Es raeumt nur auf, wenn ueberhaupt
// etwas passiert. Bei einem toten Konto passiert dann auch nichts mehr — das
// ist hinnehmbar, weil bei einem toten Konto auch nichts Neues dazukommt.

const URL_BASIS = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_KEY || "";

const TAG_MS = 24 * 60 * 60 * 1000;

// Die Fristen. Ueber Umgebungsvariablen anpassbar, damit eine Aenderung kein
// Deploy braucht — aber mit Vorgabewerten, damit sie auch ohne Konfiguration
// greifen. Eine Frist, die nur bei gesetzter Variable gilt, ist keine.
const FRISTEN = [
  {
    tabelle: "gespraeche",
    tage: Number(process.env.FRIST_GESPRAECHE_TAGE) || 90,
    // Der Posteingang im Dashboard zeigt die letzten Gespraeche. 90 Tage sind
    // lang genug, dass ein Kunde eine Anfrage von vorletzter Woche noch
    // findet, und kurz genug, dass kein Archiv entsteht.
  },
  {
    tabelle: "kontaktanfragen",
    tage: Number(process.env.FRIST_KONTAKTE_TAGE) || 365,
    // Deutlich laenger als Gespraeche, und das mit Absicht: Das hier sind
    // Leads. Sie zu loeschen, waehrend der Kunde sie noch bearbeitet, waere
    // ein Schaden an genau dem, wofuer er bezahlt.
  },
  {
    tabelle: "rate_limits",
    tage: Number(process.env.FRIST_ZAEHLER_TAGE) || 1,
    spalte: "fenster_ende",
    // Andere Rechnung als oben: Diese Tabelle hat kein "erstellt", sondern
    // "fenster_ende" (schema.sql) — den Zeitpunkt, ab dem ein Zaehler nicht
    // mehr gilt. Geloescht wird also, was seit mindestens einem Tag ABGELAUFEN
    // ist, nicht was einen Tag alt ist.
    //
    // Der Unterschied ist wichtig: Das laengste Fenster im System betraegt
    // 30 Tage (charakter-background.js, MONAT_SEK). Wuerde hier nach
    // Erstellungsdatum geloescht, fiele eine laufende Monatssperre nach einem
    // Tag weg — und jemand koennte die Bildgenerierung taeglich neu ausreizen.
  },
];

function konfiguriert() {
  return !!URL_BASIS && !!KEY;
}

function kopf() {
  return { apikey: KEY, authorization: "Bearer " + KEY };
}

// Wie oft ueberhaupt aufgeraeumt wird. Ohne diese Bremse liefe bei jedem
// Hintergrundauftrag ein DELETE ueber drei Tabellen — meist ohne einen
// einzigen Treffer.
//
// Der Merker liegt im Modulscope und ueberlebt damit nur die warme Instanz.
// Das genuegt: Im schlimmsten Fall wird oefter aufgeraeumt als noetig, nie
// seltener.
const MINDESTABSTAND_MS = 6 * 60 * 60 * 1000;
let zuletzt = 0;

/**
 * Loescht abgelaufene Zeilen. Nebenbei aufzurufen, Fehler sind unkritisch —
 * beim naechsten Mal klappt es wieder.
 *
 * @param {boolean} erzwingen  Abstandsbremse ueberspringen (fuer Tests).
 */
async function raeumeAb(erzwingen) {
  if (!konfiguriert()) return { uebersprungen: "nicht konfiguriert" };

  const jetzt = Date.now();
  if (!erzwingen && jetzt - zuletzt < MINDESTABSTAND_MS) {
    return { uebersprungen: "zu frueh" };
  }
  zuletzt = jetzt;

  const ergebnis = {};
  for (const { tabelle, tage, spalte } of FRISTEN) {
    const feld = spalte || "erstellt";
    const grenze = new Date(jetzt - tage * TAG_MS).toISOString();
    try {
      const res = await fetch(
        URL_BASIS + "/rest/v1/" + tabelle + "?" + feld + "=lt." + encodeURIComponent(grenze),
        { method: "DELETE", headers: kopf() }
      );
      ergebnis[tabelle] = res.ok ? "ok" : "Status " + res.status;
      if (!res.ok) {
        // Nicht still verschlucken: Eine Frist, die seit Monaten scheitert,
        // waehrend die Datenschutzerklaerung sie verspricht, ist genau der
        // Fall, den niemand bemerkt.
        console.error("AUFBEWAHRUNG " + tabelle + ": DELETE antwortete " + res.status);
      }
    } catch (e) {
      ergebnis[tabelle] = "Fehler";
      console.error("AUFBEWAHRUNG " + tabelle + ": " + e.message);
    }
  }
  return ergebnis;
}

module.exports = { raeumeAb, FRISTEN, konfiguriert };
