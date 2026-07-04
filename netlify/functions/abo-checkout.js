// Startet den Plus-Kauf: erzeugt eine Stripe-Checkout-Session und gibt die URL
// zurück, auf die das Dashboard weiterleitet. Der Schlüssel bleibt auf dem Server.
// Ohne Stripe-Konfiguration -> 501 (Feature noch nicht eingerichtet).

const { json, holeIp, originErlaubt, rateOk } = require("./lib/schutz");
const { konfiguriert, erstelleCheckout } = require("./lib/stripe");

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

  let firmaId, basis;
  try { ({ firmaId, basis } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }
  if (!firmaId || typeof firmaId !== "string") return json(400, { error: "firmaId fehlt" });

  // Rücksprung-URLs: zurück ins Dashboard. basis kommt vom Frontend (location.origin).
  const ziel = (typeof basis === "string" && /^https?:\/\//.test(basis)) ? basis : "";
  const erfolgUrl = ziel + "/dashboard.html?bezahlt=1";
  const abbruchUrl = ziel + "/dashboard.html?abbruch=1";

  try {
    const session = await erstelleCheckout({ firmaId, erfolgUrl, abbruchUrl });
    return json(200, { url: session.url });
  } catch (e) {
    return json(502, { error: e.message });
  }
};
