// Background-Function: scannt eine Webseite OHNE 10-Sekunden-Limit (bis 15 Min).
// Ablauf: sofort "running" speichern -> in Ruhe scannen -> Ergebnis/Fehler speichern.
// Das Frontend erzeugt eine jobId, ruft diese Function auf (kommt sofort mit 202
// zurück) und fragt danach scan-status?jobId=... ab, bis "done" oder "error".
//
// Der Dateiname MUSS auf "-background" enden — nur dann läuft die Function
// asynchron (Netlify-Konvention).

const { scanneWebseite } = require("./lib/webseiteScannen");
const { setzeJob, raeumeAlteJobs } = require("./lib/jobSpeicher");
const { holeIp, originErlaubt, rateOk } = require("./lib/schutz");

exports.handler = async (event) => {
  if (!originErlaubt(event)) return { statusCode: 403 };

  // Rate-Limit: 5 Scans pro Minute und IP (ein Scan ist teuer)
  if (!(await rateOk("scan:" + holeIp(event), 5, 60))) return { statusCode: 429 };

  let url, jobId;
  try { ({ url, jobId } = JSON.parse(event.body || "{}")); } catch {}
  if (!url || !jobId) return { statusCode: 400 };
  if (typeof url !== "string" || url.length > 2000 ||
      typeof jobId !== "string" || jobId.length > 100) return { statusCode: 400 };

  // Sofort einen "läuft"-Eintrag anlegen, damit die Status-Abfrage etwas findet.
  try {
    await setzeJob(jobId, { status: "running", ergebnis: null, fehler: null });
  } catch (e) {
    // Wenn nicht mal das Anlegen klappt, ist der Speicher nicht erreichbar — abbrechen.
    console.error("scan-background: Job konnte nicht angelegt werden:", e.message);
    return { statusCode: 202 };
  }

  // Nebenbei alte Jobs (> 1 Tag) wegräumen — hält die Tabelle klein, ohne Cron.
  await raeumeAlteJobs();

  try {
    const ergebnis = await scanneWebseite(url);
    await setzeJob(jobId, { status: "done", ergebnis, fehler: null });
  } catch (e) {
    await setzeJob(jobId, { status: "error", ergebnis: null, fehler: e.message })
      .catch((err) => console.error("scan-background: Fehler-Status speichern fehlgeschlagen:", err.message));
  }

  return { statusCode: 202 };
};
