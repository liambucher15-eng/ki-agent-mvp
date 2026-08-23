// Verbrauchsstufen: Was passiert, wenn eine Firma viel mehr Antworten
// braucht, als ihr Plan vorsieht.
//
// GRUNDSATZ: Die Grenze spuert der, der den Vertrag unterschrieben hat —
// niemals der Besucher. Der Besucher der Kundenseite hat nichts falsch
// gemacht; er ist der potenzielle Kunde UNSERES Kunden. Zeigt man ihm einen
// kaputten Agenten, schadet man dem Geschaeft des Kunden, also genau dem,
// wofuer er bezahlt.
//
// Deshalb funf Stufen statt einer Wand. Die ersten beiden aendern fuer den
// Besucher GAR NICHTS und sind nur ein Hinweis im Dashboard.
//
// Und: KEINE automatische Hoeherstufung. Das verspricht preis.html
// ausdruecklich ("Keine automatische Hoeherstufung"), und ein Abo, das sich
// von selbst verteuert, ist genau das Gegenteil dessen, was diese Seite
// verkauft. Der Kunde entscheidet selbst — aber er kann es ohne Anruf tun,
// mit einem Knopf im Dashboard.

// Was eine Antwort kostet, gemessen:
//   Haiku 4.5, ~3.500 Eingabe-Tokens (Systemprompt + Verlauf) und ~200
//   Ausgabe-Tokens je Aufruf. Macht rund CHF 0,0036 je Antwort, also grob
//   CHF 0,02 je Gespraech mit fuenf Wortwechseln.
//
// Die Grenzen unten sind daraus abgeleitet und bewusst GROSSZUEGIG: Sie sind
// keine Sparmassnahme, sondern eine Notbremse gegen den einen Ausreisser.
// Ein normaler Kleinbetrieb mit 5.000 Besuchern im Monat landet bei etwa
// 250 bis 750 Antworten — also bei unter einem Zehntel von "basis".
//
// Beim Aendern mitrechnen: Grenze x 0,0036 = ungefaehre Monatskosten in CHF.
//   free      150 -> rund CHF 0.54 bei CHF 0    (Akquisekosten, bewusst)
//   start   3.000 -> rund CHF 11   bei CHF 29
//   grow   12.000 -> rund CHF 43   bei CHF 79
//   scale  50.000 -> rund CHF 180  bei CHF 149  (RECHNERISCH IM MINUS —
//                                                Scale ist als Anfrage-Plan
//                                                gedacht, bei dem einzeln
//                                                verhandelt wird)
const GRENZEN = {
  // Die vier Plaene der Preisseite. Die Zahlen stehen dort woertlich in der
  // Vergleichstabelle ("Antworten pro Monat") — beim Aendern BEIDE Stellen.
  free: 150,
  start: 3000,
  grow: 12000,
  scale: 50000,

  // Alte Schluessel aus der Zeit vor Free/Start/Grow/Scale. Sie stehen noch in
  // der Datenbank (schema.sql: check (plan in ('basis','plus','enterprise')))
  // und in bestehenden Zeilen. Wuerden sie hier fehlen, fiele jede solche Firma
  // stillschweigend auf die KLEINSTE Grenze zurueck — ein zahlender Kunde
  // landete also ohne Zutun im Nachrichtendienst. Darum bleiben sie, bis die
  // Datenbank umgestellt ist.
  basis: 3000,        // = start
  plus: 12000,        // = grow
  enterprise: 50000,  // = scale
};

// Ab wann gewarnt wird, und ab wann der Agent sich einschraenkt.
//
// Die erste Fassung sparte erst bei 150 % und stoppte bei 500 %. Das war ein
// Denkfehler: Bei 150 % ist das Abo bereits anderthalbfach ueberzogen — der
// Deckel griff also erst, nachdem das Geld laengst ausgegeben war. Ein
// Kostenschutz, der erst NACH dem Schaden einsetzt, ist keiner.
//
// Jetzt liegt alles innerhalb des bezahlten Kontingents:
//   75 %  Banner im Dashboard. Fuer den Besucher aendert sich NICHTS.
//         Das ist das Zeitfenster, in dem der Kunde selbst hochstufen kann,
//         bevor irgendjemand etwas merkt.
//   90 %  Sparmodus: knappere Antworten. Der Besucher merkt "knapp", nicht
//         "kaputt". Die restlichen 10 % reichen dadurch deutlich weiter.
//  100 %  Kontingent aufgebraucht. Der Agent beantwortet nichts mehr
//         inhaltlich, sondern nimmt Nachrichten auf — der Kunde bekommt also
//         weiterhin seine Leads, nur ohne weitere Modellkosten.
const HINWEIS_AB = 0.75;     // 75 % — Banner im Dashboard, Besucher merkt nichts
const SPARMODUS_AB = 0.9;    // 90 % — knappere Antworten
const NACHRICHT_AB = 1.0;    // 100 % — Kontingent aufgebraucht, nur noch Nachrichten

