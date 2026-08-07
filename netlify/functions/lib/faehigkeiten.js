// Fähigkeiten ("Tools") des Agenten — datengetrieben wie alles andere.
// Eine Firma listet in daten.faehigkeiten, was ihr Agent KANN (z.B. "kontakt").
// Hier wird daraus die Claude-Tool-Definition gebaut. Neue Fähigkeit = neuer
// Eintrag hier + ein Handler in chat.js — kein firmenspezifischer Code.
//
// Das ist der Schritt vom Chatbot zum AGENTEN: der Agent kann jetzt HANDELN
// (eine Kontaktanfrage aufnehmen), nicht nur antworten.

const KATALOG = {
  // Produkte vorschlagen. Der Agent hat das Sortiment im Prompt (aus dem Wissen
  // der Firma) und sieht die aktuelle Seite — er KANN also längst über Produkte
  // reden. Dieses Werkzeug macht daraus einen ausdrücklichen Vorschlag, der im
  // Chat als anklickbare Karten erscheint statt als Fliesstext.
  //
  // Warum das den Unterschied macht: "Der Stuhl Lund passt dazu, 249 €" liest
  // man weg. Eine Karte mit Namen, Preis und Link ist ein Weg, den man geht.
  // Die Daten kommen aus dem Wissen der Firma; der Agent darf nichts erfinden.
  produkte: {
    name: "produkte_vorschlagen",
    description:
      "Schlage dem Besucher ein bis drei konkrete Produkte vor, wenn er nach einer " +
      "Empfehlung fragt, unentschlossen wirkt, etwas Passendes zu seinem aktuellen " +
      "Produkt sucht, oder wenn du ihm die Auswahl erleichtern willst. Nimm NUR " +
      "Produkte, die in deinen Informationen stehen, mit deren echten Namen und " +
      "Preisen. Erfinde nichts. Schreibe zusätzlich einen kurzen Satz, WARUM du " +
      "genau diese vorschlägst.",
    input_schema: {
      type: "object",
      properties: {
        produkte: {
          type: "array",
          description: "Ein bis drei Produkte, das passendste zuerst.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Genauer Produktname aus deinen Informationen" },
              preis: { type: "string", description: "Preis wie in deinen Informationen, z.B. \"899 €\"" },
              grund: { type: "string", description: "In einem kurzen Satz: warum passt es zu diesem Besucher?" },
              url: { type: "string", description: "Link zum Produkt, falls dir einer bekannt ist" },
            },
            required: ["name", "grund"],
          },
        },
      },
      required: ["produkte"],
    },
  },

  // Auf der Seite etwas zeigen. Was ein Verkäufer im Laden tut, wenn er auf ein
  // Regal deutet — statt zu beschreiben, wo etwas steht.
  //
  // BEWUSSTE GRENZE: nur zeigen und blättern, niemals für den Besucher
  // entscheiden. Warum, steht in lib/seiten-aktion.js.
  seite: {
    name: "seite_zeigen",
    description:
      "Zeig dem Besucher etwas auf der Seite, wenn er fragt wo etwas steht, oder wenn " +
      "die Antwort auf seine Frage weiter unten auf der Seite bereits steht. Nutze " +
      "aktion=\"zeigen\" mit dem sichtbaren Text der Stelle (z.B. \"Lieferzeit\" oder " +
      "\"Rückgabe\") — die Seite scrollt dann dorthin und hebt sie kurz hervor. Nutze " +
      "aktion=\"oeffnen\" mit einem Pfad, um auf eine andere Seite desselben Shops zu " +
      "wechseln; sag vorher in der Antwort, wohin es geht. " +
      "Du kannst NICHTS anklicken, nichts absenden und nichts in den Warenkorb legen — " +
      "das macht der Besucher selbst. Zeig auch nicht auf Kauf- oder Bestellknöpfe.",
    input_schema: {
      type: "object",
      properties: {
        aktion: {
          type: "string",
          enum: ["zeigen", "oeffnen"],
          description: "\"zeigen\" = zu einer Stelle scrollen, \"oeffnen\" = andere Seite laden",
        },
        ziel: {
          type: "string",
          description: "Bei \"zeigen\": der sichtbare Text der Stelle, z.B. \"Lieferzeit\"",
        },
        pfad: {
          type: "string",
          description: "Bei \"oeffnen\": Pfad auf derselben Seite, beginnend mit / (z.B. \"/shop/stuehle\")",
        },
      },
      required: ["aktion"],
    },
  },

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
