// Tests für den Gemini-Image-Client (Milestone 6) — der Geld-Endpunkt:
// Request-Bau, Antwort-Parsing und Fehler-Mapping, alles mit gemocktem fetch
// (kein echter API-Aufruf, kein Key nötig).

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.GEMINI_API_KEY = "test-key";
const { generiereBild, bearbeiteBild, zerlegeBase64, MODELL } = require("../netlify/functions/lib/gemini");
const { baueCharakterPrompt, baueRichtungen, AUSDRUECKE, RICHTUNGEN } = require("../netlify/functions/lib/baueCharakterPrompt");

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

// Welle 1, §4: vier UNTERSCHIEDLICHE Richtungs-Prompts
test("baueRichtungen: liefert 4 verschiedene Richtungen mit Prompt + Label", () => {
  const rs = baueRichtungen({ beschreibung: "Fuchs", farbe: "#123456" });
  assert.equal(rs.length, 4);
  assert.equal(rs.length, RICHTUNGEN.length);
  const keys = rs.map((r) => r.key);
  assert.equal(new Set(keys).size, 4, "keys eindeutig");
  const prompts = rs.map((r) => r.prompt);
  assert.equal(new Set(prompts).size, 4, "prompts unterscheiden sich");
  for (const r of rs) {
    assert.ok(r.label && r.prompt);
    assert.match(r.prompt, /#123456/);       // Markenfarbe steckt drin
    assert.match(r.prompt, /Stil-Richtung:/); // Richtungs-Zusatz gesetzt
  }
});

// ── Stilwahl: gezeichnet oder plastisch ──────────────────────────────────
//
// "Flacher Cartoon-Stil, klare Konturen" war lange fest verdrahtet, und zwar
// aus einem technischen Grund: Das Freistellen flutete vom Bildrand her und
// brauchte eine harte Kontur als Barriere. Seit lib/freistellen.js daneben ein
// zweites Verfahren hat (Abstand im Farbton), kommt auch ein 3D-Render durch.

const { STILE, stilFuer } = require("../netlify/functions/lib/baueCharakterPrompt");

test("stilFuer: unbekannte Werte landen bei 'flach'", () => {
  // Wichtig, weil der Wert aus dem Browser kommt. "flach" ist der Stil, der
  // seit je funktioniert — ein Tippfehler darf niemanden in den neueren Weg
  // drängen.
  assert.equal(stilFuer("flach"), "flach");
  assert.equal(stilFuer("3d"), "3d");
  assert.equal(stilFuer("dreidee"), "flach");
  assert.equal(stilFuer(undefined), "flach");
  assert.equal(stilFuer(null), "flach");
});

test("die beiden Stile erzeugen wirklich verschiedene Prompts", () => {
  const flach = baueCharakterPrompt({ beschreibung: "Brot", stilWahl: "flach" });
  const raeumlich = baueCharakterPrompt({ beschreibung: "Brot", stilWahl: "3d" });
  assert.notEqual(flach.stil, raeumlich.stil);
  assert.match(flach.stil, /Flacher, stilisierter Cartoon-Stil/);
  assert.match(raeumlich.stil, /3D-Render/i);
  assert.equal(flach.stilWahl, "flach");
  assert.equal(raeumlich.stilWahl, "3d");
});

test("der 3D-Prompt verbietet Schatten und Licht auf dem Hintergrund", () => {
  // Nicht Kosmetik, sondern Voraussetzung fürs Freistellen: Ein Render setzt
  // die Figur sonst auf eine Bodenfläche, und Studiolicht erzeugt einen Verlauf
  // auf dem Hintergrund (gemessen: RGB-Abstand 59 bis 97 zwischen oben und
  // unten). Beides macht die Fläche uneinheitlich.
  const { stil } = baueCharakterPrompt({ beschreibung: "Brot", stilWahl: "3d" });
  assert.match(stil, /kein Schlagschatten/i);
  assert.match(stil, /keine Bodenflaeche|keine Bodenfläche/i);
  assert.match(stil, /Licht trifft NUR die Figur/i);
});

test("der Chroma-Key-Hintergrund gilt in BEIDEN Stilen", () => {
  // Ohne ihn gäbe es nichts freizustellen — auch nicht im 3D-Stil, wo der
  // Kunde sonst vielleicht einen weissen Studiogrund erwartet.
  for (const s of Object.keys(STILE)) {
    const { stil, edits } = baueCharakterPrompt({ beschreibung: "Brot", stilWahl: s });
    assert.match(stil, /Magenta/i, "Stil " + s);
    for (const [zustand, anweisung] of Object.entries(edits)) {
      assert.match(anweisung, /Magenta/i, "Edit " + zustand + " im Stil " + s);
    }
  }
});

test("die Ausdrücke bleiben in beiden Stilen dieselben vier", () => {
  const a = baueCharakterPrompt({ stilWahl: "flach" });
  const b = baueCharakterPrompt({ stilWahl: "3d" });
  assert.deepEqual(Object.keys(a.prompts), Object.keys(b.prompts));
  assert.deepEqual(Object.keys(a.edits), Object.keys(b.edits));
});

// ----------------------------------------------------------------------
// Chroma-Key nach Figurfarbe
//
// Der Schluessel darf der Figur nicht aehneln, sonst frisst das Freistellen
// Teile von ihr weg. An einem rosa Donut vor Magenta gemessen: Der Rand war
// sichtbar angefressen, die Aermchen halb verschwunden. Mit gruenem Schluessel
// war dasselbe Motiv makellos.
//
// Vorher stand Magenta fest, zusammen mit der Bitte, die Figur moege kein
// Magenta enthalten. Nur waehlt der Kunde seine Hauptfarbe selbst.
const { keyFuer, hintergrundAnweisung } = require("../netlify/functions/lib/baueCharakterPrompt");

test("eine rosa Figur bekommt den gruenen Schluessel", () => {
  assert.equal(keyFuer("#e879a0").name, "Chroma-Key-Grün");
  assert.equal(keyFuer("#ff00ff").name, "Chroma-Key-Grün");
});

test("eine gruene Figur bekommt Magenta", () => {
  assert.equal(keyFuer("#3f7d5a").name, "Magenta/Pink");
  assert.equal(keyFuer("#00b140").name, "Magenta/Pink");
});

test("ohne brauchbare Farbangabe bleibt es bei Magenta", () => {
  // Der bisherige Standard. Ein fehlender oder kaputter Wert darf den Ablauf
  // nicht in eine andere Farbwelt kippen.
  for (const wert of [undefined, null, "", "blau", "#12", "#gggggg"]) {
    assert.equal(keyFuer(wert).name, "Magenta/Pink", "Wert " + JSON.stringify(wert));
  }
});

test("die gewaehlte Schluesselfarbe steht auch in den Edit-Anweisungen", () => {
  // Die vier Ausdruecke entstehen als Edits aus dem Basisbild. Stuende dort
  // eine andere Hintergrundfarbe, kaeme das Basisbild vor Gruen und die
  // Ausdruecke vor Magenta — das Freistellen muesste bei jedem Bild neu raten.
  const { stil, edits, mundOffenEdit } = baueCharakterPrompt({ beschreibung: "Donut", farbe: "#e879a0" });
  assert.match(stil, /Grün/);
  for (const [zustand, anweisung] of Object.entries(edits)) {
    assert.match(anweisung, /Grün/, "Edit " + zustand);
  }
  assert.match(mundOffenEdit, /Grün/);
});

test("die Figur wird ausdruecklich von der Schluesselfarbe ferngehalten", () => {
  assert.match(hintergrundAnweisung("#e879a0"), /Die Figur selbst darf kein Chroma-Key-Grün enthalten/);
  // includes statt Regex: Der Schraegstrich in "Magenta/Pink" muesste sonst
  // maskiert werden, und genau daran ist diese Zeile schon einmal gescheitert.
  assert.ok(hintergrundAnweisung("#3f7d5a").includes("darf kein Magenta/Pink enthalten"));
});
