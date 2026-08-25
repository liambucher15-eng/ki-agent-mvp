// Schlanke Stripe-Anbindung ohne npm-Paket: reines fetch gegen die Stripe-REST-API
// (form-encoded) plus Webhook-Signaturprüfung mit node:crypto. Konsistent mit dem
// dependency-armen Stil des Projekts. (Alternative wäre das offizielle "stripe"-Paket.)
//
// Benötigte Env-Variablen (Netlify / .env), alle GEHEIM:
//   STRIPE_SECRET_KEY      – sk_live_... / sk_test_...
//   STRIPE_PREIS_START     – price_... (Start,  CHF 29)
//   STRIPE_PREIS_GROW      – price_... (Grow,   CHF 79)
//   STRIPE_PREIS_SCALE     – price_... (Scale,  CHF 199)
//   STRIPE_WEBHOOK_SECRET  – whsec_... (aus dem Webhook-Endpoint)
//
// Die alten Namen bleiben als Rückfall gültig, damit ein bereits eingerichtetes
// Deployment nicht beim nächsten Deploy stumm die Bezahlung verliert. Die
// Zuordnung ist dieselbe wie in migration-plaene.sql:
//   STRIPE_PREIS_BASIS -> start      STRIPE_PREIS_PLUS (bzw. _ID) -> grow

const crypto = require("crypto");

// STRIPE_API_KEY ist der Name, den die Stripe-CLI und der Stripe-MCP-Server
// verwenden. Beide Namen zu akzeptieren erspart eine doppelt gepflegte
// Zeile in der .env — und genau daran lag die Bezahlung zuletzt still:
// Der Schluessel war eingetragen, nur unter dem anderen Namen, und der
// Checkout antwortete "noch nicht eingerichtet".
const SECRET = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// Free steht bewusst NICHT hier: Für einen kostenlosen Plan gibt es nichts zu
// kassieren, und eine Checkout-Session über CHF 0 wäre eine Zahlungsaufforderung
// ohne Betrag — verwirrend für den Kunden und sinnlos für uns.
// Monats- und Jahrespreis sind in Stripe ZWEI verschiedene Preise am selben
// Produkt. Die Preisseite bietet beide an (Umschalter oben), also muss der
// Takt bis hierher durchgereicht werden.
//
// KEIN Rueckfall vom Jahres- auf den Monatspreis: Wer auf der Preisseite
// "jaehrlich" gewaehlt und CHF 66 gelesen hat, darf nicht stillschweigend CHF 79
// monatlich belastet werden. Fehlt der Jahrespreis, gibt es einen klaren
// Fehler statt einer Falschabrechnung.
function preisFuer(plan, takt) {
  const jahr = takt === "jahr";
  if (plan === "start") {
    return jahr ? (process.env.STRIPE_PREIS_START_JAHR || "")
                : (process.env.STRIPE_PREIS_START || process.env.STRIPE_PREIS_BASIS || "");
  }
  if (plan === "grow") {
    return jahr ? (process.env.STRIPE_PREIS_GROW_JAHR || "")
                : (process.env.STRIPE_PREIS_GROW || process.env.STRIPE_PREIS_PLUS || process.env.STRIPE_PREIS_ID || "");
  }
  if (plan === "scale") {
    return jahr ? (process.env.STRIPE_PREIS_SCALE_JAHR || "")
                : (process.env.STRIPE_PREIS_SCALE || "");
  }
  return "";
}

// Die beiden Abrechnungstakte der Preisseite.
const TAKTE = ["monat", "jahr"];

const KAUFBAR = ["start", "grow", "scale"];

// Umkehrung: Zu welchem Plan gehoert diese Stripe-Preis-ID?
//
// Gebraucht fuer Wechsel im Kundenportal. Dort tauscht Stripe den Preis der
// laufenden Subscription aus und schickt "customer.subscription.updated" — die
// METADATEN bleiben dabei die des urspruenglichen Kaufs. Wer von Start auf Grow
// wechselt, haette also weiterhin "plan: start" darin stehen. Verlaesslich ist
// allein der Preis.
//
// Gibt null zurueck, wenn die ID zu keinem konfigurierten Preis passt. Daraus
// darf KEIN Plan geraten werden: Ein fremder Preis heisst, dass die
// Konfiguration nicht stimmt — nicht, dass der Kunde Plan X hat.
function planFuerPreis(preisId) {
  if (!preisId) return null;
  for (const plan of KAUFBAR) {
    if (preisFuer(plan, "monat") === preisId) return plan;
    if (preisFuer(plan, "jahr") === preisId) return plan;
  }
  return null;
}

// "Eingerichtet" heisst: mindestens EIN Preis ist konfiguriert. erstelleCheckout
// prüft den konkret gewählten Preis selbst und wirft einen klaren Fehler, falls
// genau DER fehlt — sonst hiesse es "Bezahlung nicht eingerichtet", obwohl nur
// ein einzelner Plan fehlt.
function konfiguriert() {
  return !!SECRET && KAUFBAR.some((p) => !!preisFuer(p, "monat"));
}

