// Serverseitige Anmeldung: prüft das Clerk-Session-Token einer Anfrage.
//
// WARUM ES DAS BRAUCHT
// Bis hierher nahmen die Functions die Clerk-Nutzer-ID einfach aus dem Body
// entgegen und glaubten sie. Wer eine fremde Clerk-ID kannte, bekam über
// abo-portal.js deren Stripe-Kundenportal: Rechnungen, Zahlungsmittel,
// Kündigung. Der Browser darf sagen, WAS er will — aber nicht, WER er ist.
// Wer er ist, steht ab jetzt in einer Signatur, die er nicht fälschen kann.
//
// Der Browser schrieb schon immer sauber: store.js reicht dasselbe Token an
// Supabase weiter, und die RLS-Policies vergleichen mit auth.jwt()->>'sub'.
// Ungeprüft blieben nur die Functions, die mit dem Service-Key arbeiten und
// damit an der RLS vorbei.
//
// OHNE NPM-PAKET
// Das Projekt führt null Abhängigkeiten (package.json). Die RS256-Prüfung
// steht deshalb hier von Hand, mit node:crypto — genau wie lib/stripe.js die
// Webhook-Signatur von Hand prüft.
//
// UMGEBUNGSVARIABLE
//   CLERK_ISSUER = https://loyal-marmot-61.clerk.accounts.dev
// Die Adresse steckt im Publishable Key (public/lib/clerk-config.js): der Teil
// nach "pk_test_" / "pk_live_" ist base64 und ergibt die Domain mit einem "$"
// am Ende. Fehlt die Variable, wird sie daraus abgeleitet, sofern
// CLERK_PUBLISHABLE_KEY gesetzt ist.

const crypto = require("crypto");
const { json } = require("./schutz");

const IST_DEV = process.env.NETLIFY_DEV === "true";

// Clerk-Session-Tokens leben standardmässig 60 Sekunden und werden vom
// Frontend laufend erneuert. Etwas Toleranz gegen Uhrendrift zwischen Clerk
// und Netlify, mehr nicht — eine grosszügige Spanne würde ein abgelaufenes
// Token unnötig lange gültig halten.
const DRIFT_SEK = 10;

// ── Herausgeber bestimmen ───────────────────────────────────────────────────

