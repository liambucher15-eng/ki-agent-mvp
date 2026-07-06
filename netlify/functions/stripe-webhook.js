// Stripe-Webhook: Stripe ruft diese Function auf, wenn sich ein Abo ändert.
// NUR hier wird firmen.plan gesetzt — der Plan ist damit Server-Wahrheit, kein
// Kunde kann sich selbst "plus" schalten (siehe REVOKE in migration-m5.sql).
//
// Sicherheit: Die Signatur wird geprüft (verifiziereWebhook), sonst könnte
// jemand gefälschte "bezahlt"-Events schicken. Der ROH-Body ist dafür nötig —
// deshalb NICHT JSON.parse vor der Prüfung.

const { verifiziereWebhook } = require("./lib/stripe");
const { setzePlanServer, firmaZuStripeKunde } = require("./lib/firmaLaden");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };

  const signatur = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  let stripeEvent;
  try {
    stripeEvent = verifiziereWebhook(event.body || "", signatur);
  } catch (e) {
    console.error("stripe-webhook: Signatur ungültig:", e.message);
    return { statusCode: 400, body: "Signatur ungültig" };
  }

  try {
    const obj = stripeEvent.data?.object || {};
    if (stripeEvent.type === "checkout.session.completed") {
      // Bezahlt -> der Plan, der tatsächlich gekauft wurde (Milestone 10: zwei
      // Produkte). Fallback "plus" für Sessions von VOR der Umstellung, die noch
      // kein plan-Metadatum kannten.
      const firmaId = obj.metadata?.firma_id || obj.client_reference_id;
      const plan = obj.metadata?.plan === "basis" ? "basis" : "plus";
      if (firmaId) await setzePlanServer(firmaId, plan, obj.customer || null);
    } else if (
      stripeEvent.type === "customer.subscription.deleted" ||
      (stripeEvent.type === "customer.subscription.updated" && obj.status !== "active" && obj.status !== "trialing")
    ) {
      // Abo beendet/inaktiv -> zurück auf basis. Firma über metadata oder Kunden-ID finden.
      const firmaId = obj.metadata?.firma_id || (await firmaZuStripeKunde(obj.customer));
      if (firmaId) await setzePlanServer(firmaId, "basis");
    }
  } catch (e) {
    console.error("stripe-webhook: Verarbeitung fehlgeschlagen:", e.message);
    // 200 trotzdem: Stripe soll nicht endlos wiederholen; wir loggen den Fehler.
  }

  return { statusCode: 200, body: "ok" };
};
