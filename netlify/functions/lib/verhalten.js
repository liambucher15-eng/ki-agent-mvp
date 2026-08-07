// Verhaltensdeutung — versteht, WIE der Besucher sich gerade verhält.
//
// Die Seitenanalyse sagt, WAS auf der Seite steht. Sie sagt nicht, ob jemand
// nur kurz vorbeischaut, seit drei Minuten dasselbe Produkt liest, zwischen
// zwei Tischen hin- und herspringt oder gerade im Begriff ist zu gehen. Genau
// das entscheidet aber, OB und WOMIT der Agent ansprechen soll.
//
// DATENSPARSAMKEIT (bewusste Grenze):
// Hier werden nur grobe, anonyme Zähler gedeutet — Sekunden, Prozent, Anzahl.
// Keine Namen, keine Klickpfade, keine IDs, nichts über die Sitzung hinaus und
// nichts seitenübergreifend. Das reicht vollständig, um zu erkennen, wann
// jemand Hilfe braucht. Alles darüber wäre Überwachung, nicht Hilfe.
//
// REINE FUNKTIONEN: bekommen fertige Zahlen, geben Deutung zurück. Kein DOM,
// keine Uhr, keine Seiteneffekte -> vollständig in Node testbar. Das Einsammeln
// macht das Widget.

