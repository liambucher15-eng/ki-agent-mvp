// Schlanke Stripe-Anbindung ohne npm-Paket: reines fetch gegen die Stripe-REST-API
// (form-encoded) plus Webhook-Signaturprüfung mit node:crypto. Konsistent mit dem
// dependency-armen Stil des Projekts. (Alternative wäre das offizielle "stripe"-Paket.)
//
// Benötigte Env-Variablen (Netlify / .env), alle GEHEIM:
//   STRIPE_SECRET_KEY      – sk_live_... / sk_test_...
//   STRIPE_PREIS_BASIS     – price_... (das Basis-Abo, Orb)
//   STRIPE_PREIS_PLUS      – price_... (das Plus-Abo, eigene Figur)
//   STRIPE_WEBHOOK_SECRET  – whsec_... (aus dem Webhook-Endpoint)
// STRIPE_PREIS_ID (alt, Milestone 5) bleibt als Fallback für STRIPE_PREIS_PLUS
// gültig, damit bereits konfigurierte Deployments nicht brechen.

const crypto = require("crypto");

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const PREIS_PLUS = process.env.STRIPE_PREIS_PLUS || process.env.STRIPE_PREIS_ID || "";
const PREIS_BASIS = process.env.STRIPE_PREIS_BASIS || "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

function preisFuer(plan) {
  return plan === "basis" ? PREIS_BASIS : PREIS_PLUS;
}

// "Eingerichtet" heisst: mindestens EIN Preis ist konfiguriert (meist zuerst Plus,
// da Basis historisch kostenlos war). erstelleCheckout prüft den konkret gewählten
// Preis selbst und wirft einen klaren Fehler, falls DER fehlt.
function konfiguriert() {
  return !!SECRET && (!!PREIS_PLUS || !!PREIS_BASIS);
}

// Objekt -> flaches x-www-form-urlencoded (Stripe erwartet metadata[firma_id]=... usw.)
function formCodieren(obj, praefix, ziel) {
  ziel = ziel || new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    const schluessel = praefix ? `${praefix}[${k}]` : k;
    if (v && typeof v === "object") formCodieren(v, schluessel, ziel);
    else ziel.append(schluessel, String(v));
  }
  return ziel;
}

// Erzeugt eine Checkout-Session für den gewählten Plan ("basis" oder "plus").
// firmaId UND plan wandern in die Metadaten — der Webhook setzt firmen.plan
// exakt auf den bezahlten Plan (nicht hart auf "plus"), erkennbar allein am
// Event, ohne einen zusätzlichen Stripe-API-Aufruf für die Preis-Zuordnung.
async function erstelleCheckout({ firmaId, plan, erfolgUrl, abbruchUrl }) {
  const zielPlan = plan === "basis" ? "basis" : "plus";
  const preis = preisFuer(zielPlan);
  if (!preis) throw new Error("Für den Plan '" + zielPlan + "' ist kein Stripe-Preis eingerichtet.");
  const body = formCodieren({
    mode: "subscription",
    "line_items": [{ price: preis, quantity: 1 }],
    success_url: erfolgUrl,
    cancel_url: abbruchUrl,
    client_reference_id: firmaId,
    metadata: { firma_id: firmaId, plan: zielPlan },
    // Firma-ID + Plan auch am Abo hinterlegen -> Kündigungs-Webhook findet sie wieder.
    subscription_data: { metadata: { firma_id: firmaId, plan: zielPlan } },
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

// Prüft die Stripe-Webhook-Signatur (Header "stripe-signature": "t=...,v1=...").
// Verhindert gefälschte Webhook-Aufrufe (jemand könnte sich sonst gratis Plus setzen).
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

module.exports = { konfiguriert, erstelleCheckout, verifiziereWebhook };
