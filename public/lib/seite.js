/* ═══════════════════════════════════════════════════════════════════
   AuraChat — Verhalten, das start.html UND preis.html brauchen.
   Ausgelagert, als der Preis eine eigene Seite bekam. Alles, was nur
   die Startseite betrifft (Ablauf-Stepper, Charakter-Galerie), bleibt
   dort inline.
   ═══════════════════════════════════════════════════════════════════ */
  // Kopfzeile bekommt ab 24 px Scrollhoehe einen Grund, damit die Links beim
  // Durchscrollen nicht auf dem Bild verschwinden.
  //
  // Die Pruefung haengt NICHT nur am scroll-Ereignis. Wer die Seite bereits
  // gescrollt betritt, loest keines aus:
  //   - Aufruf mit Anker (start.html#charaktere) springt ohne scroll-Ereignis
  //   - Neu laden stellt die alte Scrollposition wieder her, meist NACH dem
  //     ersten Skriptlauf
  //   - Zurueck-Taste holt die Seite aus dem bfcache, ganz ohne load
  // In all diesen Faellen blieb data-gescrollt auf "nein", die Kopfzeile also
  // durchsichtig — und der Seiteninhalt lief sichtbar durch die Navigation.
  // Gemeldet an der Charakter-Galerie, wo eine Karte quer durch die Links lief.
  (function () {
    const kopf = document.getElementById("kopf");
    if (!kopf) return;
    const pruefe = () => kopf.setAttribute("data-gescrollt", window.scrollY > 24 ? "ja" : "nein");
    pruefe();
    window.addEventListener("scroll", pruefe, { passive: true });
    // load: nach der Wiederherstellung der Scrollposition.
    window.addEventListener("load", pruefe);
    // pageshow: deckt zusaetzlich den bfcache ab, wo load nicht noch einmal kommt.
    window.addEventListener("pageshow", pruefe);
  })();

  // Weiches Scrollen NUR bei Klick auf einen Ankerlink, nicht global per CSS.
  // Global gesetzt (html { scroll-behavior: smooth }) lief die Seite beim
  // Mausrad gemessen rueckwaerts: acht Impulse zu je 100 px ergaben -42 px
  // statt +800. Hier greift es nur beim Klick, das Rad bleibt unberuehrt.
  (function () {
    const sanft = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute("href").slice(1);
      const ziel = id && document.getElementById(id);
      if (!ziel) return;
      e.preventDefault();
      ziel.scrollIntoView({ behavior: sanft ? "smooth" : "auto", block: "start" });
      // Adresszeile mitfuehren, ohne einen zweiten Sprung auszuloesen.
      history.pushState(null, "", "#" + id);
    });
  })();

  // Preis: Umschalter Monat/Jahr und die Zeichen in der Vergleichstabelle.
  (function () {
    // Die Haken und Kreuze stehen nicht im Markup, sondern werden hier
    // gesetzt. Im Markup steht nur data-ja bzw. data-nein, das haelt die
    // Tabelle lesbar; elfmal dasselbe SVG von Hand waere kaum pflegbar.
    const zeichen = {
      ja: '<span class="ja"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>',
      nein: '<span class="nein"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg></span>'
    };
    document.querySelectorAll(".vergleich td[data-ja]").forEach((z) => {
      z.innerHTML = zeichen.ja;
      // Fuer Vorlesewerkzeuge: Das Zeichen allein sagt nichts.
      z.setAttribute("aria-label", "enthalten");
    });
    document.querySelectorAll(".vergleich td[data-nein]").forEach((z) => {
      z.innerHTML = zeichen.nein;
      z.setAttribute("aria-label", "nicht enthalten");
    });

    const knoepfe = [...document.querySelectorAll(".schalter button")];
    if (!knoepfe.length) return;
    const felder = [...document.querySelectorAll("[data-monat][data-jahr]")];
    const takte = [...document.querySelectorAll("[data-takt-text]")];

    const zeige = (takt) => {
      knoepfe.forEach((k) => k.setAttribute("aria-pressed", String(k.dataset.takt === takt)));
      felder.forEach((f) => { f.textContent = f.dataset[takt]; });
      takte.forEach((t) => {
        // Gratis behaelt seinen Hinweis, dort gibt es nichts zu rechnen.
        if (t.dataset.taktText === "fest") return;
        t.textContent = takt === "jahr" ? "jährlich abgerechnet" : "monatlich kündbar";
      });
      document.querySelectorAll(".plan-zahl small").forEach((s) => {
        s.textContent = takt === "jahr" ? "pro Monat, jährlich" : "pro Monat";
      });

      // WICHTIG: Auch die Kaufknöpfe umstellen, nicht nur die Zahlen.
      //
      // Vorher tauschte der Umschalter ausschliesslich Text. Wer "jährlich"
      // wählte, las CHF 66 und landete trotzdem im Monatsabo zu CHF 79 — eine
      // Falschabrechnung, die niemand vor der Belastung bemerkt hätte.
      //
      // Free bleibt aussen vor: Dort gibt es nichts abzurechnen, und der Knopf
      // führt direkt ins Onboarding statt an die Kasse.
      document.querySelectorAll('a[href*="kaufen="]').forEach((a) => {
        const url = new URL(a.getAttribute("href"), location.href);
        if (takt === "jahr") url.searchParams.set("takt", "jahr");
        else url.searchParams.delete("takt");
        // slice(1) statt einer Regex: Der fuehrende Schraegstrich aus new URL()
        // muss weg, damit der Link relativ bleibt wie im Markup.
        a.setAttribute("href", url.pathname.slice(1) + url.search);
      });
    };
    knoepfe.forEach((k) => k.addEventListener("click", () => zeige(k.dataset.takt)));
  })();

  // Auftritt: Bloecke mit der Klasse "auftritt" steigen beim ersten
  // Sichtbarwerden leicht auf. Einmalig, danach wird nicht mehr beobachtet:
  // Ein Block, der beim Zurueckscrollen erneut auftaucht, wirkt nervoes.
  (function () {
    const ziele = [...document.querySelectorAll(".auftritt")];
    if (!ziele.length) return;
    // Ohne Beobachter oder bei ausgeschalteter Bewegung gar nicht erst
    // verstecken.
    if (!window.IntersectionObserver ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Erst jetzt verstecken. Das Verstecken steht bewusst NICHT im
    // Stylesheet: Bricht das Skript vorher ab, bleibt der Inhalt sichtbar
    // und es fehlt nur die Bewegung.
    ziele.forEach((z) => { z.dataset.da = "nein"; });
    const beobachter = new IntersectionObserver((eintraege) => {
      eintraege.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.dataset.da = "ja";
        beobachter.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    ziele.forEach((z) => beobachter.observe(z));
  })();

  // FAQ: immer nur eine Antwort offen. Ohne das entsteht beim Durchklicken
  // eine sehr lange Liste, in der man die Frage zur Antwort nicht mehr sieht.
  (function () {
    const alle = [...document.querySelectorAll(".faq details")];
    alle.forEach((d) => d.addEventListener("toggle", () => {
      if (d.open) alle.forEach((a) => { if (a !== d) a.open = false; });
    }));
  })();

  // Welcher Plan: Regler-Rechner unter den Preiskarten.
  //
  // Er rechnet eine einzige Strecke: Besucher -> Gespraeche -> Antworten ->
  // Plan. Jeder Zwischenschritt steht sichtbar in der Tafel, weil das
  // Ergebnis sonst eine Behauptung waere wie jede andere.
  //
  // Die Grenzen sind KEINE Erfindung dieser Datei, sie stehen in
  // netlify/functions/lib/verbrauch.js (GRENZEN) und woertlich in der
  // Vergleichstabelle auf preis.html. Beim Aendern alle drei Stellen.
  //
  // Auch die Voreinstellung ist abgeleitet, nicht geraten: verbrauch.js
  // haelt fest, dass ein normaler Kleinbetrieb mit 5.000 Besuchern bei etwa
  // 250 bis 750 Antworten landet. 5.000 x 2,5 % x 4 = 500 trifft die Mitte.
  (function () {
    const bereich = document.getElementById("welcher-plan");
    if (!bereich) return;

    const rBesucher = document.getElementById("reglerBesucher");
    const rAnteil = document.getElementById("reglerAnteil");
    if (!rBesucher || !rAnteil) return;

    const ANTWORTEN_JE_GESPRAECH = 4;

    // Free wird NIE empfohlen, auch wenn das Kontingent rechnerisch reicht.
    //
    // Free ist zum Ausprobieren da, nicht zum Betreiben. Bei 2,5 % Schreibenden
    // deckt es Seiten bis rund 1'500 Besucher im Monat — das ist fuer viele
    // Kleinbetriebe die Dauerloesung, und dann zahlt niemand je etwas. Jede
    // Free-Antwort kostet ausserdem echtes Geld (Haiku 4.5, rund CHF 0,004 je
    // Antwort), das Kontingent von 150 also bis zu CHF 0.54 im Monat.
    //
    // Der Rechner verschweigt Free trotzdem nicht — es steht als Karte oben auf
    // derselben Seite, und es wegzulassen waere unehrlich. Stattdessen wird es
    // benannt und eingeordnet: reicht rechnerisch, ist aber der Probelauf.
    const KLEINSTER_BEZAHLTER = 1;   // Platz von "Start" in PLAENE

    // Reihenfolge ist Teil der Logik: gesucht wird der ERSTE Plan, der
    // reicht. Darum aufsteigend.
    const PLAENE = [
      { id: "free",  name: "Free",  grenze: 150,   monat: "CHF 0",   jahr: "CHF 0",
        ziel: "onboarding-aura.html?plan=free", knopf: "Gratis anfangen" },
      { id: "start", name: "Start", grenze: 3000,  monat: "CHF 29",  jahr: "CHF 24",
        ziel: "dashboard.html?kaufen=start", knopf: "Start wählen" },
      { id: "grow",  name: "Grow",  grenze: 12000, monat: "CHF 79",  jahr: "CHF 66",
        ziel: "dashboard.html?kaufen=grow", knopf: "Grow wählen" },
      { id: "scale", name: "Scale", grenze: 25000, monat: "CHF 199", jahr: "CHF 166",
        ziel: "dashboard.html?kaufen=scale", knopf: "Scale anfragen" }
    ];

    // Schweizer Schreibweise mit hohem Apostroph, wie ueberall sonst auf der
    // Seite. Intl liefert je nach Browsersprache einen anderen Trenner,
    // deshalb von Hand.
    const zahl = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "’");
    // toFixed(1) waere zu streng: Es schrieb "6,0 %" statt "6 %". Die
    // Nachkommastelle steht nur da, wenn es eine gibt.
    const prozent = (p) => {
      const g = Math.round(p * 10) / 10;
      return (Number.isInteger(g) ? String(g) : g.toFixed(1).replace(".", ",")) + " %";
    };

    // Besucher stecken NICHT direkt im Regler, sondern in seiner Position.
    // Linear waere die Skala unbrauchbar: Zwischen 200 und 200'000 liegen
    // drei Groessenordnungen, und die meisten Betriebe sitzen in der
    // untersten. Eine geometrische Kurve gibt jeder Groessenordnung gleich
    // viel Weg.
    const BESUCHER_MIN = 200;
    const BESUCHER_MAX = 200000;
    const SCHRITTE = Number(rBesucher.max) || 240;
    function besucherAus(position) {
      const roh = BESUCHER_MIN * Math.pow(BESUCHER_MAX / BESUCHER_MIN, position / SCHRITTE);
      // Auf glatte Zahlen runden, sonst steht im Ergebnis "5’024 Besucher"
      // und die Rechnung wirkt genauer, als sie ist.
      const stufe = roh < 1000 ? 50 : roh < 10000 ? 100 : roh < 50000 ? 500 : 1000;
      return Math.round(roh / stufe) * stufe;
    }

    // Der Umschalter Monat/Jahr steht weiter oben auf der Seite und gehoert
    // ihm, nicht diesem Rechner. Hier wird er nur GELESEN. Die Preiszelle
    // traegt data-monat und data-jahr, damit der bestehende Umschalter sie
    // beim Klick von selbst mitnimmt — dieses Skript haelt die beiden
    // Attribute nur aktuell.
    const taktJetzt = () => {
      const an = document.querySelector('.schalter button[aria-pressed="true"]');
      return an && an.dataset.takt === "jahr" ? "jahr" : "monat";
    };

    const wertBesucher = document.getElementById("wertBesucher");
    const wertAnteil = document.getElementById("wertAnteil");
    const zeileBesucher = document.getElementById("zeileBesucher");
    const zeileAnteil = document.getElementById("zeileAnteil");
    const zeileGespraeche = document.getElementById("zeileGespraeche");
    const zeileAntworten = document.getElementById("zeileAntworten");
    const ergebnisPlan = document.getElementById("ergebnisPlan");
    const ergebnisPreis = document.getElementById("ergebnisPreis");
    const ergebnisGrund = document.getElementById("ergebnisGrund");
    const ergebnisKnopf = document.getElementById("ergebnisKnopf");

    // Der gefuellte Teil der Bahn laesst sich nur ueber eine Variable
    // faerben: ::-webkit-slider-runnable-track und ::-moz-range-track sind
    // getrennte Regeln, eine gemeinsame Schreibweise gibt es nicht.
    function fuelle(regler) {
      const min = Number(regler.min), max = Number(regler.max);
      const anteil = (Number(regler.value) - min) / (max - min);
      regler.style.setProperty("--fuell", (anteil * 100).toFixed(2) + "%");
    }

    function rechne() {
      const besucher = besucherAus(Number(rBesucher.value));
      const anteil = Number(rAnteil.value) / 10;          // 25 -> 2,5 %
      const gespraeche = Math.round(besucher * anteil / 100);
      const antworten = gespraeche * ANTWORTEN_JE_GESPRAECH;

      fuelle(rBesucher);
      fuelle(rAnteil);

      // Der Regler zaehlt Schritte, nicht Besucher. Ohne valuetext meldet
      // ein Vorlesewerkzeug "112 von 240" — eine Zahl, die niemandem etwas
      // sagt. Mit valuetext meldet es "5’000 Besucher im Monat".
      rBesucher.setAttribute("aria-valuetext", zahl(besucher) + " Besucher im Monat");
      rAnteil.setAttribute("aria-valuetext", prozent(anteil) + " der Besucher");

      wertBesucher.textContent = zahl(besucher);
      wertAnteil.textContent = prozent(anteil);
      zeileBesucher.textContent = zahl(besucher);
      zeileAnteil.textContent = prozent(anteil);
      zeileGespraeche.textContent = zahl(gespraeche) + (gespraeche === 1 ? " Gespräch" : " Gespräche");
      zeileAntworten.textContent = zahl(antworten) + " Antworten";

      const passt = PLAENE.findIndex((p) => antworten <= p.grenze);
      const drueber = passt === -1;              // mehr als der groesste Plan
      // Unter Start wird nicht empfohlen, siehe Begruendung oben.
      const nr = drueber ? PLAENE.length - 1 : Math.max(passt, KLEINSTER_BEZAHLTER);
      const plan = PLAENE[nr];
      const freeWuerdeReichen = passt === 0;

      ergebnisPlan.textContent = plan.name;
      ergebnisPreis.dataset.monat = plan.monat;
      ergebnisPreis.dataset.jahr = plan.jahr;
      const takt = taktJetzt();
      ergebnisPreis.textContent = plan[takt];

      if (drueber) {
        // Ehrlich bleiben: Ueber 25'000 reicht kein Plan mehr, und so
        // etwas verkauft man nicht per Schieberegler.
        ergebnisGrund.textContent =
          "Über " + zahl(PLAENE[PLAENE.length - 1].grenze) + " Antworten im Monat. Scale ist der grösste Plan — für mehr sprechen wir persönlich.";
      } else if (freeWuerdeReichen) {
        // Ehrlich benennen, statt Free zu verschweigen ODER es zu empfehlen.
        ergebnisGrund.textContent =
          "Free deckt " + zahl(PLAENE[0].grenze) + " Antworten und würde rechnerisch reichen — zum Ausprobieren. " +
          "Für den Dauerbetrieb ist Start der kleinste Plan.";
      } else {
        const kleiner = PLAENE[nr - 1];
        ergebnisGrund.textContent =
          plan.name + " deckt " + zahl(plan.grenze) + " Antworten im Monat. " +
          kleiner.name + " deckt " + zahl(kleiner.grenze) + " — das wäre zu knapp.";
      }

      ergebnisKnopf.textContent = plan.knopf;
      // Den Abrechnungstakt mitgeben, sonst laege der Preis in der Tafel
      // neben dem, was an der Kasse steht. Free geht nicht an die Kasse und
      // braucht ihn nicht.
      ergebnisKnopf.setAttribute(
        "href",
        plan.ziel + (takt === "jahr" && plan.id !== "free" ? "&takt=jahr" : "")
      );
      ergebnisKnopf.setAttribute("aria-label", plan.knopf + ", " + plan[takt] + " pro Monat");
    }

    rBesucher.addEventListener("input", rechne);
    rAnteil.addEventListener("input", rechne);
    // Auf den Umschalter reagieren: Er aendert Preis UND Kassenlink. Der
    // eigene Klickzaehler laeuft nach dem bestehenden Umschalter, weil
    // dieser Block spaeter registriert wird.
    document.querySelectorAll(".schalter button").forEach((k) => k.addEventListener("click", rechne));
    rechne();
  })();