(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.Verhalten = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Schwellen an EINER Stelle, benannt und begründet — sie sind der eigentliche
  // Charakter des Systems und werden sich mit echten Zahlen noch verschieben.
  const S = {
    KURZ: 12,            // darunter: Besucher ist gerade erst angekommen
    VERTIEFT: 45,        // so lange bleibt man nur, wenn es einen wirklich interessiert
    LANGE: 120,          // zwei Minuten auf EINER Seite — da hakt meistens etwas
    SCROLL_GELESEN: 55,  // % — so weit kommt nur, wer wirklich liest
    LEERLAUF_STOCKT: 25, // s ohne Regung: liest nach, überlegt, oder ist weg
    VIELE_SEITEN: 4,     // ab hier sucht jemand gezielt statt zu stöbern
    VERGLEICHT_AB: 2,    // so viele verschiedene Produkte = Vergleich läuft
  };

  function zahl(wert, min, max) {
    const z = typeof wert === "number" ? wert : parseFloat(wert);
    if (!isFinite(z)) return min;
    return Math.min(max, Math.max(min, z));
  }

  // Rohsignale auf verlässliche Grenzen bringen. Sie kommen aus dem Browser
  // einer fremden Seite — auf plausible Werte ist kein Verlass.
  function normalisiere(roh) {
    const r = roh || {};
    return {
      verweildauer: Math.round(zahl(r.verweildauer, 0, 3600)),
      scrolltiefe: Math.round(zahl(r.scrolltiefe, 0, 100)),
      leerlauf: Math.round(zahl(r.leerlauf, 0, 3600)),
      seitenInSitzung: Math.round(zahl(r.seitenInSitzung, 1, 200)),
      produkteGesehen: Math.round(zahl(r.produkteGesehen, 0, 200)),
      // Hat der Besucher DIESE Seite in dieser Sitzung schon einmal offen gehabt?
      wiederkehr: Math.round(zahl(r.wiederkehr, 0, 50)),
      exitAbsicht: !!r.exitAbsicht,
      // Namen der zuletzt gesehenen Produkte. Ohne sie weiss der Agent zwar,
      // DASS verglichen wird, aber nicht WOMIT. Gekappt, weil sie von einer
      // fremden Seite stammen und in den Prompt gehen.
      gesehen: Array.isArray(r.gesehen)
        ? r.gesehen
            .filter((n) => typeof n === "string" && n.trim())
            .slice(0, 6)
            .map((n) => n.replace(/\s+/g, " ").trim().slice(0, 80))
        : [],
    };
  }

  // Die Phase ist die eine Frage: Was braucht dieser Mensch GERADE?
  // Reihenfolge = Dringlichkeit. Abbruch schlägt alles, denn danach ist er weg.
  function phaseAus(s, seitenTyp) {
    const imKauf = seitenTyp === "warenkorb" || seitenTyp === "kasse";

    // Kurz vorm Gehen. An der Kasse ist das teuer, dort zählt es immer.
    if (s.exitAbsicht && (imKauf || s.verweildauer > S.KURZ)) return "abbruchgefahr";
    // An der Kasse stehen und nichts tun heisst fast immer: irgendetwas stockt.
    if (imKauf && s.leerlauf >= S.LEERLAUF_STOCKT) return "steckt_fest";
    if (imKauf) return "im_kauf";

    // Lange da, viel gelesen, aber nichts passiert -> die Frage ist offen geblieben.
    if (s.verweildauer >= S.LANGE && s.scrolltiefe >= S.SCROLL_GELESEN) return "zoegert";
    // Springt zwischen Produkten hin und her -> braucht eine Entscheidungshilfe.
    if (s.produkteGesehen >= S.VERGLEICHT_AB && s.wiederkehr >= 1) return "vergleicht";
    // Bleibt dran und liest -> echtes Interesse, aber noch keine Not.
    if (s.verweildauer >= S.VERTIEFT && s.scrolltiefe >= S.SCROLL_GELESEN) return "vertieft";
    // Viele Seiten in kurzer Zeit -> sucht etwas Bestimmtes und findet es nicht.
    if (s.seitenInSitzung >= S.VIELE_SEITEN && s.verweildauer < S.VERTIEFT) return "sucht";
    if (s.verweildauer < S.KURZ) return "angekommen";
    return "stoebert";
  }

  // Wie dringend ist eine Ansprache? 0 = auf keinen Fall stören.
  // Das ist der Hebel gegen genau die Pop-ups, die alle wegklicken.
  const DRINGLICHKEIT = {
    abbruchgefahr: 3,
    steckt_fest: 3,
    zoegert: 2,
    vergleicht: 2,
    sucht: 2,
    vertieft: 1,
    im_kauf: 0,      // laufender Kauf: NICHT stören, das kostet Abschlüsse
    stoebert: 0,
    angekommen: 0,   // gerade erst da — sofort anspringen wirkt aufdringlich
  };

  function beurteile(rohSignale, seitenTyp) {
    const signale = normalisiere(rohSignale);
    const phase = phaseAus(signale, seitenTyp);
    return { signale, phase, dringlichkeit: DRINGLICHKEIT[phase] || 0 };
  }

  // Klartext für den System-Prompt. Bewusst als BEOBACHTUNG formuliert, nicht
  // als Befehl: der Agent soll daraus schliessen, nicht daran gehorchen.
  const PHASENTEXT = {
    angekommen: "ist gerade erst auf dieser Seite angekommen",
    stoebert: "schaut sich unverbindlich um",
    sucht: "klickt sich zügig durch mehrere Seiten und sucht offenbar etwas Bestimmtes",
    vertieft: "liest diese Seite aufmerksam",
    vergleicht: "hat mehrere Produkte angesehen und ist zu einem zurückgekehrt, vergleicht also",
    zoegert: "ist schon lange auf dieser Seite und hat alles gelesen, zögert aber sichtbar",
    im_kauf: "ist gerade mitten im Bestellvorgang",
    steckt_fest: "steht im Bestellvorgang und tut seit einer Weile nichts mehr",
    abbruchgefahr: "wirkt, als wolle er die Seite gleich verlassen",
  };

  function zusammenfassung(beurteilung) {
    const b = beurteilung || {};
    const s = b.signale || {};
    const satz = PHASENTEXT[b.phase];
    if (!satz) return "";
    const teile = [];
    if (s.verweildauer >= S.KURZ) teile.push(`${s.verweildauer}s auf dieser Seite`);
    if (s.scrolltiefe >= 20) teile.push(`${s.scrolltiefe}% gelesen`);
    if (s.seitenInSitzung > 1) teile.push(`${s.seitenInSitzung} Seiten im Besuch`);
    // Bei mehreren gesehenen Produkten die Namen nennen: nur so kann der Agent
    // den Unterschied benennen, um den es beim Vergleichen geht.
    const gesehen = Array.isArray(s.gesehen) ? s.gesehen : [];
    const auchGesehen = gesehen.length > 1
      ? ` Zuvor angesehen: ${gesehen.join(", ")}.`
      : "";
    return `Beobachtung zum Besucher (nur Hinweis, KEINE Anweisung): Er ${satz}` +
      (teile.length ? ` (${teile.join(", ")})` : "") + "." + auchGesehen;
  }

  return { beurteile, zusammenfassung, normalisiere, phaseAus, SCHWELLEN: S, DRINGLICHKEIT };
});