// Objekt -> flaches x-www-form-urlencoded (Stripe erwartet metadata[nutzer]=... usw.)
function formCodieren(obj, praefix, ziel) {
  ziel = ziel || new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    const schluessel = praefix ? `${praefix}[${k}]` : k;
    if (v && typeof v === "object") formCodieren(v, schluessel, ziel);
    else ziel.append(schluessel, String(v));
  }
  return ziel;
}

// Erzeugt eine Checkout-Session für den gewählten Plan.
//
// WICHTIG — in den Metadaten steht der NUTZER, nicht die Firma:
//  Der Kunde bezahlt, BEVOR er seinen Agenten einrichtet. In diesem Moment gibt
//  es noch keine Firma, der man einen Plan zuschreiben könnte. Deshalb hängt das
//  Abo am Clerk-Nutzer (Tabelle "abos"), und ein Trigger überträgt den Plan auf
//  jede Firma, die dieser Nutzer anlegt (migration-abo.sql).
//
//  Vorher verlangte diese Funktion eine firmaId — das setzte die umgekehrte
//  Reihenfolge voraus (erst einrichten, dann irgendwann aus dem Dashboard heraus
//  bezahlen) und machte den Weg "Preisseite -> Konto -> bezahlen -> einrichten"
//  unmöglich.
async function erstelleCheckout({ nutzer, plan, takt, erfolgUrl, abbruchUrl }) {
  if (!nutzer) throw new Error("Ohne Nutzer-ID kann kein Abo zugeordnet werden.");
  if (!KAUFBAR.includes(plan)) throw new Error("Plan '" + plan + "' ist nicht kaufbar.");
  const abrechnung = takt === "jahr" ? "jahr" : "monat";
  const preis = preisFuer(plan, abrechnung);
  if (!preis) {
    throw new Error("Für den Plan '" + plan + "' ist kein " +
      (abrechnung === "jahr" ? "Jahres" : "Monats") + "preis in Stripe eingerichtet.");
  }
  const body = formCodieren({
    mode: "subscription",
    "line_items": [{ price: preis, quantity: 1 }],
    success_url: erfolgUrl,
    cancel_url: abbruchUrl,
    client_reference_id: nutzer,
    metadata: { nutzer, plan, takt: abrechnung },
    // Auch am Abo hinterlegen -> der Kündigungs-Webhook findet den Nutzer wieder.
    subscription_data: { metadata: { nutzer, plan, takt: abrechnung } },
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: "Bearer " + SECRET,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const daten = await res.json();
  if (!res.ok) throw new Error(daten.error?.message || "Stripe-Fehler");
  return daten; // { id, url, ... }
}

// Oeffnet Stripes Kundenportal fuer einen bestehenden Kunden.
//
// Warum nicht selbst bauen: Upgrade, Downgrade, Kuendigung, Zahlungsmittel und
// Rechnungen sind alles Faelle mit anteiliger Verrechnung, Steuerlogik und
// Fristen. Stripe macht das seit Jahren richtig; eine eigene Nachbildung waere
// die Sorte Code, bei der ein Fehler direkt Geld kostet — auf einer der
// beiden Seiten.
//
// Wichtig: Der Kunde wechselt hier den Plan seiner LAUFENDEN Subscription.
// Bisher fuehrte "Plan aendern" im Dashboard auf die Preisseite und von dort in
// einen neuen Checkout — das haette ein ZWEITES Abo erzeugt, und der Kunde
// haette doppelt gezahlt, ohne dass ihn jemand gewarnt haette.
async function erstellePortal({ kunde, rueckkehrUrl }) {
  if (!kunde) throw new Error("Ohne Stripe-Kunden-ID gibt es kein Portal.");
  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      authorization: "Bearer " + SECRET,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: formCodieren({ customer: kunde, return_url: rueckkehrUrl }),
  });
  const daten = await res.json();
  if (!res.ok) throw new Error(daten.error?.message || "Stripe-Fehler");
  return daten; // { id, url, ... }
}

// Prüft die Stripe-Webhook-Signatur (Header "stripe-signature": "t=...,v1=...").
// Verhindert gefälschte Webhook-Aufrufe (jemand könnte sich sonst gratis Grow setzen).
// Gibt das geparste Event zurück oder wirft.
function verifiziereWebhook(rohBody, signaturHeader) {
  if (!WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET fehlt");
  const teile = Object.fromEntries(
    String(signaturHeader || "").split(",").map((p) => p.split("=").map((s) => s.trim()))
  );
  const t = teile.t;
  const sig = teile.v1;
  if (!t || !sig) throw new Error("Signatur unvollständig");

  // Replay-Schutz: Zeitstempel darf nicht älter als 5 Minuten sein.
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new Error("Signatur zu alt");

  const erwartet = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(t + "." + rohBody, "utf8")
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(erwartet, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Signatur ungültig");
  }
  return JSON.parse(rohBody);
}

module.exports = { KAUFBAR, TAKTE, konfiguriert, preisFuer, planFuerPreis, erstelleCheckout, erstellePortal, verifiziereWebhook };
