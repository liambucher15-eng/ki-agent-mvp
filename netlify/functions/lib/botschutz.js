// Bot-Schutz fuer die oeffentliche Probefahrt (Cloudflare Turnstile).
//
// WARUM AUSGERECHNET DORT
// Die Probefahrt ist die einzige Stelle im System, an der ein Fremder OHNE
// Konto Geld kostet: ein Webseiten-Scan plus bis zu drei Claude-Aufrufe. Alles
// andere haengt inzwischen an einer Anmeldung (lib/anmeldung.js).
//
// Abgesichert war sie bisher nur durch ein Rate-Limit pro IP. Fuer einen
// Menschen ist das eine Bremse, fuer ein Skript mit wechselnden Adressen
// keine.
//
// WARUM TURNSTILE UND NICHT EIN CAPTCHA
// Turnstile laeuft in den allermeisten Faellen ohne Klick durch. Ein Raetsel
// vor der Probefahrt wuerde genau die Leute vertreiben, die sie ueberzeugen
// soll — sie ist das Schaufenster.
//
// AUS, SOLANGE NICHT KONFIGURIERT
// Ohne TURNSTILE_SECRET laesst diese Datei alles durch und sagt das im Log.
// Bewusst fail-open, anders als bei der Anmeldung: Waere es umgekehrt, wuerde
// das naechste Deploy die Probefahrt stumm abschalten, bis jemand einen
// Cloudflare-Schluessel besorgt. Ein Schutz, der das Produkt abschaltet, wird
// abgeschaltet.
//
// EINRICHTEN
//   1. cloudflare.com -> Turnstile -> Widget anlegen (Domain eintragen)
//   2. Site Key nach public/probe.html (data-sitekey)
//   3. Secret Key als Netlify-Umgebungsvariable TURNSTILE_SECRET

const PRUEF_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SECRET = process.env.TURNSTILE_SECRET || "";

let schonGewarnt = false;

function konfiguriert() {
  return !!SECRET;
}

/**
 * Prueft ein Turnstile-Token.
 *
 * @returns {Promise<{ok: boolean, aus?: boolean, grund?: string}>}
 *   ok=true  -> weitermachen
 *   ok=false -> ablehnen, grund steht im Log (nicht in der Antwort an den Browser)
 */
async function pruefeBot(token, ip) {
  if (!konfiguriert()) {
    if (!schonGewarnt) {
      schonGewarnt = true;
      console.warn(
        "BOTSCHUTZ: TURNSTILE_SECRET fehlt — die Probefahrt laeuft ungeschuetzt. " +
        "Einrichten: siehe Kopf von lib/botschutz.js"
      );
    }
    return { ok: true, aus: true };
  }

  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, grund: "kein Token" };
  }

  try {
    const koerper = new URLSearchParams({ secret: SECRET, response: token });
    // Die IP mitzugeben ist optional und macht die Pruefung strenger.
    if (ip && ip !== "unbekannt") koerper.set("remoteip", ip);

    const res = await fetch(PRUEF_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: koerper,
    });
    if (!res.ok) throw new Error("Status " + res.status);
    const daten = await res.json();
    if (daten.success) return { ok: true };
    return { ok: false, grund: (daten["error-codes"] || []).join(",") || "abgelehnt" };
  } catch (e) {
    // Cloudflare nicht erreichbar. Hier fail-OPEN, aus demselben Grund wie
    // oben: Eine Stoerung bei einem Dritten darf nicht das Schaufenster
    // schliessen. Der Kostendeckel bleibt ja bestehen — Rate-Limit, sparsamer
    // Scan und drei gezaehlte Fragen.
    console.error("BOTSCHUTZ: Pruefung nicht moeglich (" + e.message + ") — durchgelassen");
    return { ok: true, aus: true };
  }
}

module.exports = { pruefeBot, konfiguriert };
