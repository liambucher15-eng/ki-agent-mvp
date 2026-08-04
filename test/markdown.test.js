// Tests für den kleinen Markdown-Renderer der Chat-Antworten.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { parseInline, parseBlocks, alsText, nachDom } = require("../public/lib/markdown");

test("parseInline: fett, kursiv und Code werden erkannt", () => {
  assert.deepEqual(parseInline("Was kann ich **für dich** tun?"), [
    { typ: "text", text: "Was kann ich " },
    { typ: "fett", text: "für dich" },
    { typ: "text", text: " tun?" },
  ]);
  assert.deepEqual(parseInline("*leise*"), [{ typ: "kursiv", text: "leise" }]);
  assert.deepEqual(parseInline("`npm test`"), [{ typ: "code", text: "npm test" }]);
  assert.deepEqual(parseInline("__auch fett__"), [{ typ: "fett", text: "auch fett" }]);
});

test("parseInline: fett gewinnt vor kursiv", () => {
  assert.deepEqual(parseInline("**a**"), [{ typ: "fett", text: "a" }]);
});

test("parseInline: nur sichere Link-Ziele bleiben Links", () => {
  assert.deepEqual(parseInline("[hier](https://beispiel.ch)"), [
    { typ: "link", text: "hier", ziel: "https://beispiel.ch" },
  ]);
  // javascript: wird verworfen, nur der sichtbare Text bleibt (kein Link)
  const teile = parseInline("[klick](javascript:alert(1))");
  assert.equal(teile.every((t) => t.typ === "text"), true);
  assert.equal(teile.map((t) => t.text).join(""), "klick)");
});

test("parseInline: Text ohne Markdown bleibt unverändert", () => {
  assert.deepEqual(parseInline("2 * 3 = 6"), [{ typ: "text", text: "2 * 3 = 6" }]);
});

test("parseBlocks: Absätze, Liste und Überschrift", () => {
  const b = parseBlocks("## Titel\n\nHallo\n\n- Punkt **eins**\n- Punkt zwei\n\nTschüss");
  assert.deepEqual(b.map((x) => x.typ), ["ueberschrift", "absatz", "liste", "absatz"]);
  assert.equal(b[2].punkte.length, 2);
  assert.equal(b[2].nummeriert, false);
  assert.deepEqual(b[2].punkte[0][1], { typ: "fett", text: "eins" });
});

test("parseBlocks: nummerierte Liste und Wechsel des Listentyps", () => {
  const b = parseBlocks("1. eins\n2. zwei\n- drei");
  assert.deepEqual(b.map((x) => x.typ), ["liste", "liste"]);
  assert.equal(b[0].nummeriert, true);
  assert.equal(b[1].nummeriert, false);
});

test("parseBlocks: leerer oder fehlender Text -> keine Blöcke", () => {
  assert.deepEqual(parseBlocks(""), []);
  assert.deepEqual(parseBlocks(null), []);
});

test("alsText: Markdown-Zeichen verschwinden fürs Vorlesen", () => {
  assert.equal(alsText("**Hallo** *du*"), "Hallo du");
  assert.equal(alsText("- a\n- b"), "a\nb");
});

test("nachDom: baut Knoten statt HTML-Text", () => {
  const doc = falschesDocument();
  const frag = nachDom("Hallo **Welt**\n\n- ein *Punkt*", doc);
  assert.equal(frag.kinder.length, 2);
  const p = frag.kinder[0];
  assert.equal(p.tag, "p");
  assert.equal(p.kinder[0].text, "Hallo ");
  assert.equal(p.kinder[1].tag, "strong");
  const ul = frag.kinder[1];
  assert.equal(ul.tag, "ul");
  assert.equal(ul.kinder[0].tag, "li");
  assert.equal(ul.kinder[0].kinder[1].tag, "em");
});

test("nachDom: HTML im Modelltext bleibt Text, wird nicht zu Elementen", () => {
  const doc = falschesDocument();
  const frag = nachDom("<img src=x onerror=alert(1)> **ok**", doc);
  const p = frag.kinder[0];
  assert.equal(p.kinder[0].text, "<img src=x onerror=alert(1)> ");
  assert.equal(p.kinder[0].tag, undefined); // reiner Textknoten
});

test("nachDom: Links bekommen rel/target", () => {
  const doc = falschesDocument();
  const a = nachDom("[da](https://beispiel.ch)", doc).kinder[0].kinder[0];
  assert.equal(a.tag, "a");
  assert.equal(a.attr.href, "https://beispiel.ch");
  assert.equal(a.attr.rel, "noopener noreferrer");
});

// Minimales DOM-Double: reicht für createElement/createTextNode/appendChild.
function falschesDocument() {
  const knoten = (tag) => ({ tag, kinder: [], attr: {}, className: "",
    appendChild(k) { this.kinder.push(k); return k; },
    setAttribute(n, w) { this.attr[n] = w; } });
  return {
    createElement: (tag) => knoten(tag),
    createTextNode: (text) => ({ text }),
    createDocumentFragment: () => knoten(undefined),
  };
}
