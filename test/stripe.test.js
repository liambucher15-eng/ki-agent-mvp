// Tests für die Stripe-Webhook-Signaturprüfung — sicherheitskritisch:
// ein gefälschtes "bezahlt"-Event darf NICHT durchkommen.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Secret VOR dem Require setzen (das Modul liest es beim Laden).
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_geheim";
const { verifiziereWebhook } = require("../netlify/functions/lib/stripe");

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
