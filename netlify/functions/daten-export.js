// Alle eigenen Daten als JSON-Datei herunterladen.
//
// DSGVO Art. 15 (Auskunft) und Art. 20 (Übertragbarkeit). Bisher gab es dafür
// keinen Weg — ein Kunde hätte anfragen müssen, und jemand hätte die Daten von
// Hand zusammensuchen müssen.
//
// Wessen Daten geliefert werden, sagt ausschliesslich das Clerk-Token. Der Body
// wird gar nicht gelesen: Es gibt hier nichts zu wählen, und was man nicht
// entgegennimmt, kann man auch nicht falsch prüfen.

const { json, holeIp, originErlaubt, rateOk, serverFehler } = require("./lib/schutz");
const { pruefeAnmeldung } = require("./lib/anmeldung");
const { exportiereKonto, konfiguriert } = require("./lib/konto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return json(405, { error: "Nur GET oder POST erlaubt" });
  }
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });
  if (!konfiguriert()) return json(501, { error: "Export ist nicht eingerichtet." });

  // Ein Export liest den gesamten Verlauf eines Kontos. Das soll niemand im
  // Sekundentakt auslösen können, auch der Besitzer nicht.
  if (!(await rateOk("export:" + holeIp(event), 5, 300))) {
    return json(429, { error: "Zu viele Anfragen. Bitte einen Moment warten." });
  }

  const anmeldung = await pruefeAnmeldung(event);
  if (!anmeldung.ok) return anmeldung.antwort;
  const nutzer = anmeldung.nutzer;
  if (!nutzer) return json(401, { error: "Nicht angemeldet." });

  try {
    const daten = await exportiereKonto(nutzer);
    const name = "aurachat-daten-" + new Date().toISOString().slice(0, 10) + ".json";
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Damit der Browser die Datei speichert, statt sie anzuzeigen.
        "content-disposition": 'attachment; filename="' + name + '"',
        // Ein Export ist eine Momentaufnahme persönlicher Daten. Nichts davon
        // gehört in einen Cache — weder in den des Browsers noch in einen
        // dazwischenliegenden.
        "cache-control": "no-store",
      },
      body: JSON.stringify(daten, null, 2),
    };
  } catch (e) {
    return serverFehler("daten-export", e, "Der Export ist fehlgeschlagen. Bitte später nochmal.");
  }
};