function ausPublishableKey(pk) {
  // "pk_test_bG95YWwt…" -> base64 dekodieren -> "loyal-marmot-61.clerk.accounts.dev$"
  const roh = String(pk || "").replace(/^pk_(test|live)_/, "");
  if (!roh) return "";
  try {
    const domain = Buffer.from(roh, "base64").toString("utf8").replace(/\$+$/, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? "https://" + domain : "";
  } catch {
    return "";
  }
}

function herausgeber() {
  const gesetzt = (process.env.CLERK_ISSUER || "").trim().replace(/\/+$/, "");
  if (gesetzt) return gesetzt;
  return ausPublishableKey(process.env.CLERK_PUBLISHABLE_KEY);
}

function konfiguriert() {
  return !!herausgeber();
}

// ── JWKS holen und zwischenspeichern ────────────────────────────────────────
//
// Der Schlüsselsatz ändert sich fast nie. Ihn bei jeder Anfrage zu holen wäre
// ein zusätzlicher Netzwerkweg vor jeder Antwort. Er liegt deshalb im
// Modulscope — bei Netlify überlebt der so lange wie die warme Instanz.
//
// Der Sonderfall, für den ausdrücklich gesorgt ist: Clerk rollt einen neuen
// Schlüssel aus, unser Cache kennt ihn noch nicht. Dann wird EINMAL neu
// geladen, statt jede Anfrage abzulehnen, bis die Instanz kalt wird.

let jwksCache = null;
let jwksZeit = 0;
const JWKS_FRISCH_MS = 10 * 60 * 1000;

async function ladeJwks(erzwingen) {
  const jetzt = Date.now();
  if (!erzwingen && jwksCache && jetzt - jwksZeit < JWKS_FRISCH_MS) return jwksCache;

  const url = herausgeber() + "/.well-known/jwks.json";
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("JWKS nicht erreichbar (" + res.status + ")");
  const daten = await res.json();
  if (!daten || !Array.isArray(daten.keys)) throw new Error("JWKS ohne Schlüssel");

  jwksCache = daten.keys;
  jwksZeit = jetzt;
  return jwksCache;
}

async function schluesselFuer(kid) {
  let keys = await ladeJwks(false);
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    // Unbekannte kid -> einmal neu laden, vielleicht hat Clerk rotiert.
    keys = await ladeJwks(true);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error("Unbekannter Schlüssel");
  if (jwk.kty !== "RSA") throw new Error("Unerwarteter Schlüsseltyp");
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

// ── Token prüfen ────────────────────────────────────────────────────────────

function base64UrlZuBuffer(s) {
  return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function teilLesen(s) {
  return JSON.parse(base64UrlZuBuffer(s).toString("utf8"));
}

// Prüft ein Clerk-Session-Token und gibt die Nutzer-ID (sub) zurück.
// Wirft bei jedem Fehler — der Aufrufer nutzt pruefeAnmeldung().
async function pruefeToken(token) {
  const teile = String(token || "").split(".");
  if (teile.length !== 3) throw new Error("Token hat nicht drei Teile");

  const [kopfB64, nutzlastB64, signaturB64] = teile;

  let kopf;
  try { kopf = teilLesen(kopfB64); } catch { throw new Error("Kopf unlesbar"); }

  // Nur RS256. Ohne diese Prüfung wäre "alg": "none" ein Passierschein, und
  // "alg": "HS256" liesse den öffentlichen Schlüssel als HMAC-Geheimnis
  // missbrauchen — beides klassische JWT-Löcher.
  if (kopf.alg !== "RS256") throw new Error("Unerlaubtes Verfahren: " + kopf.alg);
  if (!kopf.kid) throw new Error("Kein Schlüsselbezeichner");

  const schluessel = await schluesselFuer(kopf.kid);
  const unterschrieben = Buffer.from(kopfB64 + "." + nutzlastB64, "utf8");
  const signatur = base64UrlZuBuffer(signaturB64);

  if (!crypto.verify("sha256", unterschrieben, schluessel, signatur)) {
    throw new Error("Signatur ungültig");
  }

  let nutzlast;
  try { nutzlast = teilLesen(nutzlastB64); } catch { throw new Error("Nutzlast unlesbar"); }

  const jetzt = Math.floor(Date.now() / 1000);
  if (typeof nutzlast.exp === "number" && jetzt > nutzlast.exp + DRIFT_SEK) {
    throw new Error("Token abgelaufen");
  }
  if (typeof nutzlast.nbf === "number" && jetzt + DRIFT_SEK < nutzlast.nbf) {
    throw new Error("Token noch nicht gültig");
  }

  // Der Herausgeber muss unser Clerk sein. Sonst würde ein gültig signiertes
  // Token einer FREMDEN Clerk-Instanz hier durchgehen — jeder kann sich eine
  // eigene anlegen.
  const soll = herausgeber();
  if (soll && nutzlast.iss && nutzlast.iss.replace(/\/+$/, "") !== soll) {
    throw new Error("Fremder Herausgeber");
  }

  if (!nutzlast.sub || typeof nutzlast.sub !== "string") {
    throw new Error("Keine Nutzer-ID im Token");
  }

  return nutzlast.sub;
}

// ── Was die Functions aufrufen ──────────────────────────────────────────────

function holeToken(event) {
  const h = event.headers || {};
  const kopf = h.authorization || h.Authorization || "";
  const treffer = /^Bearer\s+(.+)$/i.exec(kopf.trim());
  return treffer ? treffer[1].trim() : "";
}

// Prüft die Anmeldung einer Anfrage.
//
// Rückgabe entweder { ok: true, nutzer: "user_…" }
// oder { ok: false, antwort: <fertige HTTP-Antwort> } — der Aufrufer gibt die
// Antwort einfach zurück. Dasselbe Muster wie ladeProbe() in chat.js.
//
// FAIL-CLOSED: Ist Clerk nicht konfiguriert, wird in Produktion abgelehnt. Nur
// unter `netlify dev` läuft die App wie bisher weiter, damit der
// Simulations-Modus ohne Clerk-Key nicht kaputtgeht. Fail-open in Produktion
// wäre genau das Loch, das diese Datei schliesst.
async function pruefeAnmeldung(event) {
  if (!konfiguriert()) {
    if (IST_DEV) return { ok: true, nutzer: null, dev: true };
    console.error("SICHERHEIT anmeldung: CLERK_ISSUER fehlt — Anfrage abgelehnt");
    return { ok: false, antwort: json(500, { error: "Anmeldung ist nicht eingerichtet." }) };
  }

  const token = holeToken(event);
  if (!token) {
    return { ok: false, antwort: json(401, { error: "Nicht angemeldet." }) };
  }

  try {
    const nutzer = await pruefeToken(token);
    return { ok: true, nutzer };
  } catch (e) {
    // Der Grund bleibt im Log, der Browser bekommt ihn nicht: sonst verrät die
    // Antwort, ob ein Token abgelaufen, falsch signiert oder von einem fremden
    // Herausgeber war — ein Hinweis, den nur ein Angreifer braucht.
    console.error("SICHERHEIT anmeldung: Token abgelehnt:", e.message);
    return { ok: false, antwort: json(401, { error: "Nicht angemeldet." }) };
  }
}

module.exports = {
  pruefeAnmeldung,
  pruefeToken,
  holeToken,
  konfiguriert,
  herausgeber,
  ausPublishableKey,
};
