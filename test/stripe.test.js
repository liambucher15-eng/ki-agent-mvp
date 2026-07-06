// Tests für die Stripe-Webhook-Signaturprüfung — sicherheitskritisch:
// ein gefälschtes "bezahlt"-Event darf NICHT durchkommen.

const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Env VOR dem (einzigen) Require setzen — das Modul liest sie beim Laden und
// wird danach aus dem Require-Cache bedient (weitere process.env-Änderungen
// hätten also keine Wirkung mehr).
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_geheim";
process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.STRIPE_PREIS_BASIS = "price_basis_123";
process.env.STRIPE_PREIS_PLUS = "price_plus_456";
const { verifiziereWebhook, erstelleCheckout, konfiguriert } = require("../netlify/functions/lib/stripe");

function signiere(body, secret, t) {
  t = t || Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(t + "." + body, "utf8").digest("hex");
  return "t=" + t + ",v1=" + sig;
}

test("korrekt signiertes Event wird akzeptiert und geparst", () => {
  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { metadata: { firma_id: "x" } } } });
  const header = signiere(body, "whsec_test_geheim");
  const ev = verifiziereWebhook(body, header);
  assert.equal(ev.type, "checkout.session.completed");
  assert.equal(ev.data.object.metadata.firma_id, "x");
});

test("falsches Secret -> abgelehnt", () => {
  const body = "{}";
  const header = signiere(body, "whsec_falsch");
  assert.throws(() => verifiziereWebhook(body, header), /ungültig/i);
});

test("manipulierter Body -> abgelehnt", () => {
  const echt = "{}";
  const header = signiere(echt, "whsec_test_geheim");
  assert.throws(() => verifiziereWebhook('{"böse":1}', header), /ungültig/i);
});

test("veralteter Zeitstempel (>5 min) -> abgelehnt", () => {
  const body = "{}";
  const alt = Math.floor(Date.now() / 1000) - 600;
  const header = signiere(body, "whsec_test_geheim", alt);
  assert.throws(() => verifiziereWebhook(body, header), /alt/i);
});

test("fehlende Signatur -> abgelehnt", () => {
  assert.throws(() => verifiziereWebhook("{}", ""), /unvollständig/i);
});

// --- Milestone 10: zwei Produkte (Basis/Plus) ---
const echterFetch = global.fetch;
afterEach(() => { global.fetch = echterFetch; });

function mockCheckoutAntwort() {
  global.fetch = async (url, opts) => {
    mockCheckoutAntwort.letzterAufruf = { url, opts };
    return { ok: true, json: async () => ({ id: "cs_test", url: "https://checkout.stripe.com/x" }) };
  };
}

test("erstelleCheckout: plan 'plus' -> nutzt STRIPE_PREIS_PLUS, plan+firma in Metadata", async () => {
  mockCheckoutAntwort();
  await erstelleCheckout({ firmaId: "salbei", plan: "plus", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" });
  const body = new URLSearchParams(mockCheckoutAntwort.letzterAufruf.opts.body);
  assert.equal(body.get("line_items[0][price]"), "price_plus_456");
  assert.equal(body.get("metadata[plan]"), "plus");
  assert.equal(body.get("metadata[firma_id]"), "salbei");
  assert.equal(body.get("subscription_data[metadata][plan]"), "plus");
});

test("erstelleCheckout: plan 'basis' -> nutzt STRIPE_PREIS_BASIS", async () => {
  mockCheckoutAntwort();
  await erstelleCheckout({ firmaId: "x", plan: "basis", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" });
  const body = new URLSearchParams(mockCheckoutAntwort.letzterAufruf.opts.body);
  assert.equal(body.get("line_items[0][price]"), "price_basis_123");
  assert.equal(body.get("metadata[plan]"), "basis");
});

test("erstelleCheckout: unbekannter/fehlender plan-Wert fällt auf 'plus'", async () => {
  mockCheckoutAntwort();
  await erstelleCheckout({ firmaId: "x", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" });
  const body = new URLSearchParams(mockCheckoutAntwort.letzterAufruf.opts.body);
  assert.equal(body.get("line_items[0][price]"), "price_plus_456");
});

test("konfiguriert: true, sobald mindestens ein Preis + Secret gesetzt sind", () => {
  assert.equal(konfiguriert(), true);
});
