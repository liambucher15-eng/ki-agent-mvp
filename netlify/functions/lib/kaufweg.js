// Kaufweg — wo auf dem Weg zum Kauf steht dieser Besucher?
//
// Die anderen Bausteine sehen jeweils einen Ausschnitt: seiten-analyse.js sieht
// die aktuelle Seite, verhalten.js sieht das Verhalten darauf. Keiner sieht den
// WEG. Ob jemand zum ersten Mal ein Produkt anschaut oder schon dreimal
// verglichen hat und jetzt an der Kasse steht, ist aber der Unterschied
// zwischen "erzähl mir davon" und "was hält dich noch auf?".
//
// Die Stufen sind absichtlich grob. Ein feineres Modell würde mehr Daten
// brauchen, als datensparsam vertretbar ist (siehe verhalten.js) — und mehr
// Genauigkeit würde die Antwort nicht besser machen.
//
// Reine Funktionen -> in Node testbar.

(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.Kaufweg = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Der Weg, in der Reihenfolge, in der man ihn geht.
  const STUFEN = ["umsehen", "interessiert", "abwaegen", "warenkorb", "kasse", "gekauft"];

  // Was auf jeder Stufe hilft — und was dort schadet. Das Zweite ist wichtiger:
  // auf der falschen Stufe das Richtige zu sagen ist trotzdem falsch.
  const RAT = {
    umsehen: {
      hilft: "Orientierung geben. Fragen beantworten, nicht verkaufen.",
      schadet: "Ein Produkt aufdrängen, bevor klar ist, wonach überhaupt gesucht wird.",
    },
    interessiert: {
      hilft: "Konkret zu diesem Stück werden: Masse, Material, Lieferzeit, was dazu passt.",
      schadet: "Alternativen aufzählen, die von dem ablenken, was gerade gefällt.",
    },
    abwaegen: {
      hilft: "Beim Entscheiden helfen: den Unterschied zwischen den Stücken benennen, " +
        "die Bedenken ansprechen (passt es, hält es, kann ich es zurückgeben).",
      schadet: "Noch mehr Auswahl anbieten. Wer schwankt, braucht weniger Optionen, nicht mehr.",
    },
    warenkorb: {
      hilft: "Den letzten Zweifel ausräumen: Versandkosten, Lieferzeit, Rückgabe.",
      schadet: "Weitere Produkte vorschlagen. Der Korb ist gepackt.",
    },
    kasse: {
      hilft: "Nur noch, was den Abschluss blockiert: Zahlungsarten, Lieferadresse, Sicherheit.",
      schadet: "Irgendetwas anderes. Jede Ablenkung an der Kasse kostet den Kauf.",
    },
    gekauft: {
      hilft: "Bestätigen und sagen, was als Nächstes passiert (Lieferung, Bestätigungsmail).",
      schadet: "Sofort das nächste Produkt verkaufen wollen.",
    },
  };

  // Die Stufe ergibt sich aus der Seite (wo steht er?) und dem Verhalten
  // (was hat er schon getan?). Die Seite ist das stärkere Signal — wer an der
  // Kasse steht, ist an der Kasse, egal wie er sich vorher verhalten hat.
  function stufeAus(seitenTyp, verhalten, phase) {
    const v = verhalten || {};
    if (seitenTyp === "bestaetigung") return "gekauft";
    if (seitenTyp === "kasse") return "kasse";
    if (seitenTyp === "warenkorb") return "warenkorb";

    const gesehen = Array.isArray(v.gesehen) ? v.gesehen.length : 0;
    const produkte = Number(v.produkteGesehen) || 0;
    // Mehrere Produkte gesehen ODER sichtbares Zögern -> es wird abgewogen.
    if (produkte >= 2 || gesehen >= 2 || phase === "vergleicht" || phase === "zoegert") {
      return "abwaegen";
    }
    if (seitenTyp === "produkt") return "interessiert";
    return "umsehen";
  }

  function beurteile(seitenTyp, verhalten, phase) {
    const stufe = stufeAus(seitenTyp, verhalten, phase);
    return {
      stufe,
      nummer: STUFEN.indexOf(stufe),
      hilft: RAT[stufe].hilft,
      schadet: RAT[stufe].schadet,
    };
  }

  // Für den System-Prompt. Bewusst mit dem "schadet"-Teil: dem Agenten zu sagen,
  // was er gerade NICHT tun soll, wirkt stärker als noch ein Ratschlag mehr.
  function zusammenfassung(beurteilung) {
    const b = beurteilung || {};
    if (!b.stufe || !RAT[b.stufe]) return "";
    return `Wo der Besucher auf dem Weg steht (nur Hinweis, KEINE Anweisung): "${b.stufe}".\n` +
      `Hier hilft: ${b.hilft}\n` +
      `Hier schadet: ${b.schadet}`;
  }

  return { beurteile, zusammenfassung, stufeAus, STUFEN, RAT };
});
