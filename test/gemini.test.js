// Tests für den Gemini-Image-Client (Milestone 6) — der Geld-Endpunkt:
// Request-Bau, Antwort-Parsing und Fehler-Mapping, alles mit gemocktem fetch
// (kein echter API-Aufruf, kein Key nötig).

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.GEMINI_API_KEY = "test-key";
const { generiereBild, bearbeiteBild, zerlegeBase64, MODELL } = require("../netlify/functions/lib/gemini");
const { baueCharakterPrompt, AUSDRUECKE } = require("../netlify/functions/lib/baueCharakterPrompt");

const echterFetch = global.fetch;
afterEach(() => { global.fetch = echterFetch; });

function mockAntwort(status, body) {
  global.fetch = async (url, opts) => {
    mockAntwort.letzterAufruf = { url, opts };
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}

function bildAntwort(base64, mimeType) {
  return {
    candidates: [{ content: { parts: [
      { text: "Hier ist das Bild:" },
      { inlineData: { mimeType: mimeType || "image/png", data: base64 } },
    ] } }],
  };
}

test("zerlegeBase64: Data-URL wird in mimeType + Daten zerlegt", () => {
  const r = zerlegeBase64("data:image/jpeg;base64,QUJD");
  assert.equal(r.mimeType, "image/jpeg");
  assert.equal(r.daten, "QUJD");
});

test("zerlegeBase64: roher Base64-String -> Fallback-MimeType", () => {
  const r = zerlegeBase64("QUJD", "image/webp");
  assert.equal(r.mimeType, "image/webp");
  assert.equal(r.daten, "QUJD");
});

test("generiereBild: baut korrekten Request und liefert das Bild", async () => {
  mockAntwort(200, bildAntwort("BILD64"));
  const r = await generiereBild({ prompt: "Ein Fuchs" });
  assert.equal(r.ok, true);
  assert.equal(r.bildBase64, "BILD64");
  assert.equal(r.mimeType, "image/png");

  const { url, opts } = mockAntwort.letzterAufruf;
  assert.ok(url.includes(MODELL + ":generateContent"));
  assert.equal(opts.headers["x-goog-api-key"], "test-key");
  const body = JSON.parse(opts.body);
  assert.equal(body.contents[0].parts[0].text, "Ein Fuchs");
  assert.deepEqual(body.generationConfig.responseModalities, ["IMAGE"]);
});

test("generiereBild: Referenzbild wird als inlineData-Teil mitgeschickt", async () => {
  mockAntwort(200, bildAntwort("X"));
  await generiereBild({ prompt: "P", referenzBild: "data:image/jpeg;base64,REF64" });
  const body = JSON.parse(mockAntwort.letzterAufruf.opts.body);
  assert.equal(body.contents[0].parts.length, 2);
  assert.equal(body.contents[0].parts[1].inlineData.data, "REF64");
  assert.equal(body.contents[0].parts[1].inlineData.mimeType, "image/jpeg");
});

test("bearbeiteBild: Bild zuerst, Anweisung danach", async () => {
  mockAntwort(200, bildAntwort("NEU64"));
  const r = await bearbeiteBild({ bild: "ALT64", mimeType: "image/png", anweisung: "Mütze blau" });
  assert.equal(r.ok, true);
  assert.equal(r.bildBase64, "NEU64");
  const body = JSON.parse(mockAntwort.letzterAufruf.opts.body);
  assert.equal(body.contents[0].parts[0].inlineData.data, "ALT64");
  assert.equal(body.contents[0].parts[1].text, "Mütze blau");
});

test("API-Fehler -> ok:false mit Meldung, kein Wurf", async () => {
  mockAntwort(429, { error: { message: "Quota erschöpft" } });
  const r = await generiereBild({ prompt: "P" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 429);
  assert.match(r.fehler, /Quota/);
});

test("Antwort ohne Bild -> ok:false (kein stiller Erfolg)", async () => {
  mockAntwort(200, { candidates: [{ content: { parts: [{ text: "nur Text" }] } }] });
  const r = await generiereBild({ prompt: "P" });
  assert.equal(r.ok, false);
  assert.match(r.fehler, /kein Bild/i);
});

test("baueCharakterPrompt: liefert Prompts UND Edit-Anweisungen für alle 4 Zustände", () => {
  const { stil, prompts, edits } = baueCharakterPrompt({ beschreibung: "Fuchs", farbe: "#123456" });
  for (const z of Object.keys(AUSDRUECKE)) {
    assert.ok(prompts[z].includes(stil), "prompt " + z + " enthält die Stilklammer");
    assert.match(edits[z], /dieselbe Figur/i);
    assert.ok(edits[z].includes(AUSDRUECKE[z]));
  }
  assert.match(stil, /#123456/);
});