/**
 * Welche Stufe gilt bei diesem Stand?
 *
 * @param {number} stand  bereits gegebene Antworten in diesem Monat
 * @param {string} plan   "basis" | "plus" | "enterprise"
 * @returns {{stufe: string, grenze: number, anteil: number, sparmodus: boolean,
 *            nurNachricht: boolean, hinweis: boolean}}
 */
function stufeFuer(stand, plan) {
  // Unbekannter Plan -> kleinster BEZAHLTER Plan, nicht free. Ein Tippfehler im
  // Plan-Namen darf einen zahlenden Kunden nicht auf 150 Antworten werfen.
  const grenze = GRENZEN[plan] || GRENZEN.start;

  // Unbekannter Stand (Zaehler nicht erreichbar): so tun, als sei alles gut.
  // Ein ausgefallener Zaehler darf keinen Agenten drosseln — das waere ein
  // Ausfall bei einem zahlenden Kunden wegen eines Problems auf UNSERER Seite.
  // Number.isFinite statt typeof: NaN IST vom Typ "number", und NaN < 0 ist
  // false — mit der naheliegenden Pruefung rutschte ein kaputter Wert also
  // durch und landete als anteil: NaN in allen Vergleichen. Die Richtung war
  // zufaellig ungefaehrlich (alle >= false, also "normal"), aber die Stufe war
  // falsch benannt und der Waechter tat nicht, was er behauptet.
  if (!Number.isFinite(stand) || stand < 0) {
    return { stufe: "unbekannt", grenze, anteil: 0, sparmodus: false, nurNachricht: false, hinweis: false };
  }

  const anteil = stand / grenze;
  if (anteil >= NACHRICHT_AB) {
    return { stufe: "nachricht", grenze, anteil, sparmodus: true, nurNachricht: true, hinweis: true };
  }
  if (anteil >= SPARMODUS_AB) {
    return { stufe: "sparmodus", grenze, anteil, sparmodus: true, nurNachricht: false, hinweis: true };
  }
  // Die fruehere Stufe "erreicht" (genau 100 %, Agent laeuft noch voll) gibt es
  // nicht mehr: Dort beginnt jetzt der Nachrichtendienst. Bei 100 % ist das
  // bezahlte Kontingent aufgebraucht — weiter voll zu antworten hiesse, ab da
  // draufzuzahlen.
  if (anteil >= HINWEIS_AB) {
    return { stufe: "hinweis", grenze, anteil, sparmodus: false, nurNachricht: false, hinweis: true };
  }
  return { stufe: "normal", grenze, anteil, sparmodus: false, nurNachricht: false, hinweis: false };
}

// Im Sparmodus wird die Antwort kuerzer und der Verlauf knapper — beides
// senkt die Tokenzahl deutlich, ohne dass der Besucher etwas Kaputtes sieht.
// Er merkt nur, dass die Antworten knapper ausfallen.
const SPAR_MAX_TOKENS = 250;   // statt 600
const SPAR_VERLAUF = 6;        // nur die letzten sechs Nachrichten mitschicken

/**
 * Kuerzt den Verlauf im Sparmodus. Die LETZTEN Nachrichten bleiben, weil
 * darin die aktuelle Frage steht; der Anfang des Gespraechs faellt weg.
 */
function kuerzeVerlauf(messages, sparmodus) {
  if (!sparmodus || !Array.isArray(messages) || messages.length <= SPAR_VERLAUF) return messages;
  return messages.slice(-SPAR_VERLAUF);
}

/**
 * Zusatz zum Systemprompt in den beiden hoechsten Stufen.
 *
 * Im Nachrichtendienst antwortet der Agent NICHT mehr inhaltlich, sondern
 * nimmt die Frage auf — wie eine Empfangsdame, die sagt "er ist gerade in
 * einer Besprechung, soll ich etwas ausrichten?". Der Besucher erlebt nichts
 * Defektes, und der Kunde bekommt trotzdem den Lead, also genau das, wofuer
 * er bezahlt.
 */
function promptZusatz(lage, kannKontakt) {
  if (lage.nurNachricht) {
    return "\n\nBESONDERE LAGE: Gerade ist sehr viel los. Beantworte inhaltliche " +
      "Fragen NICHT mehr ausfuehrlich. Sag freundlich und in EINEM Satz, dass " +
      "gerade viel los ist, und " +
      (kannKontakt
        ? "nimm die Frage mit dem Werkzeug „kontakt_hinterlassen“ auf, damit sich das Team meldet."
        : "bitte den Besucher, es spaeter noch einmal zu versuchen oder den Betrieb direkt zu kontaktieren.") +
      " Wirke dabei nicht defekt, sondern beschaeftigt.";
  }
  if (lage.sparmodus) {
    return "\n\nBESONDERE LAGE: Fasse dich jetzt besonders kurz — hoechstens zwei " +
      "kurze Saetze je Antwort. Keine Aufzaehlungen, keine Wiederholungen.";
  }
  return "";
}

module.exports = {
  GRENZEN, HINWEIS_AB, SPARMODUS_AB, NACHRICHT_AB,
  SPAR_MAX_TOKENS, SPAR_VERLAUF,
  stufeFuer, kuerzeVerlauf, promptZusatz,
};
