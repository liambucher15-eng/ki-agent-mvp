// Startet den Kauf eines Abos: erzeugt eine Stripe-Checkout-Session und gibt die
// URL zurück, auf die die Seite weiterleitet. Der Schlüssel bleibt auf dem Server.
// Ohne Stripe-Konfiguration -> 501 (Feature noch nicht eingerichtet).
//
// Der Kaufweg lautet: Preisseite -> Konto -> bezahlen -> Onboarding.
// Deshalb nimmt diese Function eine NUTZER-ID entgegen und keine firmaId: Beim
// Bezahlen existiert der Agent noch nicht.

const { json, holeIp, originErlaubt, rateOk, serverFehler } = require("./lib/schutz");
const { pruefeAnmeldung } = require("./lib/anmeldung");
const { KAUFBAR, TAKTE, konfiguriert, erstelleCheckout } = require("./lib/stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Nur POST erlaubt" });
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });
  if (!konfiguriert()) {
    return json(501, { error: "Bezahlung ist noch nicht eingerichtet (Stripe fehlt)." });
  }
  // Rate-Limit: 10 Checkout-Starts pro Minute und IP
  if (!(await rateOk("checkout:" + holeIp(event), 10, 60))) {
    return json(429, { error: "Zu viele Anfragen. Bitte einen Moment warten." });
  }

  // Wer kauft? Das entscheidet die Signatur des Clerk-Tokens, nicht der Body.
  //
  // Hier stand früher als Begründung, warum die ungeprüfte Nutzer-ID aus dem
  // Browser vertretbar sei: Ein Plan wird erst beim bestätigten Zahlungs-Event
  // gesetzt (stripe-webhook.js), wer eine fremde ID mitschickt, verschenkt also
  // sein eigenes Geld. Das stimmte — es hiess aber auch, dass ein Fremder einem
  // Konto ein Abo unterschieben konnte, an das dessen Besitzer nie wollte.
  // Beides ist erledigt, sobald die ID aus dem Token kommt.
  const anmeldung = await pruefeAnmeldung(event);
  if (!anmeldung.ok) return anmeldung.antwort;

  let basis, plan, takt, nutzerAusBody;
  try { ({ basis, plan, takt, nutzer: nutzerAusBody } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }

  // Ohne Clerk (netlify dev, Simulations-Modus) bleibt die Angabe aus dem Body
  // gültig, damit lokales Testen weiter geht.
  const nutzer = anmeldung.nutzer || (anmeldung.dev ? nutzerAusBody : null);
  if (!nutzer || typeof nutzer !== "string") return json(401, { error: "Nicht angemeldet." });
  if (!KAUFBAR.includes(plan)) {
    return json(400, { error: "Plan '" + plan + "' kann nicht gekauft werden." });
  }
  // Ohne Angabe monatlich: Das ist der Wert, den die Preisseite beim Laden
  // anzeigt, also der teurere pro Monat. Ein unbekannter Takt darf nicht
  // versehentlich das guenstigere Jahresabo ausloesen.
  if (takt !== undefined && !TAKTE.includes(takt)) {
    return json(400, { error: "Unbekannter Abrechnungstakt." });
  }

  // Rücksprung-URLs. basis kommt vom Frontend (location.origin).
  const ziel = (typeof basis === "string" && /^https?:\/\//.test(basis)) ? basis : "";
  // Nach der Zahlung geht es DIREKT ins Onboarding — das ist der Grund, warum
  // der Kunde bezahlt hat. Vorher landete er im Dashboard, das ohne Agent leer
  // ist und ihn mit der Frage allein liess, was er jetzt tun soll.
  const erfolgUrl = ziel + "/onboarding-aura.html?bezahlt=" + plan;
  const abbruchUrl = ziel + "/preis.html?abbruch=1";

  try {
    const session = await erstelleCheckout({ nutzer, plan, takt, erfolgUrl, abbruchUrl });
    return json(200, { url: session.url });
  } catch (e) {
    // Stripe-Fehlermeldungen nennen Preis-IDs und Konto-Interna — nichts, was
    // ein Kunde sehen muss.
    return serverFehler("abo-checkout", e,
      "Der Kauf konnte nicht gestartet werden. Bitte versuch es gleich nochmal.");
  }
};
