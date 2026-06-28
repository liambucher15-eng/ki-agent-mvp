// Gibt dem Frontend die OEFFENTLICHE Praesentation einer Firma zurueck:
// Anzeigename, Persona-Name und Charakter-Aussehen (Farben).
// Kein Geheimnis hier — nur das, was das Chatfenster zum Anzeigen braucht.

const { ladeFirma } = require("./lib/firmen");

exports.handler = async (event) => {
  const json = (statusCode, obj) => ({
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  });

  const id = (event.queryStringParameters && event.queryStringParameters.id) || "";
  const firma = ladeFirma(id);
  if (!firma) return json(404, { error: `Unbekannte Firma: ${id}` });

  return json(200, {
    name: firma.name,
    persona: firma.persona?.name || "",
    charakter: firma.charakter || {},
  });
};
