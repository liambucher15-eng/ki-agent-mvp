// Status-Abfrage für einen Scan-Job. Das Frontend pollt diese Function, bis der
// Status "done" (mit Ergebnis) oder "error" (mit Fehlertext) ist.

const { leseJob } = require("./lib/jobSpeicher");
const { json, holeIp, originErlaubt, rateOk } = require("./lib/schutz");

exports.handler = async (event) => {
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });

  // Großzügiges Rate-Limit: das Frontend pollt bewusst häufig (alle 1,5 s = 40/min),
  // aber ungebremst soll der Endpunkt trotzdem nicht sein (DB-Read-Verstärker).
  if (!(await rateOk("scanstatus:" + holeIp(event), 120, 60))) {
    return json(429, { error: "Zu viele Anfragen." });
  }
  const jobId = event.queryStringParameters && event.queryStringParameters.jobId;
  if (!jobId) return json(400, { error: "jobId fehlt" });

  let job;
  try { job = await leseJob(jobId); }
  catch (e) { return json(502, { error: e.message }); }

  // Noch kein Eintrag -> die Background-Function ist gerade erst gestartet.
  if (!job) return json(200, { status: "pending" });

  return json(200, job);
};
