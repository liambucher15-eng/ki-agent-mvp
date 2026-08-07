// Tests für die Seitenanalyse — der Teil, der versteht, WAS auf der Seite steht.
// Bewusst nur die reinen Funktionen: sie bekommen bereits eingesammelte Rohdaten,
// brauchen also kein DOM und laufen direkt in Node.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const A = require("../netlify/functions/lib/seiten-analyse");

// ── Preise ──────────────────────────────────────────────────────────────────

test("zuBetrag: deutsche und englische Schreibweise ergeben denselben Betrag", () => {
  assert.equal(A.zuBetrag("1.299,00"), 1299);
  assert.equal(A.zuBetrag("1,299.00"), 1299);
  assert.equal(A.zuBetrag("19,90"), 19.9);
  assert.equal(A.zuBetrag("19.90"), 19.9);
});

test("zuBetrag: Währungszeichen und Text stören nicht", () => {
  assert.equal(A.zuBetrag("EUR 19.90"), 19.9);
  assert.equal(A.zuBetrag("€ 1.299,00"), 1299);
  assert.equal(A.zuBetrag(49), 49);
});

test("zuBetrag: unbrauchbare Werte ergeben null", () => {
  assert.equal(A.zuBetrag(""), null);
  assert.equal(A.zuBetrag("auf Anfrage"), null);
  assert.equal(A.zuBetrag(null), null);
  assert.equal(A.zuBetrag(undefined), null);
  assert.equal(A.zuBetrag({}), null);
});

test("preisText: Betrag + Währung werden lesbar formatiert", () => {
  assert.equal(A.preisText(19.9, "EUR"), "19,90 €");
  assert.equal(A.preisText(1299, "CHF"), "1299,00 CHF");
  assert.equal(A.preisText(null, "EUR"), "");
});

test("verfuegbarkeit: schema.org-URLs werden auf ein Wort verdichtet", () => {
  assert.equal(A.verfuegbarkeit("https://schema.org/InStock"), "verfuegbar");
  assert.equal(A.verfuegbarkeit("http://schema.org/OutOfStock"), "ausverkauft");
  assert.equal(A.verfuegbarkeit("PreOrder"), "vorbestellbar");
  assert.equal(A.verfuegbarkeit(""), "");
  assert.equal(A.verfuegbarkeit("irgendwas"), "");
});

// ── Produkte aus JSON-LD ────────────────────────────────────────────────────

test("produkteAusJsonLd: einfaches Produkt mit Angebot", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "Product",
    name: "Eichentisch Nord",
    description: "Massivholz, 200cm",
    brand: { name: "Nordform" },
    offers: { "@type": "Offer", price: "899.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
  }]);
  assert.equal(p.length, 1);
  assert.equal(p[0].name, "Eichentisch Nord");
  assert.equal(p[0].preis, "899,00 €");
  assert.equal(p[0].betrag, 899);
  assert.equal(p[0].verfuegbar, "verfuegbar");
  assert.equal(p[0].marke, "Nordform");
});

test("produkteAusJsonLd: @graph wird aufgefaltet", () => {
  const p = A.produkteAusJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Nicht ein Produkt" },
      { "@type": "Product", name: "Stuhl Lund", offers: { price: 149, priceCurrency: "EUR" } },
    ],
  });
  assert.equal(p.length, 1);
  assert.equal(p[0].name, "Stuhl Lund");
});

test("produkteAusJsonLd: ItemList mit verschachtelten Produkten", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "ItemList",
    itemListElement: [
      { "@type": "ListItem", item: { "@type": "Product", name: "Lampe A", offers: { price: 59, priceCurrency: "EUR" } } },
      { "@type": "ListItem", item: { "@type": "Product", name: "Lampe B", offers: { price: 79, priceCurrency: "EUR" } } },
    ],
  }]);
  assert.equal(p.length, 2);
  assert.deepEqual(p.map((x) => x.name), ["Lampe A", "Lampe B"]);
});

test("produkteAusJsonLd: mehrere Angebote -> günstigstes als Einstiegspreis", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "Product",
    name: "T-Shirt",
    offers: [
      { "@type": "Offer", price: "29.90", priceCurrency: "EUR" },
      { "@type": "Offer", price: "19.90", priceCurrency: "EUR" },
    ],
  }]);
  assert.equal(p[0].betrag, 19.9);
});

test("produkteAusJsonLd: AggregateOffer wird als Spanne dargestellt", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "Product",
    name: "Sofa Malmö",
    offers: { "@type": "AggregateOffer", lowPrice: "1200", highPrice: "1800", priceCurrency: "EUR" },
  }]);
  assert.equal(p[0].preis, "1200,00 €–1800,00 €");
  assert.equal(p[0].betrag, 1200);
});

