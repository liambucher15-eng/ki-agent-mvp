// Seiten-Aktionen — was der Agent auf der Seite TUN darf.
//
// ══ DIE GRENZE ══════════════════════════════════════════════════════════════
// Erlaubt sind nur Aktionen, die ZEIGEN. Nicht erlaubt ist alles, was für den
// Besucher entscheidet: kein Klick auf „Kaufen", „Bestellen", „Bezahlen" oder
// „Absenden", kein Ausfüllen von Formularen, kein Warenkorb-Eintrag.
//
// Das ist keine technische Einschränkung, sondern eine bewusste: Ein Kauf ist
// die Entscheidung des Besuchers. Ein Assistent, der sie ihm abnimmt, ist kein
// Assistent mehr. Und ein Klick auf „Bestellen" lässt sich nicht rückgängig
// machen — der Agent liest aber Seiteninhalte, die ihm jeder unterschieben
// kann. Beides zusammen wäre fahrlässig.
//
// Was bleibt, ist trotzdem wertvoll: „Die Lieferzeit steht weiter unten" und
// die Seite scrollt dorthin. Das ist die Hilfe, die man im Laden bekommt, wenn
// jemand auf ein Regal zeigt.
// ════════════════════════════════════════════════════════════════════════════
//
// Alles hier wird ZWEIMAL geprüft: einmal serverseitig (diese Datei) und noch
// einmal im Widget, bevor etwas passiert. Doppelt, weil die Anweisung aus einer
// Modell-Antwort stammt und das Modell Seiteninhalte liest, die manipuliert
// sein können.

(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.SeitenAktion = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAX_ZIEL = 80;

  // Die vollständige Liste. Was hier nicht steht, passiert nicht.
  const ERLAUBT = {
    // Zu einer Stelle scrollen und sie kurz hervorheben. Rein visuell,
    // jederzeit rückgängig (der Besucher scrollt einfach weiter).
    zeigen: { braucht: "ziel" },
    // Auf eine andere Seite DESSELBEN Shops wechseln. Sichtbar und mit dem
    // Zurück-Knopf umkehrbar. Fremde Domains sind ausgeschlossen.
    oeffnen: { braucht: "pfad" },
  };

  function text(wert, max) {
    if (typeof wert !== "string") return "";
    return wert.replace(/\s+/g, " ").trim().slice(0, max);
  }

  // Nur ein Pfad auf derselben Seite. Bewusst KEINE absoluten URLs: damit ist
  // „gleiche Herkunft" nicht eine Prüfung, die man falsch schreiben kann,
  // sondern ergibt sich aus der Form.
  function sauberePfad(wert) {
    const roh = text(wert, 300);
    if (!roh) return "";
    if (!roh.startsWith("/")) return "";   // relativ zur Wurzel, sonst nichts
    if (roh.startsWith("//")) return "";   // protokoll-relativ -> fremde Domain
    // Kein Leerraum: ein echter URL-Pfad hat keinen (dort stünde %20). Muss VOR
    // der Steuerzeichen-Prüfung stehen, denn text() macht aus Tab und Umbruch
    // bereits ein Leerzeichen — sie kämen sonst nie bei der Prüfung an.
    if (/\s/.test(roh)) return "";
    if (/[\x00-\x1f]/.test(roh)) return "";
    return roh;
  }

  // Formulierungen, bei denen der Agent NICHT hinzeigen soll. Er soll den
  // Besucher nicht zum Kaufknopf schubsen — wenn der kaufen will, findet er ihn.
  const HEIKEL = /\b(kaufen|bestellen|bezahlen|zahlungspflichtig|absenden|abschicken|jetzt buchen|order now|buy now|checkout)\b/i;

  function saubereAktion(eingabe) {
    if (!eingabe || typeof eingabe !== "object") return null;
    const name = text(eingabe.aktion, 20).toLowerCase();
    const regel = ERLAUBT[name];
    if (!regel) return null;

    if (name === "oeffnen") {
      const pfad = sauberePfad(eingabe.pfad || eingabe.ziel);
      if (!pfad) return null;
      return { aktion: "oeffnen", pfad };
    }

    const ziel = text(eingabe.ziel, MAX_ZIEL);
    if (!ziel) return null;
    // Auf einen Kauf-Knopf zeigen heisst, zum Kauf zu drängen. Das ist nicht
    // die Aufgabe. Der Agent darf über den Kauf reden, nur nicht darauf deuten.
    if (HEIKEL.test(ziel)) return null;
    return { aktion: "zeigen", ziel };
  }

  // Steht das Ziel ÜBERHAUPT auf dieser Seite?
  //
  // Ohne diese Prüfung kündigt der Agent an, zu einer Stelle zu scrollen, die
  // es nicht gibt — er kennt ja auch das Wissen der Firma und verwechselt beides.
  // Das Widget täte dann stillschweigend nichts, und der Besucher bekäme ein
  // Versprechen, das sichtbar nicht eingehalten wird. Schlimmer als gar keine
  // Hilfe, weil es den Agenten unzuverlässig wirken lässt.
  //
  // Geprüft wird gegen den Seitentext, den der Browser mitgeschickt hat — genau
  // die Grundlage, auf der auch das Widget später sucht.
  function zielStehtAufSeite(ziel, seitenText) {
    const z = String(ziel || "").toLowerCase().trim();
    if (!z) return false;
    const t = String(seitenText || "").toLowerCase();
    if (!t) return false;
    if (t.includes(z)) return true;
    // Mehrwortige Ziele ("Rückgabe Bedingungen") scheitern sonst an der genauen
    // Schreibweise. Es genügt, wenn jedes Wort vorkommt und mindestens eines
    // lang genug ist, um etwas zu bedeuten.
    const woerter = z.split(/\s+/).filter((w) => w.length > 3);
    if (!woerter.length) return false;
    return woerter.every((w) => t.includes(w));
  }

  return { saubereAktion, sauberePfad, zielStehtAufSeite, ERLAUBT, HEIKEL, MAX_ZIEL };
});
