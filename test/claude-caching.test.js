// Prompt-Caching im zentralen Claude-Aufruf.
//
// Diese Tests halten den AUFBAU der Anfrage fest, nicht das Verhalten der API.
// Der Grund: Die Wirkung des Cachings haengt an einer Schwelle, die wir nicht
// kontrollieren (Haiku 4.5: 4096 Tokens). Gemessen liegen die echten
// System-Prompts bei 858 bis 2590 Tokens — heute greift das Caching also NICHT.
// Die Anfrage muss trotzdem korrekt gebaut sein, damit es sich von selbst
// einschaltet, sobald ein Kunde genug Wissen hinterlegt.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CACHE_MINIMUM_TOKENS, MODELL } = require("../netlify/functions/lib/claude");

// Die Anfrage abfangen, statt sie zu schicken: kein API-Key, keine Kosten.
async function fangeAnfrage(aufruf) {
  const echt = global.fetch;
  let gesehen = null;
  global.fetch = async (url, opt) => {
    gesehen = { url, body: JSON.parse(opt.body) };
    return { ok: true, status: 200, json: async () => ({ usage: { input_tokens: 10, output_tokens: 5 } }) };
  };
  try { await aufruf(); } finally { global.fetch = echt; }
  return gesehen;
}

test("System-Prompt geht als Block mit cache_control raus, nicht als roher String", async () => {
  const { rufeClaude } = require("../netlify/functions/lib/claude");
  const a = await fangeAnfrage(() => rufeClaude({ system: "Du bist ein Test.", messages: [{ role: "user", content: "hi" }] }));
  assert.ok(Array.isArray(a.body.system), "system muss ein Array von Bloecken sein");
  assert.equal(a.body.system.length, 1);
  assert.equal(a.body.system[0].type, "text");
  assert.equal(a.body.system[0].text, "Du bist ein Test.");
  assert.deepEqual(a.body.system[0].cache_control, { type: "ephemeral" });
});

test("ohne System-Prompt wird auch kein system-Feld gesetzt", async () => {
  const { rufeClaude } = require("../netlify/functions/lib/claude");
  const a = await fangeAnfrage(() => rufeClaude({ messages: [{ role: "user", content: "hi" }] }));
  assert.equal(a.body.system, undefined);
});

test("Werkzeuge bleiben unangetastet — der Haltepunkt am System deckt sie mit ab", async () => {
  // Reihenfolge im Cache-Praefix: tools -> system -> messages. Ein eigener
  // Haltepunkt an den Werkzeugen waere doppelt gezahlt.
  const { rufeClaude } = require("../netlify/functions/lib/claude");
  const werkzeuge = [{ name: "test", description: "x", input_schema: { type: "object", properties: {} } }];
  const a = await fangeAnfrage(() => rufeClaude({ system: "S", messages: [{ role: "user", content: "hi" }], tools: werkzeuge }));
  assert.deepEqual(a.body.tools, werkzeuge);
  assert.equal(a.body.tools[0].cache_control, undefined);
});

test("die Cache-Schwelle steht als Zahl im Code und passt zum Modell", () => {
  // Wird das Modell gewechselt, MUSS diese Zahl mitgezogen werden:
  // Haiku 4.5 = 4096, Haiku 3.5 = 2048, Sonnet/Opus = 1024. Sonst behauptet
  // ein Kommentar etwas, das nicht mehr stimmt.
  assert.equal(typeof CACHE_MINIMUM_TOKENS, "number");
  assert.ok(MODELL.includes("haiku-4-5"), "Modell ist nicht mehr Haiku 4.5 — Schwelle pruefen!");
  assert.equal(CACHE_MINIMUM_TOKENS, 4096);
});
