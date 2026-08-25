// Öffnet Stripes Kundenportal: Plan wechseln, kündigen, Zahlungsmittel
// ändern, Rechnungen ansehen.
//
// Warum das nötig ist:
//  Vorher führte "Plan ändern" im Dashboard auf die Preisseite und von dort in
//  einen neuen Checkout. Damit hätte ein Kunde mit laufendem Abo ein ZWEITES
//  bekommen und doppelt gezahlt — ohne dass ihn irgendetwas gewarnt hätte.
//  Und kündigen konnte er überhaupt nicht, obwohl preis.html an vier Stellen
//  "monatlich kündbar" verspricht.
//
// Die Kunden-ID kommt aus der abos-Tabelle (dort legt sie der Webhook ab), NICHT
// aus dem Browser. Sonst könnte jemand eine fremde Kunden-ID mitschicken und
// bekäme dessen Rechnungen und Zahlungsmittel zu sehen.

const { json, holeIp, originErlaubt, rateOk } = require("./lib/schutz");
const { konfiguriert, erstellePortal } = require("./lib/stripe");
const { holeAboServer } = require("./lib/firmaLaden");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Nur POST erlaubt" });
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });
  if (!konfiguriert()) {
    return json(501, { error: "Bezahlung ist noch nicht eingerichtet (Stripe fehlt)." });
  }
  if (!(await rateOk("portal:" + holeIp(event), 10, 60))) {
    return json(429, { error: "Zu viele Anfragen. Bitte einen Moment warten." });
  }

  let nutzer, basis;
  try { ({ nutzer, basis } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }
  if (!nutzer || typeof nutzer !== "string") return json(400, { error: "Nicht angemeldet" });

  // Nachschlagen statt entgegennehmen: Der Browser sagt nur, WER er ist; welche
  // Stripe-Kunden-ID dazu gehört, entscheidet die Datenbank.
  //
  // Dass die Nutzer-ID selbst ungeprüft aus dem Browser kommt, ist hier die
  // verbleibende Schwäche — dieselbe wie in abo-checkout.js, und sie
  // verschwindet erst mit einer serverseitigen Clerk-Prüfung. Wer eine fremde
  // Clerk-ID kennt UND errät, käme an fremde Rechnungsdaten. Clerk-IDs sind
  // nicht öffentlich, aber das ist eine schwächere Zusage als eine Signatur.
  const abo = await holeAboServer(nutzer);
  if (!abo || !abo.stripe_kunde) {
    return json(404, { error: "Für dieses Konto gibt es kein Abo bei Stripe." });
  }

  const ziel = (typeof basis === "string" && /^https?:\/\//.test(basis)) ? basis : "";
  try {
    const sitzung = await erstellePortal({
      kunde: abo.stripe_kunde,
      rueckkehrUrl: ziel + "/dashboard.html",
    });
    return json(200, { url: sitzung.url });
  } catch (e) {
    return json(502, { error: e.message });
  }
};
