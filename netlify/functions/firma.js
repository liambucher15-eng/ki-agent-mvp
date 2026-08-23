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

  // KEIN ABO-GATE MEHR AUF DER FIGUR.
  //
  // Hier stand bis zum Umbau der Preisseite: bilder loeschen, sobald der Plan
  // nicht "plus" ist. Das passte zur alten Ordnung, in der die Figur das
  // Unterscheidungsmerkmal des teuersten Plans war ("Fuer Betriebe, denen eine
  // Farbkugel als Gesicht genuegt.").
  //
  // Diese Ordnung gibt es nicht mehr. Die Preisseite nennt "Eigene Figur mit
  // fuenf Zustaenden" jetzt in JEDEM Plan, auch im kostenlosen — sie ist das
  // Markenzeichen und gehoert nicht hinter eine Schranke. Getrennt wird
  // stattdessen ueber das, was der Agent TUT (Posteingang, Produktvorschlaege,
  // proaktive Hinweise) und ueber die Zahl der Antworten je Monat
  // (lib/verbrauch.js).
  //
  // Waere die Zeile stehen geblieben, haette nach migration-plaene.sql sogar
  // ein ZAHLENDER grow-Kunde sein Gesicht verloren — denn "grow" ist nicht
  // "plus". Genau der Fall, in dem die Seite etwas verspricht, das der Server
  // wegnimmt.
  const plan = firma.plan || "free";
  const charakter = { ...(firma.charakter || {}) };
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
