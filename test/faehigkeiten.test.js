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

test("baueTools: 'produkte' liefert das produkte_vorschlagen-Tool", () => {
  const tools = baueTools({ faehigkeiten: ["produkte"] });
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "produkte_vorschlagen");
  const schema = tools[0].input_schema.properties.produkte;
  assert.equal(schema.type, "array");
  assert.deepEqual(schema.items.required, ["name", "grund"]);
});

test("produkte_vorschlagen: verbietet Erfinden ausdrücklich", () => {
  // Ohne diese Ansage empfiehlt das Modell munter Produkte, die es nicht gibt.
  assert.match(KATALOG.produkte.description, /Erfinde nichts/);
  assert.match(KATALOG.produkte.description, /NUR/);
});

test("baueTools: mehrere Fähigkeiten ergeben mehrere Tools", () => {
  const tools = baueTools({ faehigkeiten: ["kontakt", "produkte"] });
  assert.equal(tools.length, 2);
  const namen = tools.map((t) => t.name).sort();
  assert.deepEqual(namen, ["kontakt_hinterlassen", "produkte_vorschlagen"]);
});
