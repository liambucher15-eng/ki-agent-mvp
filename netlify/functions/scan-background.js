// Background-Function: scannt eine Webseite OHNE 10-Sekunden-Limit (bis 15 Min).
// Ablauf: sofort "running" speichern -> in Ruhe scannen -> Ergebnis/Fehler speichern.
// Das Frontend erzeugt eine jobId, ruft diese Function auf (kommt sofort mit 202
// zurück) und fragt danach scan-status?jobId=... ab, bis "done" oder "error".
//
// Der Dateiname MUSS auf "-background" enden — nur dann läuft die Function
// asynchron (Netlify-Konvention).

const { scanneWebseite, MAX_UNTERSEITEN, PROBE_UNTERSEITEN } = require("./lib/webseiteScannen");
const { setzeJob, raeumeAlteJobs } = require("./lib/jobSpeicher");
const { holeIp, originErlaubt, rateOk, sicherheitsLog } = require("./lib/schutz");
const { pruefeAnmeldung } = require("./lib/anmeldung");
const { raeumeAb } = require("./lib/aufbewahrung");
const { pruefeBot } = require("./lib/botschutz");

exports.handler = async (event) => {
  if (!originErlaubt(event)) return { statusCode: 403 };

  // Rate-Limit: 5 Scans pro Minute und IP (ein Scan ist teuer)
  if (!(await rateOk("scan:" + holeIp(event), 5, 60))) return { statusCode: 429 };

  let url, jobId, probe, botToken;
  try { ({ url, jobId, probe, botToken } = JSON.parse(event.body || "{}")); } catch {}
  if (!url || !jobId) return { statusCode: 400 };
  if (typeof url !== "string" || url.length > 2000 ||
      typeof jobId !== "string" || jobId.length > 100) return { statusCode: 400 };

  // Probefahrt von public/probe.html: sparsam scannen. Der Aufrufer gibt hier nur
  // ein Ja/Nein, keine Seitenzahl — sonst könnte er sich selbst ein grösseres
  // Budget bestellen.
  const istProbe = probe === true;
  const maxUnterseiten = istProbe ? PROBE_UNTERSEITEN : MAX_UNTERSEITEN;

  // Der volle Scan (bis 12 Unterseiten) ist Kunden vorbehalten. Die Probefahrt
  // bleibt bewusst offen — sie IST das Schaufenster, jeder darf sie ohne Konto
  // ausprobieren. Ihr Kostendeckel ist stattdessen der kleinere Seitenumfang
  // (PROBE_UNTERSEITEN) plus die drei gezählten Fragen in chat.js.
  if (!istProbe) {
    const anmeldung = await pruefeAnmeldung(event);
    if (!anmeldung.ok) return { statusCode: 401 };
  } else {
    // Die Probefahrt bleibt offen — dafuer steht hier der Bot-Schutz. Sie ist
    // die einzige Stelle, an der ein Fremder ohne Konto Geld kostet, und ein
    // IP-Rate-Limit allein haelt kein Skript auf.
    const bot = await pruefeBot(botToken, holeIp(event));
    if (!bot.ok) {
      sicherheitsLog("probe", "Bot-Pruefung abgelehnt: " + bot.grund);
      return { statusCode: 403 };
    }
  }

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

  // Und im selben Zug die Aufbewahrungsfristen durchsetzen: Gespräche,
  // Kontaktanfragen, abgelaufene Zähler. Höchstens alle sechs Stunden, die
  // Bremse steckt in raeumeAb() selbst.
  //
  // Hier angehängt aus demselben Grund wie raeumeAlteJobs(): Es gibt keinen
  // Cron, und ein Scan ist der Vorgang, der ohnehin Zeit hat. Fehler sind
  // unkritisch — beim nächsten Scan wieder.
  await raeumeAb().catch(() => {});

  try {
    const ergebnis = await scanneWebseite(url, maxUnterseiten);
    await setzeJob(jobId, { status: "done", ergebnis, fehler: null });
  } catch (e) {
    await setzeJob(jobId, { status: "error", ergebnis: null, fehler: e.message })
      .catch((err) => console.error("scan-background: Fehler-Status speichern fehlgeschlagen:", err.message));
  }

  return { statusCode: 202 };
};
