// Unit-Tests für die puren Helfer des Webseiten-Scans.
// Ausführen: npm test  (nutzt den eingebauten Node-Testrunner, kein Paket nötig)

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalisiere, htmlZuText, findeUnterseiten, parseFarbe, istNeutral, ermittleFarben,
} = require("../netlify/functions/lib/webseiteScannen");

// --- normalisiere ---
test("normalisiere: ergänzt https:// wenn Schema fehlt", () => {
  assert.equal(normalisiere("firma.ch"), "https://firma.ch");
  assert.equal(normalisiere("  firma.ch "), "https://firma.ch");
});
test("normalisiere: lässt vorhandenes Schema stehen", () => {
  assert.equal(normalisiere("http://firma.ch"), "http://firma.ch");
  assert.equal(normalisiere("https://firma.ch/pfad"), "https://firma.ch/pfad");
});

// --- htmlZuText ---
test("htmlZuText: entfernt Tags, Scripts, Styles und Kommentare", () => {
  const html = `<html><head><style>body{color:red}</style>
    <script>alert("boese")</script></head>
    <body><!-- Kommentar --><h1>Hallo</h1> <p>Welt</p><noscript>nein</noscript></body></html>`;
  assert.equal(htmlZuText(html), "Hallo Welt");
});
test("htmlZuText: dekodiert HTML-Entities", () => {
  assert.equal(htmlZuText("Br&ouml;tchen &amp; Kaffee &lt;3".replace("&ouml;", "ö")), "Brötchen & Kaffee <3");
  assert.equal(htmlZuText("a&nbsp;b &quot;c&quot; &#39;d&#39;"), 'a b "c" \'d\'');
});
test("htmlZuText: kollabiert Whitespace", () => {
  assert.equal(htmlZuText("<p>  viel \n\n  Platz </p>"), "viel Platz");
});

// --- findeUnterseiten ---
const BASIS = "https://firma.ch";
test("findeUnterseiten: findet interne Seiten, wichtige zuerst", () => {
  const html = `
    <a href="/blog">Blog</a>
    <a href="/kontakt">Kontakt</a>
    <a href="https://firma.ch/preise">Preise</a>`;
  const seiten = findeUnterseiten(html, BASIS);
  assert.deepEqual(seiten, ["https://firma.ch/kontakt", "https://firma.ch/preise", "https://firma.ch/blog"]);
});
test("findeUnterseiten: ignoriert fremde Hosts und Asset-Dateien", () => {
  const html = `
    <a href="https://fremd.ch/kontakt">fremd</a>
    <a href="/bild.jpg">Bild</a>
    <a href="/styles.css">CSS</a>
    <a href="/menu.pdf">PDF</a>
    <a href="/team">Team</a>`;
  assert.deepEqual(findeUnterseiten(html, BASIS), ["https://firma.ch/team"]);
});
test("findeUnterseiten: dedupliziert und respektiert max", () => {
  const links = Array.from({ length: 10 }, (_, i) => `<a href="/seite-${i}">x</a>`).join("") +
    '<a href="/seite-1">nochmal</a>';
  const seiten = findeUnterseiten(links, BASIS, 3);
  assert.equal(seiten.length, 3);
  assert.equal(new Set(seiten).size, 3);
});
test("findeUnterseiten: Startseite selbst taucht nicht auf", () => {
  const seiten = findeUnterseiten('<a href="/">Home</a><a href="https://firma.ch">Home2</a>', BASIS);
  assert.deepEqual(seiten, []);
});

// --- parseFarbe ---
test("parseFarbe: hex 6- und 3-stellig", () => {
  assert.equal(parseFarbe("#4F46E5"), "#4f46e5");
  assert.equal(parseFarbe("color: #abc;"), "#aabbcc");
});
test("parseFarbe: rgb/rgba", () => {
  assert.equal(parseFarbe("rgb(255, 0, 0)"), "#ff0000");
  assert.equal(parseFarbe("rgba(0,128,255,0.5)"), "#0080ff");
});
test("parseFarbe: Unbrauchbares -> null", () => {
  assert.equal(parseFarbe(""), null);
  assert.equal(parseFarbe("inherit"), null);
  assert.equal(parseFarbe(null), null);
});

// --- istNeutral ---
test("istNeutral: Grau/Schwarz/Weiss sind neutral", () => {
  assert.equal(istNeutral("#ffffff"), true);
  assert.equal(istNeutral("#000000"), true);
  assert.equal(istNeutral("#888888"), true);
});
test("istNeutral: kräftige Markenfarben sind nicht neutral", () => {
  assert.equal(istNeutral("#4F46E5"), false);
  assert.equal(istNeutral("#e11d48"), false);
});

// --- ermittleFarben ---
test("ermittleFarben: CSS-Variable --primary schlägt Häufigkeit", () => {
  const css = ":root { --primary-color: #123abc; --accent: #e11d48; }";
  const html = "<div style='color:#00ff00'></div>".repeat(50);
  const { farbe1, farbe2 } = ermittleFarben(html, css);
  assert.equal(farbe1, "#123abc");
  assert.equal(farbe2, "#e11d48");
});
test("ermittleFarben: theme-color als Fallback", () => {
  const html = '<meta name="theme-color" content="#4F46E5">';
  assert.equal(ermittleFarben(html, "").farbe1, "#4f46e5");
});
test("ermittleFarben: Häufigkeit, neutrale Farben ignoriert", () => {
  const html = "#ffffff ".repeat(90) + "#e11d48 ".repeat(10) + "#123abc ".repeat(5);
  const { farbe1, farbe2 } = ermittleFarben(html, "");
  assert.equal(farbe1, "#e11d48");
  assert.equal(farbe2, "#123abc");
});
test("ermittleFarben: nichts gefunden -> null", () => {
  const { farbe1, farbe2 } = ermittleFarben("<p>nur text</p>", "");
  assert.equal(farbe1, null);
  assert.equal(farbe2, null);
});

