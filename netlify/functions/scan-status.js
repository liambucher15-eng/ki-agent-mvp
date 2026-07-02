// Status-Abfrage für einen Scan-Job. Das Frontend pollt diese Function, bis der
// Status "done" (mit Ergebnis) oder "error" (mit Fehlertext) ist.

const { leseJob } = require("./lib/jobSpeicher");

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  const jobId = event.queryStringParameters && event.queryStringParameters.jobId;
  if (!jobId) return json(400, { error: "jobId fehlt" });

  let job;
  try { job = await leseJob(jobId); }
  catch (e) { return json(502, { error: e.message }); }

  // Noch kein Eintrag -> die Background-Function ist gerade erst gestartet.
  if (!job) return json(200, { status: "pending" });

  return json(200, job);
};
