// Background-Function: scannt eine Webseite OHNE 10-Sekunden-Limit (bis 15 Min).
// Ablauf: sofort "running" speichern -> in Ruhe scannen -> Ergebnis/Fehler speichern.
// Das Frontend erzeugt eine jobId, ruft diese Function auf (kommt sofort mit 202
// zurück) und fragt danach scan-status?jobId=... ab, bis "done" oder "error".
//
// Der Dateiname MUSS auf "-background" enden — nur dann läuft die Function
// asynchron (Netlify-Konvention).

const { scanneWebseite, MAX_UNTERSEITEN, PROBE_UNTERSEITEN } = require("./lib/webseiteScannen");
const { setzeJob, raeumeAlteJobs } = require("./lib/jobSpeicher");
const { holeIp, originErlaubt, rateOk } = require("./lib/schutz");

exports.handler = async (event) => {
  if (!originErlaubt(event)) return { statusCode: 403 };

  // Rate-Limit: 5 Scans pro Minute und IP (ein Scan ist teuer)
  if (!(await rateOk("scan:" + holeIp(event), 5, 60))) return { statusCode: 429 };

  let url, jobId, probe;
  try { ({ url, jobId, probe } = JSON.parse(event.body || "{}")); } catch {}
  if (!url || !jobId) return { statusCode: 400 };
  if (typeof url !== "string" || url.length > 2000 ||
      typeof jobId !== "string" || jobId.length > 100) return { statusCode: 400 };

  // Probefahrt von public/probe.html: sparsam scannen. Der Aufrufer gibt hier nur
  // ein Ja/Nein, keine Seitenzahl — sonst könnte er sich selbst ein grösseres
  // Budget bestellen.
  const istProbe = probe === true;
  const maxUnterseiten = istProbe ? PROBE_UNTERSEITEN : MAX_UNTERSEITEN;

  // Sofort einen "läuft"-Eintrag anlegen, damit die Status-Abfrage etwas findet.
  // istProbe wird mitgespeichert, weil chat.js später daran erkennt, ob dieser
  // Job überhaupt als Gesprächsgrundlage dienen darf.
  try {
    await setzeJob(jobId, { status: "running", ergebnis: null, fehler: null, probe: istProbe, fragen: 0 });
  } catch (e) {
    // Wenn nicht mal das Anlegen klappt, ist der Speicher nicht erreichbar — abbrechen.
    console.error("scan-background: Job konnte nicht angelegt werden:", e.message);
    return { statusCode: 202 };
  }

  // Nebenbei alte Jobs (> 1 Tag) wegräumen — hält die Tabelle klein, ohne Cron.
  await raeumeAlteJobs();

  try {
    const ergebnis = await scanneWebseite(url, maxUnterseiten);
    await setzeJob(jobId, { status: "done", ergebnis, fehler: null });
  } catch (e) {
    await setzeJob(jobId, { status: "error", ergebnis: null, fehler: e.message })
      .catch((err) => console.error("scan-background: Fehler-Status speichern fehlgeschlagen:", err.message));
  }

  return { statusCode: 202 };
};
