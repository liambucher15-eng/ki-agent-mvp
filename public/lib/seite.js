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
