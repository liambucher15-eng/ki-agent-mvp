// Echte Charakter-Generierung (Milestone 6) — Background-Function, weil
// 4 Gemini-Bilder zusammen deutlich länger als das 10-Sekunden-Limit dauern.
//
// Zwei Aktionen über EIN Job-Muster (gleiches Polling wie der Webseiten-Scan:
// Frontend erzeugt jobId, ruft diese Function, pollt scan-status?jobId=…):
//
//   aktion "generieren": Beschreibung (+ optionales Referenzbild) ->
//     1) idle-Basisbild generieren, 2) denken/sprechen/verlegen als EDITS des
//     Basisbilds (gleiche Figur garantiert), 3) alle 4 in den Storage-Bucket,
//     Job-Ergebnis = { bilder: {idle,denken,sprechen,verlegen}, stil }.
//
//   aktion "bearbeiten": ein bestehendes Bild (URL aus unserem Bucket oder
//     Data-URL) + Textanweisung -> ein neues Bild, Ergebnis = { bild, zustand }.
//
// KOSTEN-SCHUTZ (das ist ein Geld-Endpunkt!):
//   - Origin-Prüfung + Input-Limits wie überall.
//   - rate_hit pro IP:    generieren 3/Stunde, bearbeiten 10/Stunde.
//   - rate_hit pro Firma: generieren 5/30 Tage, bearbeiten 15/30 Tage —
//     wirkt auch über Sitzungen hinweg und für noch nicht gespeicherte Entwürfe.
//   - Live ausgeliefert werden Charakterbilder weiterhin NUR bei plan=plus
//     (Server-Gate in firma.js) — die Generierung hier ist die Onboarding-Vorschau.

const { generiereBild, bearbeiteBild, konfiguriert: geminiOk, zerlegeBase64 } = require("./lib/gemini");
const { speichereBild, istEigeneBildUrl, konfiguriert: storageOk } = require("./lib/bilderSpeicher");
const { baueCharakterPrompt } = require("./lib/baueCharakterPrompt");
const { setzeJob, raeumeAlteJobs } = require("./lib/jobSpeicher");
const { holeIp, originErlaubt, rateOk } = require("./lib/schutz");

const ZUSTAENDE = ["idle", "denken", "sprechen", "verlegen"];
const MAX_BESCHREIBUNG = 500;
const MAX_ANWEISUNG = 300;
const MAX_BASE64 = 6_700_000; // ~5 MB Rohdaten
const MONAT_SEK = 30 * 24 * 60 * 60;

// Gemini liefert bei Bild-Edits SPORADISCH nur Text statt Bild (Status 502 bei
// uns) oder läuft in einen 5xx/Timeout. Ein bis zwei Wiederholungen beheben das
// fast immer. NICHT wiederholt wird bei 4xx (Key/Quota/Eingabe — das bleibt so).
async function mitWiederholung(aufruf, versuche) {
  let r;
  for (let i = 0; i < (versuche || 3); i++) {
    r = await aufruf();
    if (r.ok || (r.status >= 400 && r.status < 500)) return r;
  }
  return r;
}

// Bild für einen Edit besorgen: entweder Data-URL (noch nicht gespeicherter
// Entwurf) oder eine URL aus UNSEREM Bucket (SSRF-Schutz: nichts Fremdes laden).
async function holeBildFuerEdit(bild) {
  if (typeof bild !== "string" || !bild) throw new Error("Bild fehlt.");
  if (bild.startsWith("data:")) {
    if (bild.length > MAX_BASE64) throw new Error("Bild zu groß (max. ca. 5 MB).");
    const { mimeType, daten } = zerlegeBase64(bild);
    return { base64: daten, mimeType };
  }
  if (!istEigeneBildUrl(bild)) throw new Error("Nur eigene Charakterbilder können bearbeitet werden.");
  const res = await fetch(bild);
  if (!res.ok) throw new Error("Bild konnte nicht geladen werden (" + res.status + ").");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BASE64) throw new Error("Bild zu groß.");
  return {
    base64: buf.toString("base64"),
    mimeType: res.headers.get("content-type") || "image/png",
  };
}

