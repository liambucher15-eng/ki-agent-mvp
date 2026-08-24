// Startet den Kauf eines Abos: erzeugt eine Stripe-Checkout-Session und gibt die
// URL zurück, auf die die Seite weiterleitet. Der Schlüssel bleibt auf dem Server.
// Ohne Stripe-Konfiguration -> 501 (Feature noch nicht eingerichtet).
//
// Der Kaufweg lautet: Preisseite -> Konto -> bezahlen -> Onboarding.
// Deshalb nimmt diese Function eine NUTZER-ID entgegen und keine firmaId: Beim
// Bezahlen existiert der Agent noch nicht.

const { json, holeIp, originErlaubt, rateOk } = require("./lib/schutz");
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

  let nutzer, basis, plan, takt;
  try { ({ nutzer, basis, plan, takt } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }

  // Die Nutzer-ID kommt aus dem Browser (Clerk-Session). Serverseitig prüfen
  // könnten wir sie nur mit einer Clerk-JWT-Verifikation, die es im Projekt
  // heute nicht gibt.
  //
  // Warum das hier trotzdem trägt: Ein Plan wird ERST beim bestätigten
  // Zahlungs-Event gesetzt (stripe-webhook.js). Wer eine fremde Nutzer-ID
  // mitschickt, verschenkt also sein eigenes Geld an jemand anderen — er kann
  // sich damit nichts erschleichen. Der Schaden bliebe bei ihm.
  //
  // Sobald es eine serverseitige Clerk-Prüfung gibt, gehört sie hierher.
  if (!nutzer || typeof nutzer !== "string") return json(400, { error: "Nicht angemeldet" });
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
    return json(502, { error: e.message });
  }
};
