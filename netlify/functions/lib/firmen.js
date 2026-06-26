// Registry aller Firmen ("welche Kunden gibt es?").
// Jede Firma = eine JSON-Datei in /data + eine Zeile hier.
//
// SPÄTER (SaaS-Phase): Diese Registry wird durch eine Datenbank-Abfrage ersetzt
// (z.B. "SELECT * FROM firmen WHERE id = ?"). Der Rest der App bleibt gleich —
// ladeFirma(id) gibt weiterhin ein Firmen-Objekt zurück.

const salbei = require("../../../data/salbei.json");
const nordlicht = require("../../../data/nordlicht.json");

const firmen = { salbei, nordlicht };

// Gibt die Daten einer Firma zurück, oder null wenn es sie nicht gibt.
function ladeFirma(firmaId) {
  return firmen[firmaId] || null;
}

module.exports = { ladeFirma, firmen };