async function generiereAlle({ jobId, beschreibung, referenzBild, farbe }) {
  const { stil, prompts, edits } = baueCharakterPrompt({ beschreibung, farbe });

  // 1) Basisbild (idle). Mit Referenzbild: Figur an der Vorlage ausrichten.
  const idlePrompt = referenzBild
    ? prompts.idle + " Nutze das beigefügte Bild als Vorlage für Aussehen und Farben der Figur."
    : prompts.idle;
  const basis = await mitWiederholung(() => generiereBild({ prompt: idlePrompt, referenzBild }));
  if (!basis.ok) throw new Error("Basisbild: " + basis.fehler);

  const roh = { idle: { base64: basis.bildBase64, mimeType: basis.mimeType } };

  // 2) Die drei anderen Ausdrücke als Edits des Basisbilds — nacheinander,
  //    damit wir bei einem Fehler sauber abbrechen (kein halbes Geld verbrennen).
  for (const zustand of ZUSTAENDE.slice(1)) {
    const r = await mitWiederholung(() => bearbeiteBild({
      bild: basis.bildBase64,
      mimeType: basis.mimeType,
      anweisung: edits[zustand],
    }));
    if (!r.ok) throw new Error("Ausdruck '" + zustand + "': " + r.fehler);
    roh[zustand] = { base64: r.bildBase64, mimeType: r.mimeType };
  }

  // 3) Alle 4 hochladen -> öffentliche URLs.
  const bilder = {};
  for (const zustand of ZUSTAENDE) {
    const endung = (roh[zustand].mimeType.split("/")[1] || "png").split(";")[0];
    bilder[zustand] = await speichereBild(
      "generiert/" + jobId + "/" + zustand + "." + endung,
      roh[zustand].base64,
      roh[zustand].mimeType
    );
  }
  return { bilder, stil };
}

async function bearbeiteEines({ jobId, bild, anweisung, zustand }) {
  const quelle = await holeBildFuerEdit(bild);
  const r = await mitWiederholung(() => bearbeiteBild({
    bild: quelle.base64,
    mimeType: quelle.mimeType,
    anweisung:
      anweisung +
      " Behalte Stil, Farben und Proportionen der Figur bei; einfarbiger heller Hintergrund.",
  }));
  if (!r.ok) throw new Error(r.fehler);
  const endung = (r.mimeType.split("/")[1] || "png").split(";")[0];
  // Zeitstempel im Pfad: alte URL bleibt gültig (Verlauf/Zurück), kein Cache-Problem.
  const url = await speichereBild(
    "generiert/" + jobId + "/" + (zustand || "bild") + "-" + Date.now() + "." + endung,
    r.bildBase64,
    r.mimeType
  );
  return { bild: url, zustand: zustand || null };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };
  if (!originErlaubt(event)) return { statusCode: 403 };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400 }; }
  const { jobId, aktion, firmaId, beschreibung, bild, anweisung, zustand, farbe } = body;

  if (typeof jobId !== "string" || !jobId || jobId.length > 100) return { statusCode: 400 };
  if (aktion !== "generieren" && aktion !== "bearbeiten") return { statusCode: 400 };

  // Input-Limits VOR jedem teuren Schritt.
  if (beschreibung != null && (typeof beschreibung !== "string" || beschreibung.length > MAX_BESCHREIBUNG))
    return { statusCode: 413 };
  if (anweisung != null && (typeof anweisung !== "string" || anweisung.length > MAX_ANWEISUNG))
    return { statusCode: 413 };
  if (bild != null && (typeof bild !== "string" || bild.length > MAX_BASE64))
    return { statusCode: 413 };
  if (firmaId != null && (typeof firmaId !== "string" || firmaId.length > 100))
    return { statusCode: 400 };

  // Kosten-Bremsen: pro IP und (wenn bekannt) pro Firma.
  const ip = holeIp(event);
  const istGen = aktion === "generieren";
  if (!(await rateOk((istGen ? "chargen:" : "charedit:") + ip, istGen ? 3 : 10, 3600)))
    return { statusCode: 429 };
  if (firmaId &&
      !(await rateOk((istGen ? "chargenf:" : "chareditf:") + firmaId, istGen ? 5 : 15, MONAT_SEK)))
    return { statusCode: 429 };

  // Konfigurationsfehler sollen als Job-Fehler sichtbar werden (nicht stumm 202).
  try {
    await setzeJob(jobId, { status: "running", ergebnis: null, fehler: null });
  } catch (e) {
    console.error("charakter-background: Job anlegen fehlgeschlagen:", e.message);
    return { statusCode: 202 };
  }
  await raeumeAlteJobs();

  try {
    if (!geminiOk()) throw new Error("Bild-Generierung ist noch nicht eingerichtet (GEMINI_API_KEY fehlt).");
    if (!storageOk()) throw new Error("Bild-Speicher ist nicht eingerichtet (SUPABASE_SERVICE_KEY fehlt).");

    const ergebnis = istGen
      ? await generiereAlle({ jobId, beschreibung, referenzBild: bild, farbe })
      : await bearbeiteEines({ jobId, bild, anweisung, zustand });

    await setzeJob(jobId, { status: "done", ergebnis, fehler: null });
  } catch (e) {
    await setzeJob(jobId, { status: "error", ergebnis: null, fehler: e.message })
      .catch((err) => console.error("charakter-background: Fehler speichern fehlgeschlagen:", err.message));
  }

  return { statusCode: 202 };
};
