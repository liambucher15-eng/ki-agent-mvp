// Gibt dem Frontend die OEFFENTLICHE Praesentation einer Firma zurueck:
// Anzeigename, Persona-Name, Charakter-Aussehen (Farben + evtl. Bilder) und Plan.
// Kein Geheimnis hier — nur das, was Chatfenster und Widget-Launcher zum Anzeigen
// brauchen. Laedt Seed-Firmen UND per Onboarding angelegte Firmen (Supabase).

const { ladeFirmaServer } = require("./lib/firmaLaden");

exports.handler = async (event) => {
  const json = (statusCode, obj) => ({
    statusCode,
    // Öffentliche Infos -> darf das Widget von der KUNDEN-Domain aus (cross-origin)
    // abrufen, um den Launcher (Orb vs. Figur) zu bestimmen.
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    body: JSON.stringify(obj),
  });

  const id = (event.queryStringParameters && event.queryStringParameters.id) || "";
  const firma = await ladeFirmaServer(id);
  if (!firma) return json(404, { error: `Unbekannte Firma: ${id}` });

  return json(200, {
    name: firma.name,
    persona: firma.persona?.name || "",
    charakter: firma.charakter || {},
    plan: firma.plan || "basis",
  });
};