test("produkteAusJsonLd: @type als Array wird erkannt", () => {
  const p = A.produkteAusJsonLd([{ "@type": ["Product", "Thing"], name: "Vase" }]);
  assert.equal(p.length, 1);
});

test("produkteAusJsonLd: dasselbe Produkt aus zwei Blöcken erscheint nur einmal", () => {
  const p = A.produkteAusJsonLd([
    { "@type": "Product", name: "Regal Oslo" },
    { "@type": "Product", name: "regal oslo" },
  ]);
  assert.equal(p.length, 1);
});

test("produkteAusJsonLd: Produkt ohne Namen wird verworfen", () => {
  const p = A.produkteAusJsonLd([{ "@type": "Product", offers: { price: 10 } }]);
  assert.equal(p.length, 0);
});

test("produkteAusJsonLd: kaputte/leere Eingaben ergeben eine leere Liste", () => {
  assert.deepEqual(A.produkteAusJsonLd(null), []);
  assert.deepEqual(A.produkteAusJsonLd([]), []);
  assert.deepEqual(A.produkteAusJsonLd(["kein objekt"]), []);
  assert.deepEqual(A.produkteAusJsonLd([{ "@type": "Article", name: "Blogpost" }]), []);
});

test("produkteAusJsonLd: deckelt die Anzahl (Kostenschutz im Prompt)", () => {
  const viele = [];
  for (let i = 0; i < 40; i++) viele.push({ "@type": "Product", name: "Produkt " + i });
  assert.equal(A.produkteAusJsonLd(viele).length, 8);
});

test("produkteAusJsonLd: tiefe Verschachtelung läuft nicht endlos", () => {
  // Selbstbezügliche Struktur — darf weder hängen noch werfen.
  const knoten = { "@type": "ItemList" };
  knoten.itemListElement = knoten;
  assert.doesNotThrow(() => A.produkteAusJsonLd([knoten]));
});

test("produkteAusJsonLd: überlange Texte werden gekappt", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "Product", name: "x".repeat(500), description: "y".repeat(900),
  }]);
  assert.equal(p[0].name.length, 160);
  assert.equal(p[0].beschreibung.length, 240);
});

// ── Produkt aus Open-Graph-Meta ─────────────────────────────────────────────

test("produktAusMeta: og:type=product mit Preis", () => {
  const p = A.produktAusMeta({
    "og:type": "product",
    "og:title": "Wollteppich Fjord",
    "og:description": "Handgewebt",
    "product:price:amount": "249.00",
    "product:price:currency": "EUR",
    "product:availability": "instock",
  });
  assert.equal(p.name, "Wollteppich Fjord");
  assert.equal(p.preis, "249,00 €");
  assert.equal(p.verfuegbar, "verfuegbar");
});

test("produktAusMeta: normale Seite (og:type=website) ist kein Produkt", () => {
  assert.equal(A.produktAusMeta({ "og:type": "website", "og:title": "Über uns" }), null);
  assert.equal(A.produktAusMeta({}), null);
  assert.equal(A.produktAusMeta(null), null);
});

test("produktAusMeta: Preis-Angabe allein reicht als Produkt-Signal", () => {
  const p = A.produktAusMeta({ "og:title": "Kerzenhalter", "product:price:amount": "19,90" });
  assert.equal(p.betrag, 19.9);
});

// ── Seitentyp ───────────────────────────────────────────────────────────────

test("seitenTyp: Warenkorb und Kasse werden am Pfad erkannt", () => {
  assert.equal(A.seitenTyp({ pfad: "/warenkorb" }), "warenkorb");
  assert.equal(A.seitenTyp({ pfad: "/cart" }), "warenkorb");
  assert.equal(A.seitenTyp({ pfad: "/checkout/zahlung" }), "kasse");
  assert.equal(A.seitenTyp({ pfad: "/kasse" }), "kasse");
});

test("seitenTyp: Kasse/Warenkorb schlagen die Produktzählung", () => {
  // Im Warenkorb stehen Produkte — trotzdem ist es der Warenkorb, nicht eine
  // Produktseite. Sonst würde der Agent dort falsch beraten statt zu helfen.
  const typ = A.seitenTyp({ pfad: "/warenkorb", produkte: [{ name: "A" }] });
  assert.equal(typ, "warenkorb");
});

