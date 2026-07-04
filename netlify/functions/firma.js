// Gibt dem Frontend die OEFFENTLICHE Praesentation einer Firma zurueck:
// Anzeigename, Persona-Name, Charakter-Aussehen (Farben + evtl. Bilder), Plan,
// FAQ und Fakten (Oeffnungszeiten/Adresse/Kontakt — fuer die Vorschlags-Chips).
//
// WICHTIG (Milestone 0): Dies ist der EINZIGE Weg, wie der Browser Firmendaten
// von Fremden liest — private Felder (email, webseite, wissen) bleiben bewusst
// draussen. Der Direktzugriff auf die Supabase-Tabelle ist per RLS auf den
// Besitzer beschraenkt (siehe schema.sql / migration-m0.sql).
// Laedt Seed-Firmen UND per Onboarding angelegte Firmen (Supabase).

const { ladeFirmaServer } = require("./lib/firmaLaden");

exports.handler = async (event) => {
  const json = (statusCode, obj) => ({
    statusCode,
    headers: {
      "content-type": "application/json",
      // Öffentliche Infos -> darf das Widget von der KUNDEN-Domain aus
      // (cross-origin) abrufen, um den Launcher (Orb vs. Figur) zu bestimmen.
      "access-control-allow-origin": "*",
      // Firmendaten aendern sich selten -> kurzer Cache entlastet Function + DB
      // bei jedem Seitenaufruf auf Kundenseiten deutlich.
      "cache-control": "public, max-age=300",
    },
    body: JSON.stringify(obj),
  });

  const id = (event.queryStringParameters && event.queryStringParameters.id) || "";
  const firma = await ladeFirmaServer(id);
  if (!firma) return json(404, { error: `Unbekannte Firma: ${id}` });

  // PLUS-GATE (Milestone 5): Die eigene Figur (charakter.bilder) ist ein
  // Plus-Feature. Der Plan kommt aus der SERVER-Spalte firmen.plan (nicht aus
  // vom Client geschriebenen Daten) — künftig gesetzt vom Stripe-Webhook. Hier
  // werden die Bilder für Nicht-Plus-Firmen entfernt: Das Widget zeigt dann den
  // Orb, egal was in den Daten steht. Das ist die ECHTE Durchsetzung, nicht die
  // Client-Simulation im Onboarding.
  const plan = firma.plan || "basis";
  const charakter = { ...(firma.charakter || {}) };
  if (plan !== "plus") delete charakter.bilder;

  return json(200, {
    name: firma.name,
    persona: firma.persona?.name || "",
    charakter,
    plan,
    faq: Array.isArray(firma.faq) ? firma.faq : [],
    fakten: firma.fakten || {},
  });
};
