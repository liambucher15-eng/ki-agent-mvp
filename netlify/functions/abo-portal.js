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
//
// Und die NUTZER-ID kommt seit der Einführung von lib/anmeldung.js aus dem
// signierten Clerk-Token statt aus dem Body. Vorher stand hier als bekannte
// Schwäche: wer eine fremde Clerk-ID kennt, bekommt deren Rechnungsdaten. Genau
// das geht jetzt nicht mehr.

const { json, holeIp, originErlaubt, rateOk, serverFehler } = require("./lib/schutz");
const { pruefeAnmeldung } = require("./lib/anmeldung");
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

  // Wer fragt? Das entscheidet die Signatur des Clerk-Tokens, nicht der Body.
  const anmeldung = await pruefeAnmeldung(event);
  if (!anmeldung.ok) return anmeldung.antwort;

  let basis, nutzerAusBody;
  try { ({ basis, nutzer: nutzerAusBody } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }

  // Im Simulations-Modus (netlify dev ohne Clerk) gibt es kein Token; dort gilt
  // weiterhin die Angabe aus dem Body, damit lokales Testen möglich bleibt.
  const nutzer = anmeldung.nutzer || (anmeldung.dev ? nutzerAusBody : null);
  if (!nutzer || typeof nutzer !== "string") return json(401, { error: "Nicht angemeldet." });

  // Nachschlagen statt entgegennehmen: Das Token sagt, WER fragt; welche
  // Stripe-Kunden-ID dazu gehört, entscheidet die Datenbank.
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
    // Stripe-Interna gehören nicht in den Browser.
    return serverFehler("abo-portal", e,
      "Das Kundenportal konnte nicht geöffnet werden. Bitte gleich nochmal versuchen.");
  }
};
