// Tests für den Seiten-Hinweis-Cache (Milestone 8): frisch -> Treffer,
// abgelaufen (>7 Tage) -> Miss (neu generieren). fetch gemockt, keine echte DB.

const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// Env VOR dem Require setzen (das Modul liest sie beim Laden).
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "service-test";
const { leseHinweis, setzeHinweis } = require("../netlify/functions/lib/hinweisSpeicher");

const echterFetch = global.fetch;
afterEach(() => { global.fetch = echterFetch; });

function mockZeilen(zeilen) {
  global.fetch = async (url, opts) => {
    mockZeilen.letzter = { url, opts };
    return { ok: true, status: 200, json: async () => zeilen, text: async () => "" };
  };
}

test("leseHinweis: frischer Eintrag -> Text zurück", async () => {
  mockZeilen([{ text: "Soll ich die Preise erklären?", erstellt: new Date().toISOString() }]);
  const t = await leseHinweis("salbei", "/preise");
  assert.equal(t, "Soll ich die Preise erklären?");
  // Query filtert auf firma_id UND pfad
  assert.match(mockZeilen.letzter.url, /firma_id=eq\.salbei/);
  assert.match(mockZeilen.letzter.url, /pfad=eq\.%2Fpreise/);
});

test("leseHinweis: abgelaufener Eintrag (>7 Tage) -> null", async () => {
  const alt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  mockZeilen([{ text: "veraltet", erstellt: alt }]);
  assert.equal(await leseHinweis("salbei", "/preise"), null);
});

test("leseHinweis: kein Eintrag -> null", async () => {
  mockZeilen([]);
  assert.equal(await leseHinweis("salbei", "/x"), null);
});

test("setzeHinweis: Upsert-Request mit merge-duplicates", async () => {
  let gesehen = null;
  global.fetch = async (url, opts) => { gesehen = { url, opts }; return { ok: true, status: 201, text: async () => "" }; };
  await setzeHinweis("salbei", "/preise", "Hallo?");
  assert.match(gesehen.url, /seiten_hinweise/);
  assert.equal(gesehen.opts.method, "POST");
  assert.match(gesehen.opts.headers.prefer, /merge-duplicates/);
  const body = JSON.parse(gesehen.opts.body);
  assert.equal(body.firma_id, "salbei");
  assert.equal(body.pfad, "/preise");
  assert.equal(body.text, "Hallo?");
});
