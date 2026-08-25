// Der Weg vom Geld zur Berechtigung: Preisseite -> Konto -> bezahlen -> Onboarding.
//
// Diese Kette hatte bis hierher keinen einzigen Test, obwohl sie die einzige
// Stelle im System ist, an der eine Zahlung in eine Berechtigung umschlaegt.
// Faellt sie stumm aus, hat ein Kunde bezahlt und bekommt nichts — der teuerste
// aller denkbaren Fehler.
//
// Der springende Punkt, den beide Gruppen unten festnageln: Das Abo haengt am
// NUTZER, nicht an einer Firma. Beim Bezahlen existiert noch keine Firma.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Env VOR den Requires: firmaLaden.js liest SUPABASE_URL/KEY beim Laden.
process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.STRIPE_PREIS_GROW = "price_grow_test";
process.env.STRIPE_PREIS_START = "price_start_test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_probe";
process.env.SUPABASE_URL = "https://probe.invalid";
process.env.SUPABASE_SERVICE_KEY = "service_probe";

const checkout = require("../netlify/functions/abo-checkout.js");
const webhook = require("../netlify/functions/stripe-webhook.js");

const echterFetch = global.fetch;

// Same-Origin (origin.host === host) -> schutz.js laesst durch.
function kaufAnfrage(koerper) {
  return {
    httpMethod: "POST",
    headers: { origin: "https://aurachat.ch", host: "aurachat.ch", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(koerper),
  };
}

function webhookAnfrage(nutzlast) {
  const body = JSON.stringify(nutzlast);
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", "whsec_probe").update(t + "." + body, "utf8").digest("hex");
  return { httpMethod: "POST", headers: { "stripe-signature": "t=" + t + ",v1=" + sig }, body };
}

// Faengt alles ab, was nach draussen ginge, und protokolliert es.
function fangeAb(vorgaben) {
  const { firmaBesitzer, aboNutzer } = vorgaben || {};
  const rufe = [];
  global.fetch = async (url, opts) => {
    rufe.push({ url: String(url), methode: opts && opts.method, koerper: opts && opts.body });
    if (String(url).includes("api.stripe.com")) {
      return { ok: true, json: async () => ({ id: "cs_test", url: "https://checkout.stripe.com/PROBE" }) };
    }
    if (String(url).includes("/firmen?")) {
      return { ok: true, json: async () => (firmaBesitzer ? [{ besitzer: firmaBesitzer }] : []) };
    }
    if (String(url).includes("/abos?")) {
      return { ok: true, json: async () => (aboNutzer ? [{ nutzer: aboNutzer }] : []) };
    }
    return { ok: true, json: async () => ({}) };
  };
  return {
    stripeKoerper() {
      const r = rufe.find((x) => x.url.includes("api.stripe.com"));
      return r ? new URLSearchParams(r.koerper.toString()) : null;
    },
    aboSchreibvorgaenge() {
      return rufe
        .filter((x) => x.methode === "POST" && x.url.includes("/rest/v1/abos"))
        .map((x) => JSON.parse(x.koerper));
    },
    ende() { global.fetch = echterFetch; },
  };
}

// ── Kasse ────────────────────────────────────────────────────────────────

test("Kauf: der Nutzer geht an Stripe, keine Firma", async () => {
  const f = fangeAb();
  try {
    const a = await checkout.handler(kaufAnfrage({ nutzer: "user_abc", plan: "grow", basis: "https://aurachat.ch" }));
    assert.equal(a.statusCode, 200);
    const p = f.stripeKoerper();
    assert.equal(p.get("metadata[nutzer]"), "user_abc");
    assert.equal(p.get("client_reference_id"), "user_abc");
    // Das ist der Kern: Beim Bezahlen gibt es noch keine Firma.
    assert.equal(p.get("metadata[firma_id]"), null);
  } finally { f.ende(); }
});

test("Kauf: nach der Zahlung geht es ins ONBOARDING, nicht ins Dashboard", async () => {
  // Der Kunde hat bezahlt, um seinen Agenten einzurichten. Ein leeres Dashboard
  // waere an dieser Stelle eine Sackgasse.
  const f = fangeAb();
  try {
    await checkout.handler(kaufAnfrage({ nutzer: "u", plan: "grow", basis: "https://aurachat.ch" }));
    const p = f.stripeKoerper();
    assert.match(p.get("success_url"), /onboarding-aura\.html\?bezahlt=grow$/);
    assert.match(p.get("cancel_url"), /preis\.html/);
  } finally { f.ende(); }
});

test("Kauf: ohne Anmeldung gar nicht erst zu Stripe", async () => {
  // Eine Zahlung, die sich niemandem zuordnen laesst, ist Geld ohne Gegenleistung.
  const f = fangeAb();
  try {
    const a = await checkout.handler(kaufAnfrage({ plan: "grow", basis: "https://aurachat.ch" }));
    assert.equal(a.statusCode, 400);
    assert.equal(f.stripeKoerper(), null);
  } finally { f.ende(); }
});

test("Kauf: free und Tippfehler werden abgelehnt, nicht geraten", async () => {
  const f = fangeAb();
  try {
    for (const plan of ["free", "gorw", undefined]) {
      const a = await checkout.handler(kaufAnfrage({ nutzer: "u", plan, basis: "https://aurachat.ch" }));
      assert.equal(a.statusCode, 400, "Plan " + plan);
    }
    assert.equal(f.stripeKoerper(), null, "kein einziger Stripe-Aufruf");
  } finally { f.ende(); }
});

// ── Webhook: hier wird aus Geld eine Berechtigung ────────────────────────

test("Webhook: bezahlt -> Abo beim Nutzer, mit Kunden-ID fuer die Kuendigung", async () => {
  const f = fangeAb();
  try {
    await webhook.handler(webhookAnfrage({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", customer: "cus_1", metadata: { nutzer: "user_abc", plan: "grow" } } },
    }));
    const zeile = f.aboSchreibvorgaenge()[0];
    assert.equal(zeile.nutzer, "user_abc");
    assert.equal(zeile.plan, "grow");
    // Ohne die Kunden-ID findet der Kuendigungs-Webhook den Nutzer spaeter nicht.
    assert.equal(zeile.stripe_kunde, "cus_1");
  } finally { f.ende(); }
});

test("Webhook: eine Session von VOR der Umstellung geht nicht verloren", async () => {
  // Solche Sessions kennen nur firma_id. Ohne die Bruecke ueber den Besitzer
  // haette der Kunde bezahlt und nichts bekommen.
  const f = fangeAb({ firmaBesitzer: "user_aus_firma" });
  try {
    await webhook.handler(webhookAnfrage({
      type: "checkout.session.completed",
      data: { object: { id: "cs_2", customer: "cus_2", metadata: { firma_id: "salbei", plan: "start" } } },
    }));
    const zeile = f.aboSchreibvorgaenge()[0];
    assert.equal(zeile.nutzer, "user_aus_firma");
    assert.equal(zeile.plan, "start");
  } finally { f.ende(); }
});

test("Webhook: unbekannter Plan schaltet NICHTS frei", async () => {
  // Frueher fiel jeder unbekannte Wert auf einen bezahlten Plan zurueck. Dann
  // haette ein Tippfehler irgendwo Grow verschenkt.
  const f = fangeAb();
  try {
    const a = await webhook.handler(webhookAnfrage({
      type: "checkout.session.completed",
      data: { object: { id: "cs_3", customer: "cus_3", metadata: { nutzer: "user_x", plan: "gorw" } } },
    }));
    assert.equal(a.statusCode, 200, "Stripe soll nicht endlos wiederholen");
    assert.equal(f.aboSchreibvorgaenge().length, 0);
  } finally { f.ende(); }
});

test("Webhook: Kuendigung -> free, nicht auf den kleinsten BEZAHLTEN Plan", async () => {
  const f = fangeAb();
  try {
    await webhook.handler(webhookAnfrage({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_1", metadata: { nutzer: "user_abc" } } },
    }));
    const zeile = f.aboSchreibvorgaenge()[0];
    assert.equal(zeile.plan, "free");
  } finally { f.ende(); }
});

test("Webhook: Kuendigung ohne Metadaten findet den Nutzer ueber die Kunden-ID", async () => {
  const f = fangeAb({ aboNutzer: "user_aus_kunde" });
  try {
    await webhook.handler(webhookAnfrage({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_2", customer: "cus_9" } },
    }));
    const zeile = f.aboSchreibvorgaenge()[0];
    assert.equal(zeile.nutzer, "user_aus_kunde");
    assert.equal(zeile.plan, "free");
  } finally { f.ende(); }
});

test("Webhook: gefaelschte Signatur schaltet nichts frei", async () => {
  // Der wichtigste Test der Datei: Ohne ihn koennte sich jeder Grow schenken,
  // indem er ein "bezahlt"-Ereignis an die oeffentliche URL schickt.
  const f = fangeAb();
  try {
    const gefaelscht = webhookAnfrage({
      type: "checkout.session.completed",
      data: { object: { metadata: { nutzer: "boesewicht", plan: "scale" } } },
    });
    gefaelscht.headers["stripe-signature"] =
      "t=" + Math.floor(Date.now() / 1000) + ",v1=" + "0".repeat(64);
    const a = await webhook.handler(gefaelscht);
    assert.equal(a.statusCode, 400);
    assert.equal(f.aboSchreibvorgaenge().length, 0);
  } finally { f.ende(); }
});

// ── Abo verwalten: wechseln und kuendigen ────────────────────────────────
//
// Bis hierher gab es beides nicht. "Plan aendern" fuehrte auf die Preisseite
// und von dort in einen NEUEN Checkout — der Kunde haette ein zweites Abo
// bekommen und doppelt gezahlt. Kuendigen ging gar nicht, obwohl preis.html
// an vier Stellen "monatlich kuendbar" verspricht.

const { planFuerPreis } = require("../netlify/functions/lib/stripe");

test("Planwechsel wird am PREIS erkannt, nicht an den Metadaten", async () => {
  // Der Kern: Stripe tauscht im Kundenportal nur den Preis der laufenden
  // Subscription aus. Die Metadaten bleiben die des urspruenglichen Kaufs —
  // wer von Start auf Grow wechselt, haette dort weiterhin "start" stehen.
  const f = fangeAb();
  try {
    await webhook.handler(webhookAnfrage({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", status: "active", customer: "cus_1",
        metadata: { nutzer: "user_abc", plan: "start" },   // veraltet!
        items: { data: [{ price: { id: "price_grow_test" } }] } } },
    }));
    const zeile = f.aboSchreibvorgaenge()[0];
    assert.equal(zeile.plan, "grow", "der Preis entscheidet, nicht die Metadaten");
  } finally { f.ende(); }
});

