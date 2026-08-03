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
const { konfiguriert: stripeKonfiguriert } = require("./lib/stripe");

exports.handler = async (event) => {
  const json = (statusCode, obj) => ({
    statusCode,
    headers: {
      "content-type": "application/json",
      // Öffentliche Infos -> darf das Widget von der KUNDEN-Domain aus
      // (cross-origin) abrufen, um den Charakter-Launcher aufzubauen.
      "access-control-allow-origin": "*",
      // Firmendaten aendern sich selten -> kurzer Cache entlastet Function + DB
      // bei jedem Seitenaufruf auf Kundenseiten deutlich. Aber: Wer im Dashboard
      // seinen Charakter aendert, will das Ergebnis zeitnah im Widget sehen und
      // nicht minutenlang glauben, es sei kaputt. 60 s frisch, danach wird die
      // alte Antwort noch ausgeliefert, waehrend im Hintergrund neu geholt wird
      // (kein Ladehaenger). Dashboard und Test-Chat umgehen den Cache ganz.
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
    body: JSON.stringify(obj),
  });

  const id = (event.queryStringParameters && event.queryStringParameters.id) || "";
  const firma = await ladeFirmaServer(id);
  if (!firma) return json(404, { error: `Unbekannte Firma: ${id}` });

  // ABO-GATE (Milestone 5): Es gibt nur EINE Variante (den KI-Charakter). Der
  // Charakter (charakter.bilder) wird nur bei aktivem Abo live ausgeliefert.
  // Der Status kommt aus der SERVER-Spalte firmen.plan ("plus" = Abo aktiv,
  // gesetzt vom Stripe-Webhook), NICHT aus vom Client geschriebenen Daten. Ohne
  // aktives Abo werden die Bilder entfernt -> das Widget zeigt das Initial in
  // Markenfarbe. Das ist die ECHTE Durchsetzung, nicht die Onboarding-Vorschau.
  //
  // ABER: Das Gate greift nur, wenn ein Abo ueberhaupt abschliessbar IST (Stripe
  // eingerichtet). Ohne Stripe kann niemand auf "plus" kommen — dann waere der
  // im Onboarding erstellte Charakter dauerhaft unsichtbar und die Kette
  // Onboarding -> Dashboard -> Chat waere gar nicht lauffaehig (Entwicklung,
  // Demo, Selbst-Hosting). Sobald STRIPE_SECRET_KEY + ein Preis gesetzt sind,
  // ist das Gate unveraendert streng.
  const plan = firma.plan || "basis";
  const charakter = { ...(firma.charakter || {}) };
  if (plan !== "plus" && stripeKonfiguriert()) delete charakter.bilder;
  // Die Charakter-Beschreibung ist interne Prompt-Information (sie steckt im
  // System-Prompt, den der Server baut) und hat im oeffentlichen Ergebnis
  // nichts verloren — das Widget braucht nur Farben, Schrift und Bilder.
  delete charakter.beschreibung;

  return json(200, {
    name: firma.name,
    persona: firma.persona?.name || "",
    rolle: firma.persona?.rolle || "",
    charakter,
    plan,
    faq: Array.isArray(firma.faq) ? firma.faq : [],
    fakten: firma.fakten || {},
  });
};