// --- Milestone 7: Sitemap, JSON-LD, og-Meta ---
const {
  parseSitemapLocs, findeSitemapSeiten, extrahiereJsonLd, strukturierteDaten, ogMeta,
} = require("../netlify/functions/lib/webseiteScannen");

test("parseSitemapLocs: zieht loc-Einträge aus urlset und sitemapindex", () => {
  const xml = `<?xml version="1.0"?><urlset>
    <url><loc>https://firma.ch/leistungen</loc></url>
    <url><loc> https://firma.ch/team </loc></url></urlset>`;
  assert.deepEqual(parseSitemapLocs(xml), ["https://firma.ch/leistungen", "https://firma.ch/team"]);
});

test("findeSitemapSeiten: robots.txt -> Sitemap -> Seiten (fremde Hosts + Assets raus)", async () => {
  const antworten = {
    "https://firma.ch/robots.txt": "User-agent: *\nSitemap: https://firma.ch/meine-sitemap.xml",
    "https://firma.ch/meine-sitemap.xml": `<urlset>
      <url><loc>https://firma.ch/preise</loc></url>
      <url><loc>https://firma.ch/logo.png</loc></url>
      <url><loc>https://andere.ch/seite</loc></url>
      <url><loc>https://firma.ch/blog/artikel-1</loc></url></urlset>`,
  };
  const holeFn = async (u) => { if (antworten[u]) return antworten[u]; throw new Error("404"); };
  const seiten = await findeSitemapSeiten("https://firma.ch", holeFn);
  assert.ok(seiten.includes("https://firma.ch/preise"));
  assert.ok(seiten.includes("https://firma.ch/blog/artikel-1"));
  assert.ok(!seiten.some((s) => s.includes("logo.png") || s.includes("andere.ch")));
  // "preise" ist wichtig -> steht vor dem Blog-Artikel
  assert.ok(seiten.indexOf("https://firma.ch/preise") < seiten.indexOf("https://firma.ch/blog/artikel-1"));
});

test("findeSitemapSeiten: ohne robots.txt wird /sitemap.xml probiert; Fehler -> leere Liste", async () => {
  const holeFn = async (u) => {
    if (u === "https://firma.ch/sitemap.xml") return "<urlset><url><loc>https://firma.ch/faq</loc></url></urlset>";
    throw new Error("404");
  };
  assert.deepEqual(await findeSitemapSeiten("https://firma.ch", holeFn), ["https://firma.ch/faq"]);
  const nichts = async () => { throw new Error("404"); };
  assert.deepEqual(await findeSitemapSeiten("https://firma.ch", nichts), []);
});

test("extrahiereJsonLd: parst Blöcke, @graph wird aufgefaltet, kaputtes JSON ignoriert", () => {
  const html = `
    <script type="application/ld+json">{"@type":"Organization","name":"Salbei"}</script>
    <script type="application/ld+json">{"@graph":[{"@type":"Restaurant","name":"Graph-Kind"}]}</script>
    <script type="application/ld+json">{kaputt</script>`;
  const objekte = extrahiereJsonLd(html);
  assert.ok(objekte.some((o) => o.name === "Salbei"));
  assert.ok(objekte.some((o) => o.name === "Graph-Kind"));
});

test("strukturierteDaten: LocalBusiness liefert Name/Adresse/Kontakt/Öffnungszeiten", () => {
  const html = `<script type="application/ld+json">{
    "@type": "Restaurant", "name": "Salbei",
    "telephone": "+41 44 111 22 33", "email": "hallo@salbei.ch",
    "address": {"streetAddress": "Gassenweg 3", "postalCode": "8001", "addressLocality": "Zürich"},
    "openingHoursSpecification": [{"dayOfWeek": ["https://schema.org/Tuesday", "https://schema.org/Saturday"], "opens": "11:30", "closes": "14:00"}]
  }</script>`;
  const d = strukturierteDaten([html]);
  assert.equal(d.name, "Salbei");
  assert.match(d.adresse, /Gassenweg 3/);
  assert.match(d.adresse, /8001 Zürich/);
  assert.match(d.kontakt, /\+41 44 111 22 33/);
  assert.match(d.kontakt, /hallo@salbei\.ch/);
  assert.match(d.oeffnungszeiten, /Tuesday, Saturday 11:30–14:00/);
});

test("strukturierteDaten: Nicht-Firmen-Typen (Article/WebSite) werden ignoriert", () => {
  const html = `<script type="application/ld+json">{"@type":"Article","name":"Blogpost"}</script>`;
  const d = strukturierteDaten([html]);
  assert.equal(d.name, "");
});

test("ogMeta: liest og:title/description/site_name", () => {
  const html = `<head>
    <meta property="og:title" content="Salbei — Restaurant" />
    <meta property="og:description" content="Saisonale Küche in Zürich" />
    <meta property="og:site_name" content="Salbei" /></head>`;
  const og = ogMeta(html);
  assert.equal(og.titel, "Salbei — Restaurant");
  assert.equal(og.beschreibung, "Saisonale Küche in Zürich");
  assert.equal(og.name, "Salbei");
});