test("unbekannter Preis stuft NICHT um", async () => {
  // Ein fremder Preis heisst, dass die Konfiguration nicht stimmt. Den Kunden
  // deswegen hoch- oder herunterzustufen waere in beide Richtungen falsch.
  const f = fangeAb();
  try {
    const a = await webhook.handler(webhookAnfrage({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_2", status: "active", customer: "cus_2",
        metadata: { nutzer: "user_abc" },
        items: { data: [{ price: { id: "price_voellig_fremd" } }] } } },
    }));
    assert.equal(a.statusCode, 200);
    assert.equal(f.aboSchreibvorgaenge().length, 0);
  } finally { f.ende(); }
});

test("eine gekuendigte, aber noch laufende Subscription bleibt bezahlt", async () => {
  // Kuendigung im Portal setzt cancel_at_period_end, der Status bleibt
  // "active". Der Kunde hat die Periode bezahlt und muss sie bekommen —
  // ihn hier schon auf free zu setzen waere Leistungsentzug.
  const f = fangeAb();
  try {
    await webhook.handler(webhookAnfrage({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_3", status: "active", cancel_at_period_end: true, customer: "cus_3",
        metadata: { nutzer: "user_abc" },
        items: { data: [{ price: { id: "price_grow_test" } }] } } },
    }));
    const zeile = f.aboSchreibvorgaenge()[0];
    assert.equal(zeile.plan, "grow", "bis zum Periodenende bleibt der Plan");
  } finally { f.ende(); }
});

test("planFuerPreis kennt beide Takte und raet nicht", () => {
  assert.equal(planFuerPreis("price_grow_test"), "grow");
  assert.equal(planFuerPreis("price_start_test"), "start");
  assert.equal(planFuerPreis("price_erfunden"), null);
  assert.equal(planFuerPreis(undefined), null);
});
