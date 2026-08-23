// Tests für die öffentliche /firma-Function — sie entscheidet, WAS ein fremder
// Browser über eine Firma erfährt. Zwei Dinge sind hier wichtig:
//
//   1) Das Abo-Gate: ohne aktives Abo dürfen die Charakterbilder nicht raus —
//      aber nur, wenn ein Abo überhaupt abschliessbar ist (Stripe eingerichtet).
//      Ohne Stripe kann niemand auf "plus" kommen; dann wäre der im Onboarding
//      erstellte Charakter dauerhaft unsichtbar und die Kette Onboarding ->
//      Dashboard -> Chat gar nicht lauffähig.
//   2) Private Felder (E-Mail, Webseite, Wissen, Charakter-Beschreibung) bleiben
//      draussen — das Widget bekommt nur, was es zum Anzeigen braucht.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const FIRMA_LADEN = require.resolve("../netlify/functions/lib/firmaLaden");
const STRIPE = require.resolve("../netlify/functions/lib/stripe");
const FIRMA = require.resolve("../netlify/functions/firma");

// Lädt firma.js frisch, mit einer untergeschobenen Firma und einem definierten
// Stripe-Zustand. Nötig, weil sowohl firma.js als auch stripe.js ihre Abhängig-
// keiten bzw. Env-Variablen beim Laden einlesen und danach aus dem Cache kommen.
function ladeHandler(firma, { stripeAn }) {
  delete require.cache[FIRMA];
  delete require.cache[STRIPE];
  delete require.cache[FIRMA_LADEN];

  if (stripeAn) {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_PREIS_PLUS = "price_plus_1";
  } else {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PREIS_PLUS;
    delete process.env.STRIPE_PREIS_BASIS;
    delete process.env.STRIPE_PREIS_ID;
  }

  require.cache[FIRMA_LADEN] = {
    id: FIRMA_LADEN, filename: FIRMA_LADEN, loaded: true, children: [], paths: [],
    exports: { ladeFirmaServer: async () => firma },
  };
  return require(FIRMA).handler;
}

function baueFirma(plan) {
  return {
    id: "test-firma", name: "Test AG", plan,
    email: "geheim@test.ch", webseite: "https://test.ch",
    wissensquellen: [{ id: "scan", titel: "intern", text: "Nur für den Prompt." }],
    persona: { name: "Robin", rolle: "Gastgeber" },
    charakter: {
      farbe: "#4F46E5", akzent: "#FB7185", schrift: "Inter",
      beschreibung: "Ein grüner Fuchs mit Schal.",
      bilder: { idle: "https://x/idle.png", denken: "https://x/denken.png" },
    },
    faq: [{ frage: "Offen?", antwort: "Mo-Fr" }],
    fakten: { Adresse: "Teststrasse 1" },
  };
}

async function hole(firma, optionen) {
  const handler = ladeHandler(firma, optionen);
  const res = await handler({ queryStringParameters: { id: "test-firma" } });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

test("Abo aktiv (plan=plus): Charakterbilder werden ausgeliefert", async () => {
  const { status, body } = await hole(baueFirma("plus"), { stripeAn: true });
  assert.equal(status, 200);
  assert.ok(body.charakter.bilder, "bilder sollten vorhanden sein");
  assert.equal(body.charakter.bilder.idle, "https://x/idle.png");
});

// Bis zum Umbau der Preisseite stand hier das Gegenteil: "Stripe eingerichtet
// + kein Abo -> Bilder werden entfernt". Das passte zur alten Ordnung, in der
// die Figur das Unterscheidungsmerkmal des teuersten Plans war.
//
// Diese Ordnung gibt es nicht mehr. Die Preisseite nennt die Figur in JEDEM
// Plan, auch im kostenlosen. Waere das Gate geblieben, haette nach
// migration-plaene.sql sogar ein ZAHLENDER grow-Kunde sein Gesicht verloren,
// weil "grow" nicht "plus" ist.
test("Die Figur kommt in JEDEM Plan durch — auch gratis, auch mit Stripe", async () => {
  for (const plan of ["free", "start", "grow", "scale"]) {
    const { body } = await hole(baueFirma(plan), { stripeAn: true });
    assert.equal(body.plan, plan);
    assert.ok(body.charakter.bilder, "Plan " + plan + ": Figur muss durchkommen");
    assert.equal(body.charakter.bilder.idle, "https://x/idle.png");
    assert.equal(body.charakter.farbe, "#4F46E5");
  }
});

test("Auch die alten Plan-Namen verlieren die Figur nicht", async () => {
  // basis/plus stehen noch in lib/stripe.js und im Webhook. Solange das so
  // ist, koennen sie auch wieder in der Spalte landen.
  for (const plan of ["basis", "plus", "enterprise"]) {
    const { body } = await hole(baueFirma(plan), { stripeAn: true });
    assert.ok(body.charakter.bilder, "Plan " + plan + ": Figur muss durchkommen");
  }
});

test("Ohne Stripe kommt die Figur ebenfalls durch", async () => {
  const { body } = await hole(baueFirma("free"), { stripeAn: false });
  assert.ok(body.charakter.bilder, "ohne Bezahlmoeglichkeit muss der Charakter durchkommen");
  assert.equal(body.charakter.bilder.idle, "https://x/idle.png");
});

test("Private Felder bleiben draussen (E-Mail, Webseite, Wissen)", async () => {
  const { body } = await hole(baueFirma("plus"), { stripeAn: true });
  assert.equal(body.email, undefined);
  assert.equal(body.webseite, undefined);
  assert.equal(body.wissensquellen, undefined);
  // Öffentlich gebraucht: Name, Persona, FAQ, Fakten fürs Chip-Angebot.
  assert.equal(body.name, "Test AG");
  assert.equal(body.persona, "Robin");
  assert.equal(body.fakten.Adresse, "Teststrasse 1");
});

test("Charakter-Beschreibung ist interne Prompt-Info und wird nicht ausgeliefert", async () => {
  const { body } = await hole(baueFirma("plus"), { stripeAn: true });
  assert.equal(body.charakter.beschreibung, undefined);
});

test("Unbekannte Firma -> 404", async () => {
  const handler = ladeHandler(null, { stripeAn: true });
  const res = await handler({ queryStringParameters: { id: "gibtsnicht" } });
  assert.equal(res.statusCode, 404);
});
