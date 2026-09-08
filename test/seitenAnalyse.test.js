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

test("analysiere: Seitentext wird auf 9000 Zeichen gedeckelt", () => {
  // 9000, nicht 1500: Beide Deckel wurden in 4130d38 bewusst angehoben, weil
  // der Agent auf langen Seiten das Wort "Preis" sonst nie sah — auf
  // start.html steht es an Zeichen 6439. Der Test wurde damals nicht
  // mitgezogen und schlug seither fehl; der Code hatte recht.
  //
  // Der Deckel in public/widget.js (seitenText()) muss denselben Wert haben.
  // Wer nur einen erhoeht, erzeugt genau den Fehler zurueck, gegen den beide
  // angehoben wurden.
  const a = A.analysiere({ text: "z".repeat(12000) });
  assert.equal(a.inhalt.length, 9000);

  // Kuerzerer Text bleibt unangetastet.
  const b = A.analysiere({ text: "z".repeat(500) });
  assert.equal(b.inhalt.length, 500);
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

// ── Produktbild ─────────────────────────────────────────────────────────────

test("ersteBildUrl: String, Array und ImageObject werden gleich behandelt", () => {
  // schema.org erlaubt alle drei Formen — die Karte zeigt ohnehin nur eines.
  assert.equal(A.ersteBildUrl("https://shop.example/a.jpg"), "https://shop.example/a.jpg");
  assert.equal(A.ersteBildUrl(["/b/1.jpg", "/b/2.jpg"]), "/b/1.jpg");
  assert.equal(A.ersteBildUrl({ "@type": "ImageObject", contentUrl: "/b/3.jpg" }), "/b/3.jpg");
  assert.equal(A.ersteBildUrl({ url: "/b/4.jpg" }), "/b/4.jpg");
});

test("ersteBildUrl: unsichere und fremde Quellen werden verworfen", () => {
  // Der Wert wird ein echtes <img src> — dieselbe Sorgfalt wie beim Link.
  assert.equal(A.ersteBildUrl("javascript:alert(1)"), "");
  assert.equal(A.ersteBildUrl("data:image/svg+xml,<svg onload=alert(1)>"), "");
  assert.equal(A.ersteBildUrl("//fremd.example/a.jpg"), "");
  assert.equal(A.ersteBildUrl(""), "");
  assert.equal(A.ersteBildUrl(null), "");
});

test("ersteBildUrl: überspringt unbrauchbare Einträge im Array", () => {
  assert.equal(A.ersteBildUrl(["javascript:x", "//fremd/a.jpg", "/gut.jpg"]), "/gut.jpg");
});

test("produkteAusJsonLd: Bild wird mit übernommen", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "Product", name: "Stuhl Lund",
    image: ["https://shop.example/lund.jpg"],
    offers: { price: "249", priceCurrency: "EUR" },
  }]);
  assert.equal(p[0].bild, "https://shop.example/lund.jpg");
});

test("produkteAusJsonLd: Produkt ohne Bild bleibt gültig", () => {
  const p = A.produkteAusJsonLd([{ "@type": "Product", name: "Ohne Bild" }]);
  assert.equal(p.length, 1);
  assert.equal(p[0].bild, undefined);
});

// ── Preis-Grenzfaelle (im Entwicklungs-Loop gefunden) ───────────────────────

test("leeres price-Feld verdraengt lowPrice nicht", () => {
  // Dieselbe Falle wie bei den og:-Metas: "" bestand die != null-Pruefung,
  // lowPrice wurde nie herangezogen. Ergebnis war "–1800,00 €".
  const p = A.produkteAusJsonLd([{
    "@type": "Product", name: "Sofa",
    offers: { "@type": "AggregateOffer", price: "", lowPrice: "1200", highPrice: "1800", priceCurrency: "EUR" },
  }]);
  assert.equal(p[0].preis, "1200,00 €–1800,00 €");
  assert.equal(p[0].betrag, 1200);
});

test("nur highPrice ist keine Spanne, sondern der Preis", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "Product", name: "X", offers: { highPrice: "99", priceCurrency: "EUR" },
  }]);
  assert.equal(p[0].preis, "99,00 €");
});

test("kein Preis liefert gar keine Preisangabe statt eines Gedankenstrichs", () => {
  for (const offers of [{ priceCurrency: "EUR" }, { price: "auf Anfrage", priceCurrency: "EUR" }]) {
    const p = A.produkteAusJsonLd([{ "@type": "Product", name: "X", offers }]);
    assert.equal(p[0].preis, undefined, JSON.stringify(offers));
  }
});

test("gleiche low- und highPrice ergeben einen Einzelpreis", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "Product", name: "X", offers: { lowPrice: "50", highPrice: "50", priceCurrency: "EUR" },
  }]);
  assert.equal(p[0].preis, "50,00 €");
});

