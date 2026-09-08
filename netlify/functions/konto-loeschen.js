// Konto und Agent endgültig löschen.
//
// Es gab bisher keinen Weg dafür. Das ist DSGVO Art. 17 und gleichzeitig der
// Punkt "account deletion" von der App-Checkliste: Eine App, die man nicht
// verlassen kann, ist nicht fertig.
//
// SICHERHEIT
// Wer gelöscht wird, sagt ausschliesslich das Clerk-Token. Aus dem Body kommt
// nur eine Bestätigung — nie eine Nutzer- oder Firmen-ID. Sonst wäre das hier
// der gefährlichste Endpunkt im ganzen System.
//
// WAS NICHT GELÖSCHT WIRD, UND WARUM
//   - Das Clerk-Konto selbst. Dafür bräuchte es den Clerk-Secret-Key auf dem
//     Server; den gibt es hier bewusst nicht. Der Nutzer bekommt stattdessen
//     den Hinweis, sein Login bei Clerk zu entfernen.
//   - Rechnungen bei Stripe. Für die gilt eine gesetzliche Aufbewahrungspflicht
//     von zehn Jahren — sie zu löschen wäre nicht erlaubt.
// Beides steht so auch in public/datenschutz.html.

const { json, holeIp, originErlaubt, rateOk, serverFehler, sicherheitsLog } = require("./lib/schutz");
const { pruefeAnmeldung } = require("./lib/anmeldung");
const { loescheKonto, konfiguriert } = require("./lib/konto");
const { holeAboServer } = require("./lib/firmaLaden");
const { beendeAbos } = require("./lib/stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Nur POST erlaubt" });
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });
  if (!konfiguriert()) return json(501, { error: "Löschen ist nicht eingerichtet." });

  // Streng begrenzt: Niemand hat einen Grund, das öfter als ein paar Mal zu
  // versuchen.
  if (!(await rateOk("loeschen:" + holeIp(event), 3, 300))) {
    return json(429, { error: "Zu viele Versuche. Bitte einen Moment warten." });
  }

  const anmeldung = await pruefeAnmeldung(event);
  if (!anmeldung.ok) return anmeldung.antwort;
  const nutzer = anmeldung.nutzer;
  if (!nutzer) return json(401, { error: "Nicht angemeldet." });

  // Doppelte Absicht. Der Knopf im Dashboard fragt schon nach; diese zweite
  // Hürde verhindert, dass ein versehentlicher oder untergeschobener Aufruf
  // durchgeht — der Vorgang ist nicht umkehrbar.
  let bestaetigung;
  try { ({ bestaetigung } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }
  if (bestaetigung !== "LÖSCHEN") {
    return json(400, { error: 'Zum Löschen muss "LÖSCHEN" bestätigt werden.' });
  }

  try {
    // ERST Stripe, DANN die Daten. Andersherum liefe die Abbuchung für ein
    // Konto weiter, das es nicht mehr gibt — und niemand könnte es noch
    // zuordnen, weil die abos-Zeile mit der Kunden-ID weg wäre.
    let beendet = 0;
    const abo = await holeAboServer(nutzer);
    if (abo && abo.stripe_kunde) {
      beendet = await beendeAbos(abo.stripe_kunde);
    }

    const bericht = await loescheKonto(nutzer);
    sicherheitsLog("konto", "geloescht: " + nutzer + " (" + bericht.agenten + " Agenten, " + beendet + " Abos beendet)");

    return json(200, {
      ok: true,
      geloescht: bericht,
      abosBeendet: beendet,
      hinweis:
        "Deine Daten bei AuraChat sind gelöscht. Dein Login verwaltet Clerk — " +
        "das Konto dort entfernst du in deinem Profil. Rechnungen bleiben bei " +
        "Stripe, dafür gilt eine gesetzliche Aufbewahrungspflicht.",
    });
  } catch (e) {
    return serverFehler("konto-loeschen", e,
      "Das Löschen ist nicht vollständig durchgelaufen. Bitte melde dich, damit wir es von Hand zu Ende bringen.");
  }
};
