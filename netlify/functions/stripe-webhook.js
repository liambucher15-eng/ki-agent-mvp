// Stripe-Webhook: Stripe ruft diese Function auf, wenn sich ein Abo ändert.
// NUR hier wird ein bezahlter Plan gesetzt — der Plan ist damit Server-Wahrheit,
// kein Kunde kann sich selbst "grow" schalten.
//
// Der Plan landet in der Tabelle "abos" beim NUTZER, nicht bei einer Firma:
// Bezahlt wird VOR dem Einrichten, da existiert noch keine Firma. Ein Trigger
// überträgt den Plan auf jede Firma, die dieser Nutzer anlegt oder speichert
// (migration-abo.sql).
//
// Sicherheit: Die Signatur wird geprüft (verifiziereWebhook), sonst könnte
// jemand gefälschte "bezahlt"-Events schicken. Der ROH-Body ist dafür nötig —
// deshalb NICHT JSON.parse vor der Prüfung.

const { KAUFBAR, verifiziereWebhook } = require("./lib/stripe");
const { setzeAboServer, nutzerZuStripeKunde, besitzerVonFirma } = require("./lib/firmaLaden");

// Wem gehört dieses Event? Bevorzugt der Nutzer aus den Metadaten. Der
// firma_id-Zweig ist die Brücke für Checkout-Sessions, die VOR der Umstellung
// gestartet wurden: Ohne ihn liefe eine solche Zahlung stumm ins Leere, und der
// Kunde hätte bezahlt, ohne etwas zu bekommen.
async function findeNutzer(obj) {
  if (obj.metadata?.nutzer) return obj.metadata.nutzer;
  if (obj.client_reference_id) return obj.client_reference_id;
  if (obj.metadata?.firma_id) return await besitzerVonFirma(obj.metadata.firma_id);
  return null;
}

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
      // Bezahlt -> genau der Plan, der gekauft wurde. Ein unbekannter Wert wird
      // NICHT stillschweigend auf einen bezahlten Plan geraten: Lieber fällt es
      // im Log auf, als dass jemand grundlos Grow bekommt (oder verliert).
      const nutzer = await findeNutzer(obj);
      const plan = obj.metadata?.plan;
      if (!nutzer) {
        console.error("stripe-webhook: Zahlung ohne zuordenbaren Nutzer", obj.id);
      } else if (!KAUFBAR.includes(plan)) {
        console.error("stripe-webhook: unbekannter Plan '" + plan + "' für", nutzer);
      } else {
        await setzeAboServer(nutzer, plan, obj.customer || null);
      }
    } else if (
      stripeEvent.type === "customer.subscription.deleted" ||
      (stripeEvent.type === "customer.subscription.updated" && obj.status !== "active" && obj.status !== "trialing")
    ) {
      // Abo beendet/inaktiv -> zurück auf free (nicht auf den kleinsten BEZAHLTEN
      // Plan: Wer gekündigt hat, soll nichts mehr zahlen müssen).
      const nutzer = (await findeNutzer(obj)) || (await nutzerZuStripeKunde(obj.customer));
      if (nutzer) await setzeAboServer(nutzer, "free");
    }
  } catch (e) {
    console.error("stripe-webhook: Verarbeitung fehlgeschlagen:", e.message);
    // 200 trotzdem: Stripe soll nicht endlos wiederholen; wir loggen den Fehler.
  }

  return { statusCode: 200, body: "ok" };
};
