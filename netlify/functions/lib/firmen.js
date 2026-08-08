// Registry aller Firmen ("welche Kunden gibt es?").
// Jede Firma = eine JSON-Datei in /data + eine Zeile hier.
//
// SPÄTER (SaaS-Phase): Diese Registry wird durch eine Datenbank-Abfrage ersetzt
// (z.B. "SELECT * FROM firmen WHERE id = ?"). Der Rest der App bleibt gleich —
// ladeFirma(id) gibt weiterhin ein Firmen-Objekt zurück.

const salbei = require("../../../data/salbei.json");
const nordlicht = require("../../../data/nordlicht.json");
// Möbelshop — der Prüfstand für den Kaufweg (Produkte, Preise, Warenkorb,
// Kasse). An einem Restaurant liesse sich das nicht prüfen: dort gibt es nichts
// zu vergleichen und nichts in einen Warenkorb zu legen.
const nordform = require("../../../data/nordform.json");
// Aus einem ECHTEN Shop gescannt — Beleg, dass der Katalog im Feld traegt.
const collectif = require("../../../data/collectif.json");

const firmen = { salbei, nordlicht, nordform, collectif };

// Gibt die Daten einer Firma zurück, oder null wenn es sie nicht gibt.
function ladeFirma(firmaId) {
  return firmen[firmaId] || null;
}

module.exports = { ladeFirma, firmen };