test("Preis 0 gilt als gueltiger Preis (Gratisartikel)", () => {
  const p = A.produkteAusJsonLd([{
    "@type": "Product", name: "Probe", offers: { price: 0, priceCurrency: "EUR" },
  }]);
  assert.equal(p[0].preis, "0,00 €");
  assert.equal(p[0].betrag, 0);
});

test("keine Preisangabe erzeugt niemals einen fuehrenden Gedankenstrich", () => {
  // Waechter gegen die Rueckkehr des Fehlers in jeder Variante.
  for (const offers of [
    { price: "", highPrice: "80", priceCurrency: "EUR" },
    { lowPrice: "", highPrice: "80", priceCurrency: "EUR" },
    { highPrice: "80", priceCurrency: "EUR" },
  ]) {
    const p = A.produkteAusJsonLd([{ "@type": "Product", name: "X", offers }]);
    assert.ok(!String(p[0].preis || "").startsWith("–"),
      "fuehrender Gedankenstrich bei " + JSON.stringify(offers) + ": " + p[0].preis);
  }
});

// ── Bestellbestätigung: Wortgrenzen (Zyklus 2) ─────────────────────────────

test("seitenTyp: 'danke' muss ein ganzer Pfadabschnitt sein", () => {
  // Ohne Wortgrenze galt eine Produktseite wie "/produkte/dankeschoen-set" als
  // Bestellbestaetigung. Der Agent haette dort zu einem Kauf gratuliert, den es
  // nie gab, und keine Produkte mehr empfohlen.
  assert.equal(A.seitenTyp({ pfad: "/produkte/dankeschoen-set", titel: "Dankeschön-Set",
                             produkte: [{ name: "Set" }] }), "produkt");
  assert.equal(A.seitenTyp({ pfad: "/p/danke-karte", titel: "Dankeskarte",
                             produkte: [{ name: "Karte" }] }), "produkt");
  assert.equal(A.seitenTyp({ pfad: "/blog/danke-an-unser-team" }), "info");
});

test("seitenTyp: 'Danke für deinen Besuch' im Titel ist keine Bestellung", () => {
  // Steht auf vielen Startseiten. Nur ganze Wendungen zaehlen.
  assert.equal(A.seitenTyp({ pfad: "/", titel: "Danke für deinen Besuch" }), "info");
});

test("seitenTyp: echte Bestaetigungsseiten werden weiterhin erkannt", () => {
  for (const pfad of ["/danke", "/thank-you", "/thankyou", "/order-confirmation",
                      "/bestellbestaetigung"]) {
    assert.equal(A.seitenTyp({ pfad }), "bestaetigung", pfad);
  }
  assert.equal(A.seitenTyp({ pfad: "/x", titel: "Vielen Dank für deine Bestellung" }),
               "bestaetigung");
});

test("seitenTyp: Bestaetigung UNTERHALB der Kasse schlaegt die Kasse", () => {
  // Shopify legt die Bestaetigung unter /checkout/. Ohne Vorrang gaelte die
  // fertige Bestellung als laufender Bezahlvorgang — der Agent wuerde
  // schweigen statt zu bestaetigen.
  assert.equal(A.seitenTyp({ pfad: "/checkout/danke" }), "bestaetigung");
  assert.equal(A.seitenTyp({ pfad: "/checkout/thank_you" }), "bestaetigung");
  // Die echte Kasse bleibt aber Kasse.
  assert.equal(A.seitenTyp({ pfad: "/checkout/zahlung", titel: "Zur Kasse" }), "kasse");
});

// ── Zwei Quellen, eine Wahrheit (an dopplepress.com/Wix gefunden) ──────────

test("ergaenzeAusMeta: Preis aus den Metas fuellt die Luecke im JSON-LD", () => {
  // Echter Wix-Shop: Das JSON-LD traegt Name, Beschreibung und fuenf Bilder,
  // aber KEINEN offers-Block. Der Preis steht nur in product:price:amount.
  // Ohne Abgleich haette jede Produktkarte dieses Shops keinen Preis.
  const jsonLd = [{ "@type": "Product", name: "A4 Print Set",
                    image: "https://s.example/b.jpg" }];
  const meta = { "og:type": "product", "og:title": "A4 Print Set | Dopple",
                 "product:price:amount": "8", "product:price:currency": "GBP",
                 "og:url": "https://s.example/product-page/a4" };
  const a = A.analysiere({ pfad: "/product-page/a4", titel: "A4", jsonLd, meta });
  assert.equal(a.produkte.length, 1);
  assert.equal(a.produkte[0].preis, "8,00 £");
  assert.equal(a.produkte[0].betrag, 8);
  assert.equal(a.produkte[0].waehrung, "GBP");
  // Der Name bleibt der aus dem JSON-LD: der aus den Metas traegt den
  // Seitentitel-Anhang "| Dopple".
  assert.equal(a.produkte[0].name, "A4 Print Set");
  assert.equal(a.produkte[0].bild, "https://s.example/b.jpg");
  assert.equal(a.produkte[0].url, "https://s.example/product-page/a4");
});

