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
const { baueCharakterPrompt, baueRichtungen, HINTERGRUND_ANWEISUNG } = require("./lib/baueCharakterPrompt");
const { freistellen } = require("./lib/freistellen");
const { setzeJob, raeumeAlteJobs } = require("./lib/jobSpeicher");
const { holeIp, originErlaubt, rateOk } = require("./lib/schutz");

// freistellen() selbst bricht seit der Umstellung auf Rand-Mehrheit + Flood-Fill
// nicht mehr ab, wenn kein einheitlicher Hintergrund erkennbar ist — dann kommt
// das Bild dort schon unverändert zurück (siehe lib/freistellen.js). Dieser
// try/catch ist nur noch das Netz für wirklich unerwartete Fälle (z.B. Gemini
// liefert kein gültiges PNG): auch dann lieber das Bild MIT Hintergrund
// ausliefern, als den ganzen Job scheitern zu lassen.
function versucheFreistellen(base64, mimeType) {
  try {
    return { base64: freistellen(base64), mimeType: "image/png" };
  } catch (e) {
    console.warn("charakter-background: Freistellen übersprungen:", e.message);
    return { base64, mimeType };
  }
}

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

async function generiereAlle({ jobId, beschreibung, referenzBild, farbe, stilWahl }) {
  const { stil, prompts, edits, mundOffenEdit } = baueCharakterPrompt({ beschreibung, farbe, stilWahl });

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

  // 2b) Klappmaul-Frame: Mund-offen-Variante des SPRECHEN-Bilds (nicht des idle),
  //     damit Pose und Mund zusammenpassen. Optional — schlägt es fehl, wippt die
  //     Figur eben nur; das ist kein harter Fehler (Bild bleibt trotzdem nutzbar).
  const so = await mitWiederholung(() => bearbeiteBild({
    bild: roh.sprechen.base64,
    mimeType: roh.sprechen.mimeType,
    anweisung: mundOffenEdit,
  }));
  if (so.ok) roh.sprechen_offen = { base64: so.bildBase64, mimeType: so.mimeType };

  // 3) Freistellen (Chroma-Key-Magenta -> echte Transparenz) + hochladen.
  const bilder = {};
  for (const zustand of Object.keys(roh)) {
    const frei = versucheFreistellen(roh[zustand].base64, roh[zustand].mimeType);
    const endung = (frei.mimeType.split("/")[1] || "png").split(";")[0];
    bilder[zustand] = await speichereBild(
      "generiert/" + jobId + "/" + zustand + "." + endung,
      frei.base64,
      frei.mimeType
    );
  }
  return { bilder, stil };
}

// Einzelbild-Edit. Die Figur-Beschreibung (charakter.beschreibung aus der
// firmen-Zeile) geht als Kontext mit, damit eine Nachbesserung im Dashboard die
// Figur trifft und nicht bei jedem Edit ein Stueck weiter abdriftet.
async function bearbeiteEines({ jobId, bild, anweisung, zustand, beschreibung }) {
  const quelle = await holeBildFuerEdit(bild);
  const figur = String(beschreibung || "").replace(/\s+/g, " ").trim();
  const r = await mitWiederholung(() => bearbeiteBild({
    bild: quelle.base64,
    mimeType: quelle.mimeType,
    anweisung:
      anweisung +
      " Behalte Stil, Farben und Proportionen der Figur bei." +
      (figur ? " Die Figur ist: " + figur + "." : "") +
      " " + HINTERGRUND_ANWEISUNG,
  }));
  if (!r.ok) throw new Error(r.fehler);
  const frei = versucheFreistellen(r.bildBase64, r.mimeType);
  const endung = (frei.mimeType.split("/")[1] || "png").split(";")[0];
  // Zeitstempel im Pfad: alte URL bleibt gültig (Verlauf/Zurück), kein Cache-Problem.
  const url = await speichereBild(
    "generiert/" + jobId + "/" + (zustand || "bild") + "-" + Date.now() + "." + endung,
    frei.base64,
    frei.mimeType
  );
  return { bild: url, zustand: zustand || null };
}

// §4 Schritt 1: vier UNTERSCHIEDLICHE Richtungs-Vorschauen (je 1 Bild).
// Mit Referenzbild (Upload): jede Richtung orientiert sich an der Vorlage.
async function generiereRichtungen({ jobId, beschreibung, farbe, referenzBild, stilWahl }) {
  const richtungen = baueRichtungen({ beschreibung, farbe, stilWahl });
  const ergebnisse = await Promise.all(richtungen.map(async (r) => {
    const prompt = referenzBild
      ? r.prompt + " Nutze das beigefügte Bild als Vorlage für Aussehen und Farben der Figur."
      : r.prompt;
    const g = await mitWiederholung(() => generiereBild({ prompt, referenzBild }), 2);
    if (!g.ok) return null;
    const frei = versucheFreistellen(g.bildBase64, g.mimeType);
    const endung = (frei.mimeType.split("/")[1] || "png").split(";")[0];
    const url = await speichereBild("richtungen/" + jobId + "/" + r.key + "." + endung, frei.base64, frei.mimeType);
    return { key: r.key, label: r.label, bild: url };
  }));
  const ok = ergebnisse.filter(Boolean);
  if (ok.length < 2) throw new Error("Konnte keine Vorschläge erzeugen. Bitte nochmal versuchen.");
  return { richtungen: ok };
}

