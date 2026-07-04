// Tests für den Fähigkeiten-Katalog (Agent-Tools).

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { baueTools, KATALOG } = require("../netlify/functions/lib/faehigkeiten");

test("baueTools: leere/fehlende Fähigkeiten -> keine Tools", () => {
  assert.deepEqual(baueTools({}), []);
  assert.deepEqual(baueTools({ faehigkeiten: [] }), []);
  assert.deepEqual(baueTools(null), []);
});

test("baueTools: 'kontakt' liefert das kontakt_hinterlassen-Tool", () => {
  const tools = baueTools({ faehigkeiten: ["kontakt"] });
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "kontakt_hinterlassen");
  assert.equal(tools[0].input_schema.required.includes("nachricht"), true);
  assert.ok(tools[0].description.length > 20);
});

test("baueTools: unbekannte Fähigkeit wird ignoriert", () => {
  assert.deepEqual(baueTools({ faehigkeiten: ["gibtsnicht"] }), []);
  const gemischt = baueTools({ faehigkeiten: ["gibtsnicht", "kontakt"] });
  assert.equal(gemischt.length, 1);
});

test("Tool-Definition hat die von der Claude-API erwartete Form", () => {
  const t = KATALOG.kontakt;
  assert.equal(typeof t.name, "string");
  assert.equal(typeof t.description, "string");
  assert.equal(t.input_schema.type, "object");
  assert.equal(typeof t.input_schema.properties, "object");
  assert.equal(Array.isArray(t.input_schema.required), true);
});
