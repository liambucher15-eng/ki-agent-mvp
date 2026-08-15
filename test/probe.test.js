// Tests für den Kostendeckel der öffentlichen Probefahrt (public/probe.html).
//
// Warum ausgerechnet hier Tests stehen: Die Probefahrt ist die einzige Funktion,
// die jeder Fremde ohne Konto auslösen kann, und jede Frage kostet einen
// Claude-Aufruf. Wenn der Zähler still versagt, merkt man es an der Rechnung.
// Getestet wird deshalb vor allem, dass ein Fehlerfall NIE als Erlaubnis
// durchgeht — das Gegenteil des fail-open-Rate-Limits in schutz.js.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const W = require("../netlify/functions/lib/webseiteScannen");

// --- Seiten-Budget ---

test("Probefahrt-Budget ist deutlich kleiner als das Onboarding-Budget", () => {
  assert.ok(W.PROBE_UNTERSEITEN < W.MAX_UNTERSEITEN);
  // 12 Seiten pro Fremdem wären der Kostentreiber, den die Probefahrt vermeidet.
  assert.ok(W.PROBE_UNTERSEITEN <= 3);
});

test("findeUnterseiten hält sich an das übergebene Budget", () => {
  const html = Array.from({ length: 20 }, (_, i) => `<a href="/seite-${i}">S${i}</a>`).join("");
  assert.equal(W.findeUnterseiten(html, "https://firma.ch", W.PROBE_UNTERSEITEN).length,
    W.PROBE_UNTERSEITEN);
  assert.equal(W.findeUnterseiten(html, "https://firma.ch", 0).length, 0);
});

// --- Fragen-Zähler ---
//
// zaehleProbeFrage spricht über fetch mit PostgREST. Die Tests ersetzen fetch,
// damit sie ohne Netz und ohne Supabase laufen. Geprüft wird die Auswertung der
// Antwort, denn genau dort entscheidet sich Ja oder Nein.

function mitFetch(antwort, fn) {
  const echt = global.fetch;
  const alteUrl = process.env.SUPABASE_URL;
  const alterKey = process.env.SUPABASE_SERVICE_KEY;
  process.env.SUPABASE_URL = "https://test.example";
  process.env.SUPABASE_SERVICE_KEY = "test-key";
  global.fetch = async () => antwort;
  // Frisch laden, damit das Modul die gesetzten Umgebungsvariablen sieht.
  delete require.cache[require.resolve("../netlify/functions/lib/jobSpeicher")];
  const { zaehleProbeFrage } = require("../netlify/functions/lib/jobSpeicher");
  return Promise.resolve(fn(zaehleProbeFrage)).finally(() => {
    global.fetch = echt;
    process.env.SUPABASE_URL = alteUrl;
    process.env.SUPABASE_SERVICE_KEY = alterKey;
    delete require.cache[require.resolve("../netlify/functions/lib/jobSpeicher")];
  });
}
const ok = (koerper) => ({ ok: true, json: async () => koerper, text: async () => "" });

test("Fragen-Zähler: erste Frage wird gewährt, zwei bleiben übrig", () =>
  mitFetch(ok(1), async (zaehle) => {
    assert.deepEqual(await zaehle("job-1", 3), { ok: true, stand: 1, uebrig: 2 });
  }));

test("Fragen-Zähler: letzte erlaubte Frage lässt null übrig", () =>
  mitFetch(ok(3), async (zaehle) => {
    assert.deepEqual(await zaehle("job-1", 3), { ok: true, stand: 3, uebrig: 0 });
  }));

test("Fragen-Zähler: -1 aus der Datenbank heisst Nein", () =>
  // Die SQL-Function gibt -1 zurück, wenn der Job unbekannt ist, keine
  // Probefahrt ist, noch läuft ODER das Kontingent aufgebraucht ist.
  mitFetch(ok(-1), async (zaehle) => {
    const r = await zaehle("job-1", 3);
    assert.equal(r.ok, false);
    assert.equal(r.uebrig, 0);
  }));

test("Fragen-Zähler: ein Stand über der Grenze wird nicht durchgewunken", () =>
  // Sollte nie vorkommen — falls doch (etwa nach einer verpassten Migration),
  // ist die richtige Antwort Nein, nicht Ja.
  mitFetch(ok(9), async (zaehle) => {
    assert.equal((await zaehle("job-1", 3)).ok, false);
  }));

test("Fragen-Zähler: Unsinn statt Zahl wird nicht durchgewunken", () =>
  mitFetch(ok(null), async (zaehle) => {
    assert.equal((await zaehle("job-1", 3)).ok, false);
  }));

test("Fragen-Zähler: HTTP-Fehler wirft, statt still zu erlauben", () =>
  // chat.js fängt das ab und antwortet 503. Ein stilles true wäre ein offenes
  // Portemonnaie: genau der fail-open-Fehler, den schutz.js beim Rate-Limit hat.
  mitFetch({ ok: false, status: 500, text: async () => "kaputt" }, async (zaehle) => {
    await assert.rejects(() => zaehle("job-1", 3), /Fragen-Z/);
  }));

test("Fragen-Zähler: ohne Supabase-Konfiguration wirft es ebenfalls", async () => {
  const alteUrl = process.env.SUPABASE_URL, alterKey = process.env.SUPABASE_SERVICE_KEY;
  const alterAnon = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  delete require.cache[require.resolve("../netlify/functions/lib/jobSpeicher")];
  const { zaehleProbeFrage } = require("../netlify/functions/lib/jobSpeicher");
  try {
    await assert.rejects(() => zaehleProbeFrage("job-1", 3), /SUPABASE/);
  } finally {
    if (alteUrl) process.env.SUPABASE_URL = alteUrl;
    if (alterKey) process.env.SUPABASE_SERVICE_KEY = alterKey;
    if (alterAnon) process.env.SUPABASE_ANON_KEY = alterAnon;
    delete require.cache[require.resolve("../netlify/functions/lib/jobSpeicher")];
  }
});

// --- Der Probe-Agent darf nichts ausser antworten ---

test("Probe-Agent bekommt keine Werkzeuge", () => {
  const { baueTools } = require("../netlify/functions/lib/faehigkeiten");
  // So baut chat.js die Firma für eine Probefahrt: ohne faehigkeiten. Es gibt
  // keine Firma, in deren Posteingang ein Lead landen könnte.
  assert.deepEqual(baueTools({ name: "Test", faehigkeiten: [] }), []);
});