test("seitenTyp: ein Produkt -> Produktseite, mehrere -> Kategorie", () => {
  assert.equal(A.seitenTyp({ pfad: "/p/stuhl", produkte: [{ name: "Stuhl" }] }), "produkt");
  assert.equal(A.seitenTyp({ pfad: "/shop", produkte: [{ name: "A" }, { name: "B" }] }), "kategorie");
});

test("seitenTyp: ohne strukturierte Daten greifen Pfad-Hinweise", () => {
  assert.equal(A.seitenTyp({ pfad: "/preise" }), "preise");
  assert.equal(A.seitenTyp({ pfad: "/pricing" }), "preise");
  assert.equal(A.seitenTyp({ pfad: "/kontakt" }), "kontakt");
  assert.equal(A.seitenTyp({ pfad: "/shop/moebel" }), "kategorie");
  assert.equal(A.seitenTyp({ pfad: "/ueber-uns" }), "info");
  assert.equal(A.seitenTyp({}), "info");
});

test("seitenTyp: Bestellbestätigung wird erkannt", () => {
  assert.equal(A.seitenTyp({ pfad: "/danke" }), "bestaetigung");
  assert.equal(A.seitenTyp({ pfad: "/order-confirmation" }), "bestaetigung");
});

// ── Gesamtanalyse ───────────────────────────────────────────────────────────

test("analysiere: Produktseite ergibt Typ, Produkt und Hauptprodukt", () => {
  const a = A.analysiere({
    pfad: "/p/eichentisch",
    titel: "Eichentisch Nord kaufen",
    jsonLd: [{ "@type": "Product", name: "Eichentisch Nord", offers: { price: "899", priceCurrency: "EUR" } }],
    meta: {},
    text: "Ein schöner Tisch aus Eiche.",
  });
  assert.equal(a.typ, "produkt");
  assert.equal(a.produkte.length, 1);
  assert.equal(a.hauptprodukt.name, "Eichentisch Nord");
  assert.equal(a.inhalt, "Ein schöner Tisch aus Eiche.");
});

test("analysiere: ohne JSON-LD wird auf Open-Graph zurückgefallen", () => {
  const a = A.analysiere({
    pfad: "/p/teppich", titel: "Teppich",
    jsonLd: [],
    meta: { "og:type": "product", "og:title": "Wollteppich", "product:price:amount": "249" },
    text: "",
  });
  assert.equal(a.typ, "produkt");
  assert.equal(a.produkte[0].name, "Wollteppich");
});

test("analysiere: Kategorieseite ohne Hauptprodukt", () => {
  const a = A.analysiere({
    pfad: "/shop", titel: "Shop",
    jsonLd: [{ "@type": "ItemList", itemListElement: [
      { item: { "@type": "Product", name: "A" } },
      { item: { "@type": "Product", name: "B" } },
    ] }],
  });
  assert.equal(a.typ, "kategorie");
  assert.equal(a.hauptprodukt, undefined);
});

test("analysiere: leere/kaputte Eingabe wirft nicht", () => {
  assert.doesNotThrow(() => A.analysiere(null));
  const a = A.analysiere({});
  assert.equal(a.typ, "info");
  assert.deepEqual(a.produkte, []);
});

test("analysiere: Seitentext wird auf 1500 Zeichen gedeckelt", () => {
  const a = A.analysiere({ text: "z".repeat(5000) });
  assert.equal(a.inhalt.length, 1500);
});

// ── Zusammenfassung für den Prompt ──────────────────────────────────────────

test("zusammenfassung: nennt Seitentyp und listet Produkte mit Preis", () => {
  const s = A.zusammenfassung({
    pfad: "/p/tisch", titel: "Eichentisch", typ: "produkt",
    produkte: [{ name: "Eichentisch Nord", preis: "899,00 €", verfuegbar: "verfuegbar" }],
  });
  assert.ok(s.includes("Produktseite"), "Seitentyp fehlt: " + s);
  assert.ok(s.includes("Eichentisch Nord"));
  assert.ok(s.includes("899,00 €"));
  assert.ok(s.includes("verfuegbar"));
});

test("zusammenfassung: Kasse wird klar benannt (dort hilft der Agent anders)", () => {
  const s = A.zusammenfassung({ pfad: "/kasse", titel: "Kasse", typ: "kasse", produkte: [] });
  assert.ok(/Kasse/.test(s), s);
});

test("zusammenfassung: kommt ohne Produkte aus", () => {
  const s = A.zusammenfassung({ pfad: "/ueber-uns", titel: "Über uns", typ: "info", produkte: [] });
  assert.ok(s.length > 10);
  assert.ok(!s.includes("- "));
});
