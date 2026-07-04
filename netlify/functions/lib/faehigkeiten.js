// Fähigkeiten ("Tools") des Agenten — datengetrieben wie alles andere.
// Eine Firma listet in daten.faehigkeiten, was ihr Agent KANN (z.B. "kontakt").
// Hier wird daraus die Claude-Tool-Definition gebaut. Neue Fähigkeit = neuer
// Eintrag hier + ein Handler in chat.js — kein firmenspezifischer Code.
//
// Das ist der Schritt vom Chatbot zum AGENTEN: der Agent kann jetzt HANDELN
// (eine Kontaktanfrage aufnehmen), nicht nur antworten.

const KATALOG = {
  kontakt: {
    name: "kontakt_hinterlassen",
    description:
      "Nimm die Kontaktdaten eines Besuchers auf, wenn er zurückgerufen/kontaktiert " +
      "werden möchte, eine Reservierung/Anfrage stellt oder du seine Frage nicht " +
      "beantworten kannst und das Team sich melden soll. Frag vorher freundlich nach " +
      "Name und einer Kontaktmöglichkeit (E-Mail oder Telefon), falls noch nicht genannt.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name des Besuchers, falls genannt" },
        kontakt: { type: "string", description: "E-Mail oder Telefonnummer des Besuchers" },
        nachricht: { type: "string", description: "Worum es geht — das Anliegen in 1-2 Sätzen" },
      },
      required: ["nachricht"],
    },
  },
};

// Baut die Tools-Liste für eine Firma aus ihren Fähigkeiten.
function baueTools(firma) {
  const liste = Array.isArray(firma && firma.faehigkeiten) ? firma.faehigkeiten : [];
  return liste.map((f) => KATALOG[f]).filter(Boolean);
}

module.exports = { baueTools, KATALOG };