test("ergaenzeAusMeta: vorhandene Werte werden NICHT ueberschrieben", () => {
  const produkte = [{ name: "X", preis: "19,90 €", betrag: 19.9, waehrung: "EUR",
                      bild: "https://s.example/echt.jpg" }];
  const meta = { "og:type": "product", "og:title": "X",
                 "product:price:amount": "99", "product:price:currency": "USD",
                 "og:image": "https://s.example/falsch.jpg" };
  const [p] = A.ergaenzeAusMeta(produkte, meta);
  assert.equal(p.preis, "19,90 €");
  assert.equal(p.waehrung, "EUR");
  assert.equal(p.bild, "https://s.example/echt.jpg");
});

test("ergaenzeAusMeta: bei mehreren Produkten wird nichts ergaenzt", () => {
  // Auf einer Uebersicht gehoeren die Seiten-Metas zur Seite, nicht zu einem
  // bestimmten Eintrag. Welchem, waere geraten.
  const produkte = [{ name: "A" }, { name: "B" }];
  const meta = { "og:type": "product", "og:title": "Kategorie",
                 "product:price:amount": "8", "product:price:currency": "GBP" };
  const raus = A.ergaenzeAusMeta(produkte, meta);
  assert.equal(raus.length, 2);
  assert.ok(!raus[0].preis && !raus[1].preis);
});

test("ergaenzeAusMeta: Metas ohne Produkt-Kennzeichen aendern nichts", () => {
  const produkte = [{ name: "X" }];
  const meta = { "og:type": "website", "og:title": "Startseite",
                 "og:description": "Willkommen", "product:price:amount": "" };
  const [p] = A.ergaenzeAusMeta(produkte, meta);
  assert.equal(p.beschreibung, undefined);
  assert.equal(p.preis, undefined);
});

// ── HTML-Entities (an dopplepress.com gefunden) ────────────────────────────

test("entschluessele: numerische Entities, dezimal und hex", () => {
  // Echter Fund: "A4 &#x27;COLOUR YOUR OWN&#x27; PRINT SET" stand so im
  // Firmen-Wissen. htmlZuText kannte nur &#39; — die Hex-Form nicht.
  assert.equal(A.entschluessele("A4 &#x27;COLOUR&#x27; SET"), "A4 'COLOUR' SET");
  assert.equal(A.entschluessele("Riso &#8211; Druck"), "Riso – Druck");
  assert.equal(A.entschluessele("&#233;clair"), "éclair");
  assert.equal(A.entschluessele("&#X2764;"), "❤");
});

test("entschluessele: benannte Entities inkl. Umlaute", () => {
  assert.equal(A.entschluessele("Web &amp; Design"), "Web & Design");
  assert.equal(A.entschluessele("Gr&ouml;&szlig;e &Uuml;bersicht"), "Größe Übersicht");
  assert.equal(A.entschluessele("9,90&nbsp;&euro;"), "9,90 €");
});

test("entschluessele: loest nur EINEN Durchgang auf", () => {
  // "&amp;lt;" muss "&lt;" ergeben, nicht "<" — sonst liesse sich eine
  // maskierte Angabe durch doppeltes Aufloesen wieder zu Markup machen.
  assert.equal(A.entschluessele("&amp;lt;script&amp;gt;"), "&lt;script&gt;");
});

test("entschluessele: laesst Unbekanntes und Ungueltiges stehen", () => {
  assert.equal(A.entschluessele("5 &foo; 6"), "5 &foo; 6");
  assert.equal(A.entschluessele("a &#0; b"), "a &#0; b");        // Steuerzeichen
  assert.equal(A.entschluessele("100 &lt 200"), "100 &lt 200");  // ohne Semikolon
  assert.equal(A.entschluessele("Preis: 5 & 6"), "Preis: 5 & 6");
});

test("Produktname aus JSON-LD kommt entschluesselt an", () => {
  // JSON-LD steht in einem <script>-Block: Entities loest dort niemand auf.
  const jsonLd = [{ "@type": "Product", name: "Tee &amp; Kr&auml;uter",
                    offers: { price: "12.50", priceCurrency: "EUR" } }];
  const a = A.analysiere({ pfad: "/p/tee", titel: "Tee", jsonLd });
  assert.equal(a.produkte[0].name, "Tee & Kräuter");
});
