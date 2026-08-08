// Unit-Tests für die puren Helfer des Webseiten-Scans.
// Ausführen: npm test  (nutzt den eingebauten Node-Testrunner, kein Paket nötig)

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalisiere, htmlZuText, findeUnterseiten, parseFarbe, istNeutral, ermittleFarben,
} = require("../netlify/functions/lib/webseiteScannen");
// Der Katalog-Teil wird als Namensraum genutzt, damit die Liste oben schlank bleibt.
const W = require("../netlify/functions/lib/webseiteScannen");

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

// ── Produktkatalog aus dem Scan ─────────────────────────────────────────────
//
// Ohne diesen Schritt kennt der Agent nach dem Onboarding keine Produktbilder
// und die Karten im Chat bleiben auf jeder echten Seite bildlos — obwohl die
// Daten im JSON-LD des Shops stehen.

const ldSeite = (objekt) =>
  '<html><head><script type="application/ld+json">' + JSON.stringify(objekt) +
  '</script></head><body>x</body></html>';

test("produktKatalog: liest Produkt mit Bild aus JSON-LD", () => {
  const html = ldSeite({
    "@context": "https://schema.org", "@type": "Product", name: "Stuhl Lund",
    description: "Eiche mit Filzsitz", image: "/media/lund.jpg",
    offers: { price: "249.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
  });
  const k = W.produktKatalog([{ html, url: "https://shop.example/p/lund" }], "https://shop.example");
  assert.equal(k.length, 1);
  assert.equal(k[0].name, "Stuhl Lund");
  assert.equal(k[0].preis, "249,00 €");
  assert.equal(k[0].verfuegbar, "verfuegbar");
});

test("produktKatalog: relative Bild- und Link-Pfade werden absolut", () => {
  // Der Katalog wird GESPEICHERT und spaeter von unserer Domain aus benutzt —
  // ein relativer Pfad zeigte dann ins Leere.
  const html = ldSeite({ "@type": "Product", name: "Stuhl", image: "/media/lund.jpg" });
  const k = W.produktKatalog([{ html, url: "https://shop.example/p/lund" }], "https://shop.example");
  assert.equal(k[0].bild, "https://shop.example/media/lund.jpg");
  assert.equal(k[0].url, "https://shop.example/p/lund");
});

test("produktKatalog: absolute Bild-URLs (CDN) bleiben unveraendert", () => {
  const html = ldSeite({ "@type": "Product", name: "Stuhl", image: "https://cdn.example/a.jpg" });
  const k = W.produktKatalog([{ html, url: "https://shop.example/p/x" }], "https://shop.example");
  assert.equal(k[0].bild, "https://cdn.example/a.jpg");
});

test("produktKatalog: Shops ohne JSON-LD liefern ueber og:-Metas", () => {
  const html = '<html><head>' +
    '<meta property="og:type" content="product">' +
    '<meta property="og:title" content="Leuchte Sund">' +
    '<meta property="og:image" content="/media/leuchte.jpg">' +
    '<meta property="product:price:amount" content="179.00">' +
    '<meta property="product:price:currency" content="EUR">' +
    '</head><body>x</body></html>';
  const k = W.produktKatalog([{ html, url: "https://shop.example/p/leuchte" }], "https://shop.example");
  assert.equal(k[0].name, "Leuchte Sund");
  assert.equal(k[0].bild, "https://shop.example/media/leuchte.jpg");
});

test("produktKatalog: dasselbe Produkt auf mehreren Seiten erscheint einmal", () => {
  const html = ldSeite({ "@type": "Product", name: "Stuhl Lund" });
  const k = W.produktKatalog([
    { html, url: "https://shop.example/p/lund" },
    { html, url: "https://shop.example/shop" },
  ], "https://shop.example");
  assert.equal(k.length, 1);
});

test("produktKatalog: Seiten ohne Produkte liefern einen leeren Katalog", () => {
  const k = W.produktKatalog([
    { html: "<html><body>Ueber uns</body></html>", url: "https://shop.example/ueber" },
    { html: null, url: "https://shop.example/kaputt" },
  ], "https://shop.example");
  assert.deepEqual(k, []);
});

test("produktKatalog: deckelt die Anzahl", () => {
  const seiten = [];
  for (let i = 0; i < 60; i++) {
    seiten.push({ html: ldSeite({ "@type": "Product", name: "P" + i }), url: "https://shop.example/p/" + i });
  }
  assert.equal(W.produktKatalog(seiten, "https://shop.example").length, 40);
});

test("absolut: unbrauchbare Pfade ergeben leer statt einer kaputten URL", () => {
  assert.equal(W.absolut("", "https://shop.example"), "");
  assert.equal(W.absolut(null, "https://shop.example"), "");
});

test("katalogText: nennt Link und Bild benannt, damit der Agent sie zuordnen kann", () => {
  const t = W.katalogText([
    { name: "Stuhl Lund", preis: "249,00 €", url: "https://shop.example/p/lund",
      bild: "https://shop.example/media/lund.jpg" },
  ]);
  assert.match(t, /PRODUKTE/);
  assert.match(t, /Link: https:\/\/shop\.example\/p\/lund/);
  assert.match(t, /Bild: https:\/\/shop\.example\/media\/lund\.jpg/);
});

test("katalogText: leerer Katalog ergibt leeren Text (kein Wissens-Rauschen)", () => {
  assert.equal(W.katalogText([]), "");
  assert.equal(W.katalogText(null), "");
});

// ── Was der Test an einem echten Shop (Shopify) zutage gefördert hat ────────

test("sortiereWichtige: Produktseiten kommen zuerst", () => {
  // "produkt" (deutsch, mit k) matcht NICHT "products" (englisch, mit c).
  // An einem echten Shop fielen deshalb alle neun Produktseiten aus dem Deckel,
  // waehrend Suche, Konto und AGB gescannt wurden.
  const sortiert = W.sortiereWichtige([
    "https://s.example/collections/shop-all",
    "https://s.example/products/karolina",
    "https://s.example/pages/about",
    "https://s.example/products/alina",
  ]);
  assert.ok(/\/products\//.test(sortiert[0]), "erste sollte Produktseite sein: " + sortiert[0]);
  assert.ok(/\/products\//.test(sortiert[1]), "zweite sollte Produktseite sein: " + sortiert[1]);
});

test("sortiereWichtige: reine Funktionsseiten fallen raus", () => {
  // Sie tragen zwar oft ein wichtiges Wort ("shop-all"), enthalten aber kein
  // Wissen ueber die Firma und kosten nur Scan-Budget.
  const sortiert = W.sortiereWichtige([
    "https://s.example/search",
    "https://s.example/account",
    "https://s.example/cart",
    "https://s.example/policies/shipping-policy",
    "https://s.example/collections/new-arrivals.oembed",
    "https://s.example/products/karolina",
  ]);
  assert.deepEqual(sortiert, ["https://s.example/products/karolina"]);
});

test("aufHttps: http-Bilder werden hochgestuft (gemischter Inhalt)", () => {
  // Shopify liefert og:image mit http://, obwohl der Shop ueber https laeuft.
  // Der Browser blockiert das Bild dann als gemischten Inhalt.
  assert.equal(W.aufHttps("http://shop.example/a.jpg"), "https://shop.example/a.jpg");
  assert.equal(W.aufHttps("https://shop.example/a.jpg"), "https://shop.example/a.jpg");
  assert.equal(W.aufHttps(""), "");
});

test("absolut: stuft http-URLs mit hoch", () => {
  assert.equal(W.absolut("http://cdn.example/a.jpg", "https://s.example"),
    "https://cdn.example/a.jpg");
});

test("produktKatalog: eine Kategorieseite ist KEIN Produkt", () => {
  // Genau der Fehlbefund am echten Shop: og:type war "website", aber die
  // leeren product:-Metas galten wegen "" != null als vorhanden — der
  // Seitentitel wurde zum Produktnamen.
  const kategorie = '<html><head>' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:title" content="New In | Shop">' +
    '<meta property="og:image" content="/media/kategorie.png">' +
    '<meta property="product:price:amount" content="">' +
    '</head><body>Neuheiten</body></html>';
  assert.deepEqual(
    W.produktKatalog([{ html: kategorie, url: "https://s.example/collections/new" }], "https://s.example"),
    []
  );
});

// ── Öffnungszeiten aus Baukasten-Seiten ─────────────────────────────────────

test("saubereZeitangabe: leere Einträge fallen raus", () => {
  // Squarespace schreibt für geschlossene Tage einen LEEREN Platz in die Liste.
  // An einem echten Gastro-Betrieb kam so ", Tu 07:00-22:00, ..., " heraus —
  // mit führendem Komma, das der Agent genau so vorgelesen haette.
  assert.equal(
    W.saubereZeitangabe(", Tu 07:00-22:00, We 07:00-22:00, Sa 08:00-23:00, "),
    "Tu 07:00-22:00, We 07:00-22:00, Sa 08:00-23:00"
  );
});

test("saubereZeitangabe: saubere Angaben bleiben unveraendert", () => {
  assert.equal(W.saubereZeitangabe("Mo-Fr 09:00-18:00"), "Mo-Fr 09:00-18:00");
  assert.equal(W.saubereZeitangabe(""), "");
  assert.equal(W.saubereZeitangabe(null), "");
});

test("formatiereOeffnung: String-Angaben werden gesaeubert", () => {
  assert.equal(
    W.formatiereOeffnung(", Tu 07:00-22:00, Fr 07:00-23:00, "),
    "Tu 07:00-22:00, Fr 07:00-23:00"
  );
});

test("formatiereOeffnung: eine Angabe, die NUR aus Trennern besteht, ergibt leer", () => {
  // Besser gar keine Angabe als eine sinnlose — der Agent sagt dann ehrlich,
  // dass er die Zeiten nicht kennt.
  assert.equal(W.formatiereOeffnung(", , ,"), "");
});

test("formatiereOeffnung: strukturierte Angaben funktionieren weiter", () => {
  assert.match(
    W.formatiereOeffnung({ dayOfWeek: "https://schema.org/Monday", opens: "09:00", closes: "18:00" }),
    /Monday 09:00.18:00/
  );
});

// ── Katalog-Groesse im Prompt (Zyklus 2) ───────────────────────────────────

test("katalogText: bleibt auch bei vollem Katalog bezahlbar", () => {
  // Der Katalog geht ins Firmen-Wissen und damit in JEDE Chat-Anfrage. Ohne
  // Deckel waren es gemessen 17.600 Zeichen (~4.400 Token) pro Nachricht.
  const kat = [];
  for (let i = 0; i < 40; i++) {
    kat.push({ name: "Produkt " + i, preis: "1234,00 CHF", verfuegbar: "verfuegbar",
      beschreibung: "y".repeat(240),
      url: "https://shop.example/products/sehr-langer-produkt-name-" + i,
      bild: "https://shop.example/cdn/shop/files/1234567-abc-Name-9999_1000x.jpg?v=1786178034" });
  }
  const t = W.katalogText(kat);
  assert.ok(t.length <= 8200, "Katalogtext zu gross: " + t.length);
});

test("katalogText: sagt ehrlich, wenn nicht alles aufgefuehrt ist", () => {
  // Sonst glaubt der Agent, er kenne das ganze Sortiment.
  // Bewusst mit realistisch LANGEN Shopify-URLs: mit kurzen Pfaden passen 40
  // Produkte noch unter den Deckel, dann gaebe es zu Recht keinen Hinweis.
  const kat = [];
  for (let i = 0; i < 40; i++) {
    kat.push({ name: "Produkt " + i, preis: "1234,00 CHF", verfuegbar: "verfuegbar",
      beschreibung: "z".repeat(240),
      url: "https://shop.example/products/sehr-langer-produkt-name-" + i,
      bild: "https://shop.example/cdn/shop/files/1234567-abc-Name-9999_1000x.jpg?v=1786178034" });
  }
  const t = W.katalogText(kat);
  assert.match(t, /nicht aufgeführt/);
  assert.ok((t.match(/^- /gm) || []).length < 40, "es sollten nicht alle 40 drinstehen");
});

test("katalogText: kleine Kataloge werden vollstaendig und ungekuerzt gezeigt", () => {
  const kat = [
    { name: "Celia Dots", preis: "98,00 CHF", verfuegbar: "verfuegbar",
      url: "https://s.example/p/celia", bild: "https://s.example/b/celia.jpg" },
    { name: "Karolina", preis: "89,00 CHF", verfuegbar: "verfuegbar",
      url: "https://s.example/p/karolina", bild: "https://s.example/b/karolina.jpg" },
  ];
  const t = W.katalogText(kat);
  assert.match(t, /Celia Dots/);
  assert.match(t, /Karolina/);
  assert.doesNotMatch(t, /nicht aufgeführt/);
});

test("katalogText: lange Beschreibungen werden gekuerzt und markiert", () => {
  const t = W.katalogText([{ name: "X", beschreibung: "a".repeat(300), url: "https://s.example/x" }]);
  assert.match(t, /…/, "Kuerzung sollte sichtbar markiert sein");
  assert.ok(!t.includes("a".repeat(120)), "Beschreibung wurde nicht gekuerzt");
});

// ── CMS-Maschinen-Endpunkte (an wp-experten.ch gefunden) ───────────────────

test("sortiereWichtige: WordPress-Endpunkte fallen raus", () => {
  // An einer echten WordPress-Seite belegten /feed, /wp-json,
  // /wp-json/oembed/1.0/embed, /wp-json/wp/v2/pages/9349 und /xmlrpc.php
  // FUENF von elf Scan-Plaetzen. Sie liefern JSON oder XML, kein Firmenwissen —
  // waehrend echte Inhaltsseiten aus dem Deckel fielen.
  const raus = ["https://a.ch/wp-json", "https://a.ch/wp-json/wp/v2/pages/9349",
    "https://a.ch/xmlrpc.php", "https://a.ch/feed", "https://a.ch/blog/feed",
    "https://a.ch/wp-admin", "https://a.ch/wp-login.php", "https://a.ch/rss"];
  assert.deepEqual(W.sortiereWichtige(raus), []);
});

test("sortiereWichtige: aehnlich benannte Inhaltsseiten bleiben erhalten", () => {
  // Waechter gegen zu breite Muster: /feedback ist kein /feed, /atomkraft kein
  // /atom, /embedded-systeme kein /embed.
  const drin = ["https://a.ch/feedback", "https://a.ch/newsfeed-abo",
    "https://a.ch/wordpress-experten", "https://a.ch/embedded-systeme",
    "https://a.ch/atomkraft", "https://a.ch/amphitheater",
    "https://a.ch/webdesign-agentur-zuerich"];
  assert.equal(W.sortiereWichtige(drin).length, drin.length);
});