// Chat-Flow: EIN Entwurf aus dem im Chat erarbeiteten Prompt. Statt vier
// Varianten auf Verdacht entsteht genau eine Figur, die im Chat so lange
// angepasst wird, bis sie passt — erst danach werden die Ausdrücke erzeugt.
async function generiereEntwurf({ jobId, beschreibung, farbe, referenzBild, stilWahl }) {
  const { stil } = baueCharakterPrompt({ beschreibung, farbe, stilWahl });
  const prompt = referenzBild
    ? stil + " Nutze das beigefügte Bild als Vorlage für Aussehen und Farben der Figur."
    : stil;
  const g = await mitWiederholung(() => generiereBild({ prompt, referenzBild }), 2);
  if (!g.ok) throw new Error(g.fehler || "Konnte den Entwurf nicht erzeugen. Bitte nochmal versuchen.");
  const frei = versucheFreistellen(g.bildBase64, g.mimeType);
  const endung = (frei.mimeType.split("/")[1] || "png").split(";")[0];
  const url = await speichereBild("entwurf/" + jobId + "/idle." + endung, frei.base64, frei.mimeType);
  return { bild: url };
}

// §4 Schritt 2: aus der GEWÄHLTEN Richtung (idle-Bild aus unserem Bucket) die
// restlichen Zustände + Klappmaul erzeugen. idle bleibt die gewählte URL.
async function generiereZustaende({ jobId, bild, beschreibung, farbe, stilWahl }) {
  const quelle = await holeBildFuerEdit(bild);
  const { edits, mundOffenEdit } = baueCharakterPrompt({ beschreibung, farbe, stilWahl });
  const roh = {};
  for (const zustand of ["denken", "sprechen", "verlegen"]) {
    const r = await mitWiederholung(() => bearbeiteBild({
      bild: quelle.base64, mimeType: quelle.mimeType, anweisung: edits[zustand],
    }));
    if (!r.ok) throw new Error("Ausdruck '" + zustand + "': " + r.fehler);
    roh[zustand] = { base64: r.bildBase64, mimeType: r.mimeType };
  }
  const so = await mitWiederholung(() => bearbeiteBild({
    bild: roh.sprechen.base64, mimeType: roh.sprechen.mimeType, anweisung: mundOffenEdit,
  }));
  if (so.ok) roh.sprechen_offen = { base64: so.bildBase64, mimeType: so.mimeType };

  const bilder = { idle: bild }; // gewählte Richtung ist schon freigestellt in unserem Bucket
  for (const zustand of Object.keys(roh)) {
    const frei = versucheFreistellen(roh[zustand].base64, roh[zustand].mimeType);
    const endung = (frei.mimeType.split("/")[1] || "png").split(";")[0];
    bilder[zustand] = await speichereBild(
      "generiert/" + jobId + "/" + zustand + "." + endung, frei.base64, frei.mimeType);
  }
  return { bilder };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };
  if (!originErlaubt(event)) return { statusCode: 403 };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400 }; }
  // stilWahl: "flach" (Vorgabe) oder "3d". Ein unbekannter Wert faellt in
  // baueCharakterPrompt auf "flach" zurueck — den Stil, der seit je laeuft.
  const { jobId, aktion, firmaId, beschreibung, bild, anweisung, zustand, farbe, stilWahl } = body;

  if (typeof jobId !== "string" || !jobId || jobId.length > 100) return { statusCode: 400 };
  const AKTIONEN = ["generieren", "bearbeiten", "richtungen", "zustaende", "entwurf"];
  if (!AKTIONEN.includes(aktion)) return { statusCode: 400 };

  // Input-Limits VOR jedem teuren Schritt.
  if (beschreibung != null && (typeof beschreibung !== "string" || beschreibung.length > MAX_BESCHREIBUNG))
    return { statusCode: 413 };
  if (anweisung != null && (typeof anweisung !== "string" || anweisung.length > MAX_ANWEISUNG))
    return { statusCode: 413 };
  if (bild != null && (typeof bild !== "string" || bild.length > MAX_BASE64))
    return { statusCode: 413 };
  if (firmaId != null && (typeof firmaId !== "string" || firmaId.length > 100))
    return { statusCode: 400 };

  // Kosten-Bremsen: pro IP und (wenn bekannt) pro Firma. Alles ausser dem
  // Einzelbild-"bearbeiten" gilt als (teurere) Generierung.
  const ip = holeIp(event);
  const istGen = aktion !== "bearbeiten";
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

    let ergebnis;
    if (aktion === "entwurf") ergebnis = await generiereEntwurf({ jobId, beschreibung, farbe, referenzBild: bild , stilWahl });
    else if (aktion === "richtungen") ergebnis = await generiereRichtungen({ jobId, beschreibung, farbe, referenzBild: bild , stilWahl });
    else if (aktion === "zustaende") ergebnis = await generiereZustaende({ jobId, bild, beschreibung, farbe , stilWahl });
    else if (aktion === "generieren") ergebnis = await generiereAlle({ jobId, beschreibung, referenzBild: bild, farbe , stilWahl });
    else ergebnis = await bearbeiteEines({ jobId, bild, anweisung, zustand, beschreibung });

    await setzeJob(jobId, { status: "done", ergebnis, fehler: null });
  } catch (e) {
    await setzeJob(jobId, { status: "error", ergebnis: null, fehler: e.message })
      .catch((err) => console.error("charakter-background: Fehler speichern fehlgeschlagen:", err.message));
  }

  return { statusCode: 202 };
};
