// Der Testzeitraum: vierzehn Tage, ohne Zahlungsmittel.
//
// WARUM ES DIESE DATEI GIBT
// Der Plan "free" war nie als Plan gedacht, sondern als Probelauf — 150
// Antworten im Monat, aber unbegrenzt lange. Damit war er fuer viele
// Kleinbetriebe die Dauerloesung, und es zahlte nie jemand. Der Rechner auf
// der Preisseite musste eigens davon abgehalten werden, ihn zu empfehlen.
// Diese Datei macht aus dem Probelauf das, was er sein sollte: befristet.
//
// KEINE MIGRATION NOETIG
// Das Ablaufdatum wird nicht gespeichert, sondern gerechnet: firmen.erstellt
// gibt es seit dem ersten Schema (schema.sql), und Ablauf = erstellt + 14
// Tage. Eine eigene Spalte waere eine zweite Wahrheit, die mit der ersten
// auseinanderlaufen kann.
//
// KEIN ZAHLUNGSMITTEL
// Bewusst nicht ueber Stripes trial_period_days geloest. Das verlangt die
// Kartennummer, bevor der Betrieb den Agenten je gesehen hat — und damit
// genau die Vorleistung, gegen die die ganze Startseite argumentiert.
// Der Preis dafuer: schlechtere Abschlussquote. Das ist die Entscheidung.

const TESTTAGE = 14;
const TAG_MS = 24 * 60 * 60 * 1000;

// Nur der kostenlose Plan hat einen Testzeitraum. Wer bezahlt, hat keinen —
// sein Kontingent regelt bereits, was er darf.
const IM_TEST_PLAN = "free";

/**
 * Wie steht es um den Testzeitraum dieser Firma?
 *
 * @param {object} firma  geladene Firma; gebraucht werden plan und erstellt
 * @param {number} [jetzt] Zeitpunkt in ms, nur fuer Tests
 * @returns {{testet: boolean, abgelaufen: boolean, tageUebrig: number|null}}
 */
function testLage(firma, jetzt = Date.now()) {
  const ruhig = { testet: false, abgelaufen: false, tageUebrig: null };
  if (!firma) return ruhig;

  // Bezahlte Plaene haben keinen Testzeitraum.
  const plan = firma.plan || "";
  if (plan !== IM_TEST_PLAN) return ruhig;

  // Ohne verwertbares Datum gilt der Test als LAUFEND, nicht als abgelaufen.
  //
  // Dieselbe Regel wie beim Verbrauchszaehler in verbrauch.js: Ein Problem auf
  // UNSERER Seite — fehlendes Feld, kaputter Wert, alte Zeile ohne erstellt —
  // darf keinen Agenten abschalten, der auf der Webseite eines Kunden steht.
  // Der Schaden eines zu langen Tests ist ein paar Rappen; der Schaden eines
  // faelschlich verstummten Agenten trifft das Geschaeft des Kunden.
  const start = Date.parse(firma.erstellt);
  if (!Number.isFinite(start)) return { testet: true, abgelaufen: false, tageUebrig: null };

  const ende = start + TESTTAGE * TAG_MS;
  const uebrig = Math.ceil((ende - jetzt) / TAG_MS);
  if (jetzt >= ende) return { testet: true, abgelaufen: true, tageUebrig: 0 };
  return { testet: true, abgelaufen: false, tageUebrig: Math.max(1, uebrig) };
}

/**
 * Anweisung an den Agenten, wenn der Testzeitraum vorbei ist.
 *
 * Bewusst NICHT derselbe Text wie bei aufgebrauchtem Kontingent ("gerade ist
 * viel los"). Das waere gelogen: Es ist nichts los, der Test ist vorbei. Der
 * Besucher der Kundenseite darf das aber nicht ausbaden — er hat nichts
 * falsch gemacht und ist der potenzielle Kunde UNSERES Kunden. Deshalb sagt
 * der Agent nicht "der Betrieb hat nicht bezahlt", sondern nimmt auf.
 */
function promptZusatzTest(kannKontakt) {
  return "\n\nBESONDERE LAGE: Der Testzeitraum dieses Agenten ist abgelaufen. " +
    "Beantworte inhaltliche Fragen NICHT mehr. Sag in EINEM freundlichen Satz, " +
    "dass du gerade keine Auskunft geben kannst, und " +
    (kannKontakt
      ? "nimm die Frage mit dem Werkzeug „kontakt_hinterlassen“ auf, damit sich der Betrieb meldet."
      : "bitte den Besucher, den Betrieb direkt zu kontaktieren.") +
    " Erwaehne WEDER Testzeitraum NOCH Bezahlung NOCH AuraChat — das ist eine " +
    "Sache zwischen uns und dem Betrieb, nicht zwischen dem Betrieb und seinen Kunden.";
}

module.exports = { TESTTAGE, testLage, promptZusatzTest };
