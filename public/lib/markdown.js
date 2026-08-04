// Winziger Markdown-Renderer für Chat-Antworten.
//
// Warum eigen und nicht marked//markdown-it: das Widget lädt bewusst KEINE
// externen Bibliotheken (Ladezeit und Datenschutz, siehe BAUPLAN.md).
// Warum kein innerHTML: der Text kommt vom Modell und darf niemals als HTML
// ausgeführt werden (XSS). Deshalb wird geparst und daraus werden DOM-Knoten
// gebaut; Modelltext landet ausschliesslich in Textknoten.
//
// Unterstützt wird nur, was Antworten wirklich brauchen:
//   **fett**, *kursiv*, `code`, [Text](url), Aufzählungen mit "- " oder "* ",
//   nummerierte Listen ("1. "), Überschriften ("## ") und Absätze.
// Alles andere bleibt als Klartext stehen.

(function (global) {
  // Reihenfolge zählt: fett vor kursiv, sonst frisst * den Anfang von **.
  const INLINE = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

  // Nur Ziele, die im Browser gefahrlos anklickbar sind (kein javascript:).
  function sicheresZiel(url) {
    return /^(https?:\/\/|mailto:|tel:|\/)/i.test(url) ? url : null;
  }

  // Eine Zeile in Inline-Bausteine zerlegen.
  // Rückgabe: [{ typ: "text"|"fett"|"kursiv"|"code"|"link", text, ziel? }]
  function parseInline(zeile) {
    const teile = [];
    let letzte = 0;
    let m;
    INLINE.lastIndex = 0;
    while ((m = INLINE.exec(zeile)) !== null) {
      if (m.index > letzte) teile.push({ typ: "text", text: zeile.slice(letzte, m.index) });
      if (m[1] !== undefined) teile.push({ typ: "fett", text: m[1] });
      else if (m[2] !== undefined) teile.push({ typ: "fett", text: m[2] });
      else if (m[3] !== undefined) teile.push({ typ: "kursiv", text: m[3] });
      else if (m[4] !== undefined) teile.push({ typ: "code", text: m[4] });
      else {
        const ziel = sicheresZiel(m[6]);
        // Unsicheres Ziel: nur der sichtbare Text bleibt, der Link fällt weg.
        if (ziel) teile.push({ typ: "link", text: m[5], ziel: ziel });
        else teile.push({ typ: "text", text: m[5] });
      }
      letzte = m.index + m[0].length;
    }
    if (letzte < zeile.length) teile.push({ typ: "text", text: zeile.slice(letzte) });
    if (!teile.length) teile.push({ typ: "text", text: "" });
    return teile;
  }

  // Text in Blöcke zerlegen.
  // Rückgabe: [{ typ: "absatz", inline }, { typ: "liste", nummeriert, punkte: [inline] },
  //            { typ: "ueberschrift", inline }]
  function parseBlocks(text) {
    const bloecke = [];
    const zeilen = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    let absatz = [];   // gesammelte Zeilen des laufenden Absatzes
    let liste = null;  // laufender Listen-Block

    function absatzAbschliessen() {
      if (!absatz.length) return;
      bloecke.push({ typ: "absatz", inline: parseInline(absatz.join("\n")) });
      absatz = [];
    }
    function listeAbschliessen() {
      if (liste) { bloecke.push(liste); liste = null; }
    }

    for (const roh of zeilen) {
      const zeile = roh.replace(/\s+$/, "");
      const punkt = /^\s*[-*]\s+(.*)$/.exec(zeile);
      const nummer = /^\s*\d+[.)]\s+(.*)$/.exec(zeile);
      const kopf = /^\s*#{1,6}\s+(.*)$/.exec(zeile);

      if (punkt || nummer) {
        absatzAbschliessen();
        const nummeriert = !!nummer;
        if (!liste || liste.nummeriert !== nummeriert) {
          listeAbschliessen();
          liste = { typ: "liste", nummeriert: nummeriert, punkte: [] };
        }
        liste.punkte.push(parseInline((punkt || nummer)[1]));
        continue;
      }
      listeAbschliessen();

      if (kopf) {
        absatzAbschliessen();
        bloecke.push({ typ: "ueberschrift", inline: parseInline(kopf[1]) });
        continue;
      }
      if (!zeile.trim()) { absatzAbschliessen(); continue; }
      absatz.push(zeile);
    }
    absatzAbschliessen();
    listeAbschliessen();
    return bloecke;
  }

  // Klartext-Fassung: für Sprechblase und Vorlesen (dort stören die Zeichen).
  function alsText(text) {
    return parseBlocks(text)
      .map((b) => {
        if (b.typ === "liste") return b.punkte.map((p) => inlineText(p)).join("\n");
        return inlineText(b.inline);
      })
      .join("\n\n");
  }
  function inlineText(teile) {
    return teile.map((t) => t.text).join("");
  }

  // Baut aus den Blöcken echte DOM-Knoten. Modelltext nur via createTextNode.
  function nachDom(text, doc) {
    const d = doc || (typeof document !== "undefined" ? document : null);
    if (!d) throw new Error("nachDom braucht ein document");
    const frag = d.createDocumentFragment();

    function inlineRein(ziel, teile) {
      teile.forEach((t) => {
        if (t.typ === "text") { ziel.appendChild(d.createTextNode(t.text)); return; }
        const tag = t.typ === "fett" ? "strong" : t.typ === "kursiv" ? "em" : t.typ === "code" ? "code" : "a";
        const el = d.createElement(tag);
        el.appendChild(d.createTextNode(t.text));
        if (t.typ === "link") {
          el.setAttribute("href", t.ziel);
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
        ziel.appendChild(el);
      });
    }

    parseBlocks(text).forEach((b) => {
      if (b.typ === "liste") {
        const ul = d.createElement(b.nummeriert ? "ol" : "ul");
        ul.className = "md-liste";
        b.punkte.forEach((p) => {
          const li = d.createElement("li");
          inlineRein(li, p);
          ul.appendChild(li);
        });
        frag.appendChild(ul);
        return;
      }
      const el = d.createElement(b.typ === "ueberschrift" ? "strong" : "p");
      el.className = b.typ === "ueberschrift" ? "md-kopf" : "md-absatz";
      inlineRein(el, b.inline);
      frag.appendChild(el);
    });
    return frag;
  }

  const API = { parseInline, parseBlocks, alsText, nachDom };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global) global.Markdown = API;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
