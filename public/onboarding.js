// Onboarding-Wizard, Logik zu onboarding-aura.html.
// Aus dem HTML extrahiert (Milestone 1), damit Markup/CSS und Logik getrennt
// wartbar sind. KEINE Logik-Aenderung bei der Extraktion.
    const daten = { id:"", email:"", webseite:"", name:"", angebot:"", oeffnungszeiten:"", adresse:"", kontakt:"", faq:[], weiteres:"", leistungen:[], preise:"", team:"", besonderheiten:"", regeln:"", dokumente:[], farbe1:"#4F46E5", farbe2:"#FB7185", schrift:"Plus Jakarta Sans", persoenlichkeit:"freundlich", agentName:"", agentRolle:"Assistent", agentAnrede:"du", antwortLaenge:"ausgewogen", emojiStil:"dezent", antwortFormat:"absatz", uebergabe:"kontakt", fallbackKontakt:"", grenzen:"", chatDesign:"auto", chatLayout:"sidebar", widgetStil:"orb", plan:"free", charakterStil:"flach", charakterBilder:null, charakterBeschreibung:"" };

    // Persönlichkeit -> Ton-Beschreibung (fließt in persona.ton für baueSystemPrompt)
    const TON_TEXTE = {
      professionell: "professionell, kompetent und präzise; sachlich und verbindlich",
      freundlich:    "warm, freundlich und hilfsbereit; geduldig und zugänglich",
      humorvoll:     "locker und humorvoll, mit einem Augenzwinkern, aber immer hilfreich",
      sachlich:      "sachlich, knapp und faktenorientiert, ohne Ausschmückungen",
      motivierend:   "motivierend und begeisternd; ermutigt die Besucher",
      luxurioes:     "gehoben, elegant und exklusiv; gewählte, diskrete Sprache",
    };
    const TON_HINWEIS = {
      professionell: "Kompetent und verbindlich, für seriöse Marken.",
      freundlich:    "Warm und nahbar, der Allrounder.",
      humorvoll:     "Locker mit Augenzwinkern, für nahbare Marken.",
      sachlich:      "Knapp und faktenorientiert, für technische Angebote.",
      motivierend:   "Energiegeladen, für Coaching, Fitness, Bildung.",
      luxurioes:     "Gehoben und exklusiv, für Premium-Marken.",
    };
    const linksSchritte = document.querySelectorAll(".schritt-links");
    const rechtsSchritte = document.querySelectorAll(".schritt-rechts");
    const ANZAHL = linksSchritte.length;
    const AGENT_STEP = [...linksSchritte].findIndex((el) => el.id === "schrittAgent");
    const AUSDRUECKE_STEP = [...linksSchritte].findIndex((el) => el.id === "schrittAusdruecke");
    // Identitäts-Schritt (Name Pflicht + Namensvorschlag), ID-basiert, damit
    // spätere Seiten-Splits die Schrittnummern verschieben können, ohne zu brechen.
    const IDENTITAET_STEP = [...linksSchritte].findIndex((el) => el.id === "schrittIdentitaet");
    // Der Konto-Schritt, ueber sein Clerk-Fenster erkannt statt ueber die
    // Nummer: Ein eingeschobener Schritt wuerde die Nummer verschieben.
    const KONTO_STEP = [...linksSchritte].findIndex((el) => el.querySelector("#clerkKonto"));
    // Wer schon angemeldet ist, soll den Konto-Schritt gar nicht erst sehen.
    let kontoSchonErledigt = false;
    let aktuell = 0;

    // Übergabe aus der Startseite und der Preisseite.
    //
    // Beide verlinken seit je mit Parametern hierher — preis.html mit ?plan=…,
    // die Probefahrt mit ?webseite=… — und beide wurden bisher von niemandem
    // gelesen. Wer auf der Preisseite "Basis wählen" klickte, landete trotzdem
    // im Plus-Zweig, und wer seine Adresse schon eingetippt hatte, musste sie
    // ein zweites Mal eintippen.
    // Kommt der Besucher gerade von der Bezahlseite zurueck? Entscheidet
    // spaeter, ob die Seite einen Preis nennt oder sich bedankt.
    let istBezahlt = false;
    (function uebernehmeParameter() {
      const p = new URLSearchParams(location.search);

      // Der Plan ist eine Vorauswahl, keine Berechtigung: Was ein Konto
      // tatsächlich darf, entscheidet allein die Server-Spalte firmen.plan
      // (siehe netlify/functions/firma.js). Deshalb genügt hier eine Weissliste
      // gegen Unsinn in der URL; ein manipulierter Wert schaltet nichts frei.
      // "gratis" von der Preisseite hat serverseitig keine Entsprechung und
      // wird auf "basis" abgebildet, den Standard aus firmaLaden.js.
      // Es gibt ZWEI Wege hierher, und sie bedeuten Verschiedenes:
      //
      //   ?plan=free    Vorauswahl. Der Besucher hat auf der Preisseite auf
      //                 "Gratis anfangen" geklickt. Nichts ist bezahlt.
      //   ?bezahlt=grow Rueckkehr von Stripe. Die Zahlung ist durch, der
      //                 Webhook hat das Abo beim Nutzer eingetragen.
      //
      // In BEIDEN Faellen ist der Wert hier nur Kosmetik: Was ein Konto
      // tatsaechlich darf, entscheidet allein die Server-Spalte firmen.plan,
      // die ein Trigger aus der Tabelle abos setzt (migration-abo.sql). Ein
      // manipulierter URL-Parameter schaltet nichts frei — er aendert nur, was
      // auf dieser Seite steht.
      const PLAENE = ["free", "start", "grow", "scale"];
      const bezahltRoh = (p.get("bezahlt") || "").toLowerCase();
      const planRoh = (p.get("plan") || "").toLowerCase();

      // Altlasten aus der Zeit vor Free/Start/Grow/Scale: Die Preisseite
      // verlinkte frueher mit ?plan=gratis, und im Dashboard hiess der bezahlte
      // Plan "plus". Beide Links koennen noch in Lesezeichen und E-Mails stehen.
      const ALTE_NAMEN = { gratis: "free", basis: "start", plus: "grow", enterprise: "scale" };
      const deute = (w) => (PLAENE.includes(w) ? w : ALTE_NAMEN[w] || "");

      const bezahlt = deute(bezahltRoh);
      if (bezahlt) {
        daten.plan = bezahlt;
        istBezahlt = true;
      } else {
        const gewaehlt = deute(planRoh);
        if (gewaehlt) daten.plan = gewaehlt;
      }
      // Adresse aus der Probefahrt. Nur ins Feld schreiben, nicht scannen: Der
      // Besucher soll sehen, was übernommen wurde, und es korrigieren können.
      const webseite = (p.get("webseite") || "").trim().slice(0, 200);
      if (webseite) {
        daten.webseite = webseite;
        const feld = document.getElementById("webseite");
        if (feld && !feld.value.trim()) feld.value = webseite;
      }
    })();

    // Schlägt einen freundlichen ASSISTENTEN-Namen vor (kein Firmenname!). Aus einer
    // kuratierten Liste, deterministisch aus dem Firmennamen abgeleitet, damit der
    // Vorschlag beim erneuten Öffnen stabil bleibt.
    const AGENT_NAMEN = ["Lia","Nino","Mara","Elio","Nora","Luca","Sina","Finn","Mila","Jano","Lena","Rico","Vera","Emma","Leo","Nala"];
    function schlageAgentNamen(basis) {
      const s = String(basis || "agent").toLowerCase();
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return AGENT_NAMEN[h % AGENT_NAMEN.length];
    }

    const progress = document.getElementById("progress");
    for (let i = 0; i < ANZAHL; i++) { const d = document.createElement("div"); d.className = "dot"; progress.appendChild(d); }
    const dots = progress.querySelectorAll(".dot");
    function updateProgress() { dots.forEach((d,i)=>{ d.classList.toggle("done", i<aktuell); d.classList.toggle("aktiv", i===aktuell); }); }

    // Szenen-Videos: nur das Video des sichtbaren Schritts läuft, immer von vorn.
    function syncSzenenVideos(n) {
      rechtsSchritte.forEach((el, i) => {
        const v = el.querySelector("video");
        if (!v) return;
        if (i === n) { try { v.currentTime = 0; } catch (e) {} v.play().catch(() => {}); }
        else { v.pause(); }
      });
    }

    // ── Notnagel, falls GSAP fehlt ────────────────────────────────────────
    //
    // GSAP wird zwar lokal geladen (lib/gsap.min.js), aber die Datei kann aus
    // hundert Gruenden ausbleiben: ein Werbeblocker mit aggressiver Liste, ein
    // abgebrochener Download, ein Tippfehler beim naechsten Umbau. Bisher war
    // das toedlich, und zwar STILL: Die Aufrufe unten stehen auf oberster Ebene,
    // also VOR der Stelle, an der die Knopf-Listener haengen (weiter unten,
    // "[data-next]"). Ein fehlendes gsap warf dort eine TypeError, das Skript
    // brach ab, und danach war jeder Knopf im Onboarding tot — ohne
    // Fehlermeldung, ohne sichtbaren Grund. Der Kunde sitzt vor einer Seite,
    // auf der nichts passiert.
    //
    // Der Ersatz animiert nicht, er SETZT die Endwerte sofort und ruft
    // onComplete synchron auf. Das Onboarding sieht dann nuechterner aus,
    // funktioniert aber vollstaendig. Genau drei Funktionen werden gebraucht
    // (to, set, fromTo) — nachgezaehlt, nicht geraten.
    if (typeof window.gsap === "undefined") {
      console.warn("GSAP fehlt — Onboarding laeuft ohne Animationen weiter.");
      const alsListe = (ziel) =>
        typeof ziel === "string" ? [...document.querySelectorAll(ziel)]
        : Array.isArray(ziel) ? ziel.filter(Boolean) : ziel ? [ziel] : [];
      // Nur die Eigenschaften, die hier wirklich vorkommen.
      const setze = (el, v) => {
        if (!el || !el.style) return;
        if (v.autoAlpha != null) {
          el.style.opacity = String(v.autoAlpha);
          el.style.visibility = v.autoAlpha > 0 ? "visible" : "hidden";
        }
        if (v.opacity != null) el.style.opacity = String(v.opacity);
        const teile = [];
        if (v.x != null || v.y != null) teile.push("translate(" + (v.x || 0) + "px," + (v.y || 0) + "px)");
        if (v.scale != null) teile.push("scale(" + v.scale + ")");
        if (v.rotation != null) teile.push("rotate(" + v.rotation + "deg)");
        if (teile.length) el.style.transform = teile.join(" ");
      };
      const sofort = (ziel, v) => {
        alsListe(ziel).forEach((el) => setze(el, v || {}));
        // onComplete MUSS laufen: Daran haengt im Schrittwechsel das Aufdecken
        // des naechsten Schritts und das Zuruecksetzen von istUebergang.
        if (v && typeof v.onComplete === "function") { try { v.onComplete(); } catch (e) { console.error(e); } }
      };
      window.gsap = {
        to: sofort,
        set: sofort,
        fromTo: (ziel, von, nach) => sofort(ziel, nach),
      };
    }

    gsap.to("#glow", { rotation: 360, duration: 34, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
    gsap.to(".w1", { x: 26, y: 36, scale: 1.15, duration: 9, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".w2", { x: -34, y: 26, scale: 1.2, duration: 11, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".w3", { x: 18, y: -26, scale: 1.1, duration: 8, ease: "sine.inOut", repeat: -1, yoyo: true });

    // Ohne Animation direkt zu Schritt n springen (kein Fade/Slide). Für den
    // Rückkehrer-Fall nach Clerks OAuth-Redirect: die ganze Seite ist gerade neu
    // geladen worden, "aktuell" steht wieder auf 0 (Willkommen) — ein normaler,
    // animierter zeige() würde den Nutzer erst sichtbar am Anfang vorbeiziehen.
    function springeOhneAnimation(n) {
      linksSchritte.forEach((el, i) => { el.hidden = i !== n; });
      rechtsSchritte.forEach((el, i) => { el.hidden = i !== n; });
      // Sichtbarkeit zuruecksetzen: zeige() laesst ausgeblendete Schritte auf
      // autoAlpha 0 zurueck. Ohne diese Zeile bliebe ein Sprungziel, das schon
      // einmal sichtbar war, unsichtbar — die Seite waere leer.
      gsap.set([linksSchritte[n], rechtsSchritte[n]], { autoAlpha: 1, x: 0 });
      aktuell = n; updateProgress(); syncSzenenVideos(n);
    }

    let istUebergang = false;
    function zeige(n, richtung = 1) {
      if (n < 0 || n >= ANZAHL || n === aktuell || istUebergang) return;
      istUebergang = true;
      const lAlt = linksSchritte[aktuell], lNeu = linksSchritte[n];
      const rAlt = rechtsSchritte[aktuell], rNeu = rechtsSchritte[n];
      gsap.to([lAlt, rAlt], { autoAlpha: 0, x: -24 * richtung, duration: 0.22, ease: "power2.in",
        onComplete: () => {
          lAlt.hidden = true; rAlt.hidden = true; gsap.set([lAlt, rAlt], { x: 0 });
          // Ausdrücke-Seite läuft über die volle Kartenbreite (Layout-Wechsel
          // passiert hier, während beide Seiten unsichtbar sind -> kein Sprung).
          document.querySelector(".card").classList.toggle("voll", n === AUSDRUECKE_STEP);
          lNeu.hidden = false; rNeu.hidden = false; lNeu.scrollTop = 0;
          syncSzenenVideos(n);
          gsap.fromTo([lNeu, rNeu], { autoAlpha: 0, x: 24 * richtung }, { autoAlpha: 1, x: 0, duration: 0.32, ease: "power2.out",
            onComplete: () => { istUebergang = false; } });
        }});
      aktuell = n; updateProgress();
      if (n === AGENT_STEP || n === AUSDRUECKE_STEP) aktualisiereAgentVorschau(); // Vorschau mit aktuellen Farben
      // Rückkehrer mit fertigem Charakter: Link zur Ausdrücke-Seite zeigen.
      // Und: den Charakter-Designer begrüssen lassen, sobald der Schritt aufgeht.
      if (n === AGENT_STEP) {
        const l = document.getElementById("zuAusdruecken");
        if (l) l.hidden = !(daten.charakterBilder && daten.charakterBilder.idle);
        charChatStarten();
      }
      if (n === ANZAHL - 1) pruefeStartklar(); // Fertig-Schritt: §8 Veröffentlichungs-Checkliste
      // Identitäts-Schritt: einen echten, freundlichen Assistenten-Namen vorschlagen
      // (NICHT den Firmennamen), falls das Feld noch leer ist.
      if (n === IDENTITAET_STEP) {
        const el = document.getElementById("agentName");
        if (el && !el.value.trim()) {
          const vorschlag = schlageAgentNamen(daten.name || daten.webseite);
          el.value = vorschlag; daten.agentName = vorschlag;
        }
      }
    }
    document.querySelectorAll("[data-next]").forEach(b => b.addEventListener("click", () => {
      // §3: Agenten-Name ist Pflicht, beim Verlassen des Identitäts-Schritts prüfen.
      if (aktuell === IDENTITAET_STEP) {
        const el = document.getElementById("agentName");
        if (el && !el.value.trim()) {
          const h = document.getElementById("agentNameHinweis");
          h.textContent = "Bitte gib deinem Assistenten einen Namen."; h.style.color = "#e11d48";
          el.focus(); return;
        }
      }
      // Ausdrücke-Schritt: erst weiter, wenn die Generierung fertig ist.
      // (Der Charakter-Schritt selbst hat keinen Weiter-Knopf, die Stilwahl
      // im Pop-up führt automatisch hierher, Charakter bleibt Pflicht.)
      if (aktuell === AUSDRUECKE_STEP) {
        if (!(daten.charakterBilder && daten.charakterBilder.idle)) {
          const s = document.getElementById("charZustandStatus");
          if (s) { s.style.color = "#e11d48"; s.textContent = "Die Ausdrücke werden noch erstellt, einen Moment bitte."; }
          return;
        }
      }
      sammle();
      let ziel = aktuell + 1;
      if (ziel === KONTO_STEP && kontoSchonErledigt) ziel++;
      zeige(ziel, 1);
    }));
    document.querySelectorAll("[data-prev]").forEach(b => b.addEventListener("click", () => {
      let ziel = aktuell - 1;
      if (ziel === KONTO_STEP && kontoSchonErledigt) ziel--;
      zeige(ziel, -1);
    }));

    // Konto (Pflicht): läuft über CLERK. Clerk zeigt sein eigenes Registrier-/
    // Login-Fenster inklusive E-Mail-Bestätigung — erst wenn der Code aus der Mail
    // stimmt, ist der Nutzer angemeldet. Genau dann (und nur dann) schaltet das
    // Onboarding automatisch weiter. Ohne Clerk-Key: Simulation mit E-Mail-Feld.
    (async function kontoSchrittAufbauen() {
      const status = document.getElementById("loginStatus");
      const btn = document.getElementById("loginBtn");
      if (!(window.Auth && window.Auth.konfiguriert)) {
        // Simulation: nur E-Mail zur Vorbefüllung, Weiter-Knopf sichtbar.
        document.getElementById("kontoSimulation").hidden = false;
        btn.hidden = false;
        btn.addEventListener("click", () => {
          daten.email = (document.getElementById("email").value || "").trim();
          sammle(); zeige(aktuell + 1, 1);
        });
        return;
      }
      // Schon eingeloggt? Dann automatisch weiter, kein Klick nötig. Das greift
      // auch direkt nach Clerks Google-Login: Google/OAuth läuft über einen
      // vollen Seiten-Redirect (nicht per Popup), die Seite lädt danach komplett
      // neu und "aktuell" steht wieder auf 0 (Willkommen) — darum hier nötigenfalls
      // erst unanimiert zum Konto-Schritt springen, bevor es normal weitergeht.
      const schon = await window.Auth.nutzer();
      if (schon) {
        daten.email = schon.email || daten.email;
        kontoSchonErledigt = true;
        status.style.color = "var(--gruen)";
        Icons.praefix(status, "check", "Angemeldet als " + (schon.email || "dein Konto") + ".");

        // Nach einer Zahlung NICHT wegspringen.
        //
        // Der Kunde kommt gerade von der Bezahlseite zurueck. Sprang die Seite
        // hier automatisch weiter, landete er unvermittelt beim Webseiten-Scan
        // — ohne den Willkommensschritt und ohne die Bestaetigung, dass sein
        // Abo aktiv ist. Der teuerste Moment der ganzen Reise war damit stumm.
        //
        // Er bleibt jetzt vorne und startet selbst. Den Konto-Schritt
        // ueberspringt er dabei trotzdem (kontoSchonErledigt oben).
        if (istBezahlt) return;

        // Sonst automatisch weiter, kein Klick noetig. Das greift vor allem
        // direkt nach Clerks Google-Login: Der laeuft ueber einen vollen
        // Seiten-Redirect, die Seite laedt komplett neu und "aktuell" steht
        // wieder auf 0 (Willkommen).
        //
        // Ziel ist der Schritt HINTER dem Konto. Frueher wurde erst auf den
        // Konto-Schritt gesprungen und nach 500 ms weiteranimiert — dabei
        // blitzte ein Anmeldeformular auf, obwohl der Nutzer laengst
        // angemeldet ist. Ein halbe Sekunde langer Widerspruch zu dem, was
        // die Statuszeile daneben sagt ("Angemeldet als ...").
        springeOhneAnimation(KONTO_STEP + 1);
        sammle();
        return;
      }
      // Clerks Registrier-Fenster einhaengen und auf die Anmeldung warten.
      await window.Auth.zeigeRegistrierung(document.getElementById("clerkKonto"));
      window.Auth.beiAnmeldung(async () => {
        const u = await window.Auth.nutzer();
        if (!u) return;
        daten.email = u.email || daten.email;
        status.style.color = "var(--gruen)";
        Icons.praefix(status, "check", "E-Mail bestätigt, Konto steht.");
        sammle(); zeige(aktuell + 1, 1);
      });
    })();

    // Überprüfen: Karten auf/zu + "Passt"-Haken. Exklusiv: nur eine Karte offen,
    // damit die Seite nie um mehr als eine Kartenhöhe wächst.
    document.querySelectorAll(".pk-kopf").forEach(k => k.addEventListener("click", () => {
      const pk = k.parentElement;
      const warOffen = pk.classList.contains("auf");
      document.querySelectorAll(".pk.auf").forEach(p => p.classList.remove("auf"));
      if (!warOffen) pk.classList.add("auf");
    }));
    document.querySelectorAll(".pk-passt").forEach(b => b.addEventListener("click", () => {
      const pk = b.closest(".pk"); pk.classList.add("geprueft"); pk.classList.remove("auf");
    }));
    function kurz(t) { return t ? t.replace(/\s+/g," ").trim().slice(0,42) : "nichts erkannt"; }
    function updatePruefVorschau() {
      const vs = (vid, wert) => { const e = document.getElementById(vid); if (e) e.textContent = kurz(wert); };
      vs("v-oeffnung", document.getElementById("p-oeffnung").value);
      const k = [document.getElementById("p-adresse").value, document.getElementById("p-kontakt").value].filter(Boolean).join(" · ");
      vs("v-kontakt", k);
      const faqAnzahl = faqListe.value().length;
      document.getElementById("v-faq").textContent = faqAnzahl ? faqAnzahl + (faqAnzahl === 1 ? " Frage definiert" : " Fragen definiert") : "noch keine Frage";
      vs("v-weiteres", document.getElementById("p-weiteres").value);
      vs("v-leistungen", document.getElementById("p-leistungen").value);
      vs("v-preise", document.getElementById("p-preise").value);
      vs("v-team", document.getElementById("p-team").value);
      vs("v-besonderheiten", document.getElementById("p-besonderheiten").value);
      vs("v-regeln", document.getElementById("p-regeln").value);
    }
    ["p-oeffnung","p-adresse","p-kontakt","p-weiteres","p-leistungen","p-preise","p-team","p-besonderheiten","p-regeln"].forEach(id =>
      document.getElementById(id).addEventListener("input", updatePruefVorschau));

    // Überprüfen: Häufige Fragen als Liste von Frage/Antwort-Paaren
    const faqListe = (function () {
      const el = document.getElementById("faqListe");
      function zeileHinzufuegen(frage = "", antwort = "") {
        const zeile = document.createElement("div"); zeile.className = "faq-eintrag";
        zeile.innerHTML =
          '<button type="button" class="faq-entfernen" title="Entfernen">×</button>' +
          '<input type="text" class="faq-frage" placeholder="Frage, die Kunden oft stellen" />' +
          '<textarea class="faq-antwort" placeholder="Antwort, die der Agent geben soll"></textarea>';
        zeile.querySelector(".faq-frage").value = frage;
        zeile.querySelector(".faq-antwort").value = antwort;
        zeile.querySelector(".faq-entfernen").addEventListener("click", () => { zeile.remove(); updatePruefVorschau(); });
        zeile.querySelectorAll("input,textarea").forEach(f => f.addEventListener("input", updatePruefVorschau));
        el.appendChild(zeile);
      }
      return {
        hinzufuegen: zeileHinzufuegen,
        rendern(liste) {
          el.innerHTML = "";
          (liste && liste.length ? liste : [{ frage: "", antwort: "" }]).forEach(f => zeileHinzufuegen(f.frage, f.antwort));
        },
        value() {
          return [...el.querySelectorAll(".faq-eintrag")]
            .map(z => ({ frage: z.querySelector(".faq-frage").value.trim(), antwort: z.querySelector(".faq-antwort").value.trim() }))
            .filter(f => f.frage || f.antwort);
        },
      };
    })();
    document.getElementById("faqHinzufuegen").addEventListener("click", () => { faqListe.hinzufuegen(); updatePruefVorschau(); });
    faqListe.rendern([]);

    // --- Webseite scannen (Background-Function + Status-Polling) ---
    // Der Scan läuft serverseitig als Background-Function (kein 10s-Limit). Das
    // Frontend stößt ihn an und fragt danach den Status ab, bis "done"/"error".
    const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));
    // Scan-Qualitätsbericht (Milestone 7): zeigt pro Kategorie, ob der Scan etwas
    // gefunden hat, so sieht die Firma sofort, was ihr Agent noch NICHT weiß.
    function zeigeScanBericht(d) {
      const box = document.getElementById("scanBericht");
      if (!box) return;
      box.textContent = "";
      const zeilen = [
        ["Name", d.name], ["Angebot", d.angebot],
        ["Öffnungszeiten", d.oeffnungszeiten], ["Adresse", d.adresse],
        ["Kontakt", d.kontakt], ["Leistungen", (d.leistungen || []).length],
        ["Preise", d.preise], ["FAQ", (d.faq || []).length],
        ["Team", d.team], ["Besonderheiten", d.besonderheiten],
      ];
      for (const [titel, wert] of zeilen) {
        const z = document.createElement("div");
        const ok = !!wert;
        Icons.praefix(z, ok ? "check" : "x", titel + (ok ? "" : ", bitte ergänzen"));
        z.style.color = ok ? "var(--gruen)" : "#b45309";
        box.appendChild(z);
      }
      if (d.hinweis) {
        const h = document.createElement("div");
        Icons.praefix(h, "triangle-alert", d.hinweis);
        h.style.cssText = "grid-column:1/-1;color:#b45309;margin-top:0.3rem;";
        box.appendChild(h);
      }
      box.hidden = false;
    }
    function uebernehmeScan(d) {
      daten.name = d.name||""; daten.angebot = d.angebot||"";
      daten.oeffnungszeiten = d.oeffnungszeiten||""; daten.adresse = d.adresse||"";
      daten.kontakt = d.kontakt||""; daten.faq = d.faq||[]; daten.weiteres = d.weiteres||""; daten.wissen = d.wissen||"";
      // Milestone 7: zusätzliche Scan-Felder, fließen beim Speichern in die Scan-Quelle.
      daten.leistungen = Array.isArray(d.leistungen) ? d.leistungen : [];
      daten.preise = d.preise||""; daten.team = d.team||""; daten.besonderheiten = d.besonderheiten||"";
      zeigeScanBericht(d);
      document.getElementById("p-name").value = daten.name;
      document.getElementById("p-angebot").value = daten.angebot;
      document.getElementById("p-oeffnung").value = daten.oeffnungszeiten;
      document.getElementById("p-adresse").value = daten.adresse;
      document.getElementById("p-kontakt").value = daten.kontakt;
      faqListe.rendern(daten.faq);
      document.getElementById("p-weiteres").value = daten.weiteres;
      // Detail-Felder mit dem Gefundenen vorbelegen, damit die Firma sieht und
      // ergänzt, was der Agent schon weiss (statt dass es unsichtbar bleibt).
      document.getElementById("p-leistungen").value = daten.leistungen.join("\n");
      document.getElementById("p-preise").value = daten.preise;
      document.getElementById("p-team").value = daten.team;
      document.getElementById("p-besonderheiten").value = daten.besonderheiten;
      // Fallback-Kontakt sinnvoll vorbelegen: der gefundene Firmen-Kontakt.
      const fk = document.getElementById("fallbackKontakt");
      if (fk && !fk.value.trim() && daten.kontakt) { fk.value = daten.kontakt; daten.fallbackKontakt = daten.kontakt; }
      updatePruefVorschau();
      if (d.farbe1) { daten.farbe1 = d.farbe1; document.getElementById("farbe1").value = d.farbe1; }
      if (d.farbe2) { daten.farbe2 = d.farbe2; document.getElementById("farbe2").value = d.farbe2; }
    }
    // Die Webseite ist PFLICHT — und zwar in brauchbarer Form, nicht nur
    // irgendein nicht-leerer Text.
    //
    // Grund ist nicht der Scan (der kann auch scheitern, dann geht es ohne ihn
    // weiter). Grund ist die spaetere Einbettung beim Kunden: Der Server laesst
    // einen Aufruf von einer fremden Domain nur zu, wenn diese zu der hier
    // hinterlegten Webseite passt (netlify/functions/lib/schutz.js,
    // originPasstZuFirma). Steht hier nichts oder etwas Unparsbares wie
    // "meine firma", schweigt die proaktive Ansprache auf der Kundenseite
    // spaeter STILL — niemand wuerde je erfahren, warum.
    //
    // Darum wird hier normalisiert und geprueft, statt nur auf "nicht leer" zu
    // testen. Gespeichert wird die normalisierte Form, damit derselbe Wert
    // spaeter serverseitig sicher zu parsen ist.
    function pruefeWebseite(roh) {
      const wert = String(roh || "").trim();
      if (!wert) return { ok: false, hinweis: "Bitte gib deine Webseite ein." };
      // Ohne Protokoll ist es fuer new URL() keine Adresse — die meisten
      // tippen aber "deine-firma.ch". Ergaenzen statt abweisen.
      const mitProtokoll = /^https?:\/\//i.test(wert) ? wert : "https://" + wert;
      let host;
      try {
        host = new URL(mitProtokoll).hostname;
      } catch {
        return { ok: false, hinweis: "Das sieht nicht nach einer Internetadresse aus." };
      }
      // Ein Punkt und keine Leerzeichen: unterscheidet "deine-firma.ch" von
      // "meine firma". localhost faellt damit auch raus, was hier richtig ist.
      if (!host.includes(".") || /\s/.test(host)) {
        return { ok: false, hinweis: "Bitte die vollstaendige Adresse, z.B. deine-firma.ch" };
      }
      return { ok: true, url: mitProtokoll };
    }

    document.getElementById("scanBtn").addEventListener("click", async () => {
      const feld = document.getElementById("webseite");
      const hinweisEl = document.getElementById("webseiteHinweis");
      const geprueft = pruefeWebseite(feld.value);
      if (!geprueft.ok) {
        // Inline-Hinweis statt alert() — dasselbe Muster wie beim Pflichtfeld
        // "Agenten-Name" weiter hinten.
        hinweisEl.textContent = geprueft.hinweis;
        hinweisEl.style.color = "#e11d48";
        feld.focus();
        return;
      }
      hinweisEl.textContent = "";
      const url = geprueft.url;
      // Die normalisierte Form auch ins Feld zurueckschreiben, damit sichtbar
      // ist, was tatsaechlich gespeichert wird.
      feld.value = url;
      daten.webseite = url;
      const status = document.getElementById("scanStatus");
      const loader = document.getElementById("scanLoader");
      const balken = document.getElementById("scanBalken");
      const btn = document.getElementById("scanBtn");
      btn.disabled = true; btn.style.opacity = 0.5;
      loader.classList.add("an"); balken.classList.add("an");
      const schritte = ["Seiten werden geladen", "Texte werden gelesen", "Infos werden gegliedert", "Farben werden erkannt"];
      let i = 0; status.textContent = schritte[0];
      const iv = setInterval(() => { i = (i + 1) % schritte.length; status.textContent = schritte[i]; }, 1800);
      const aufraeumen = () => { clearInterval(iv); loader.classList.remove("an"); balken.classList.remove("an"); btn.disabled = false; btn.style.opacity = 1; };
      try {
        const jobId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
                       : Date.now() + "-" + Math.random().toString(36).slice(2);
        // 1) Background-Scan anstoßen (antwortet sofort mit 202)
        const start = await fetch("/.netlify/functions/scan-background", {
          method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ url, jobId }),
        });
        if (start.status !== 202 && !start.ok) throw new Error("Scan konnte nicht gestartet werden");
        // 2) Status pollen, bis fertig oder Fehler (max ~90s)
        let d = null, pannen = 0;
        for (let versuch = 0; versuch < 60; versuch++) {
          await schlaf(1500);
          let s;
          try {
            const r = await fetch("/.netlify/functions/scan-status?jobId=" + encodeURIComponent(jobId));
            s = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(s.error || "Status nicht abrufbar (" + r.status + ")");
          } catch (e) {
            // Kurzer Netz-Hänger: weiter pollen. Drei echte Fehler am Stück: aufhören.
            if (++pannen >= 3) throw new Error(e.message || "Server nicht erreichbar");
            continue;
          }
          pannen = 0;
          if (s.status === "done") { d = s.ergebnis; break; }
          if (s.status === "error") throw new Error(s.fehler || "Scan fehlgeschlagen");
          // "pending"/"running" -> weiter warten
        }
        if (!d) throw new Error("Zeitüberschreitung beim Scan");
        uebernehmeScan(d);
        status.textContent = "Fertig gelesen";
        setTimeout(() => { aufraeumen(); zeige(3, 1); }, 600);
      } catch (e) {
        aufraeumen();
        // Echte Ursache mitzeigen (Timeout, API-Aussetzer, nicht erreichbar …),
        // damit ein Fehler diagnostizierbar ist statt nur "ging nicht".
        status.textContent = "Konnte die Seite nicht automatisch lesen (" + (e.message || "unbekannt") + "). Du kannst die Infos unten auch selbst eintragen.";
        loader.classList.add("an"); loader.querySelector(".spinner").style.display = "none";
        btn.textContent = "Weiter ohne Scan"; btn.onclick = () => zeige(3, 1);
      }
    });

    // --- Dokumente hochladen ---
    // Jedes Dokument wird eine EIGENE Wissensquelle (daten.dokumente), mit
    // Herkunft und Stand, einzeln entfernbar. Nichts wird mehr in das Textfeld
    // "Weitere Infos" gemischt (Milestone 3: Jede Info kennt ihre Herkunft).
    const MAX_DATEI = 4.5 * 1024 * 1024;
    function zeigeDokumente() {
      const liste = document.getElementById("doc-liste");
      liste.textContent = "";
      daten.dokumente.forEach((doc) => {
        const eintrag = document.createElement("div"); eintrag.className = "doc-eintrag";
        const nameEl = document.createElement("span"); nameEl.textContent = doc.titel;
        const stat = document.createElement("span"); stat.className = "stat"; Icons.praefix(stat, "check", "gelesen");
        stat.style.color = "var(--gruen)";
        const weg = document.createElement("button"); weg.type = "button"; weg.className = "faq-entfernen";
        weg.style.position = "static"; weg.title = "Entfernen"; Icons.setzeIcon(weg, "trash-2");
        weg.addEventListener("click", () => {
          daten.dokumente = daten.dokumente.filter((d) => d.id !== doc.id);
          zeigeDokumente();
        });
        eintrag.appendChild(nameEl); eintrag.appendChild(stat); eintrag.appendChild(weg);
        liste.appendChild(eintrag);
      });
    }
    document.getElementById("docs").addEventListener("change", async (e) => {
      const liste = document.getElementById("doc-liste");
      for (const f of e.target.files) {
        // Fortschritts-Zeile (Dateiname per textContent, nie innerHTML mit Nutzer-Daten)
        const eintrag = document.createElement("div"); eintrag.className = "doc-eintrag";
        const nameEl = document.createElement("span"); nameEl.textContent = f.name;
        const stat = document.createElement("span"); stat.className = "stat"; stat.textContent = "…";
        eintrag.appendChild(nameEl); eintrag.appendChild(stat); liste.appendChild(eintrag);
        try {
          if (f.size > MAX_DATEI) throw new Error("zu gross");
          const istText = /\.(txt|md|markdown)$/i.test(f.name) || (f.type||"").startsWith("text/");
          let text;
          if (istText) {
            text = (await f.text()).trim();
          } else {
            stat.textContent = "liest";
            const dataUrl = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
            const resp = await fetch("/.netlify/functions/dokument-lesen", { method:"POST", headers:{"content-type":"application/json"},
              body: JSON.stringify({ dateiname:f.name, mediaType:f.type, daten:String(dataUrl).split(",")[1] }) });
            const d = await resp.json(); if (!resp.ok) throw new Error(d.error||"Fehler");
            text = d.text || "";
          }
          daten.dokumente.push({ id: "doc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            typ: "dokument", titel: f.name, text, stand: new Date().toISOString().slice(0, 10) });
          zeigeDokumente(); // ersetzt auch die Fortschritts-Zeile
        } catch (err) {
          Icons.praefix(stat, "x", err.message || "Fehler"); stat.style.color = "#dc2626";
        }
      }
      e.target.value = "";
    });

    // --- Schrift wählen ---
    document.getElementById("schrift").addEventListener("change", (e) => {
      daten.schrift = e.target.value;
      document.getElementById("fontVorschau").style.fontFamily = '"' + e.target.value + '", sans-serif';
    });

    // --- Agenten-Identität (Welle 1, §3): Name (Pflicht), Rolle, Anrede ---
    const agentNameEl = document.getElementById("agentName");
    const agentRolleEl = document.getElementById("agentRolle");
    agentNameEl.addEventListener("input", () => {
      daten.agentName = agentNameEl.value.trim();
      document.getElementById("agentNameHinweis").textContent = "";
    });
    agentRolleEl.addEventListener("change", () => { daten.agentRolle = agentRolleEl.value; });
    const anredeChips = document.querySelectorAll("#anredeListe .pers-chip");
    function waehleAnrede(a) {
      daten.agentAnrede = a;
      anredeChips.forEach((c) => c.classList.toggle("aktiv", c.dataset.anrede === a));
    }
    anredeChips.forEach((c) => c.addEventListener("click", () => waehleAnrede(c.dataset.anrede)));
    waehleAnrede(daten.agentAnrede);

    // --- Persönlichkeit (Ton) wählen, NUR die Chips in #persListe ---
    const persChips = document.querySelectorAll("#persListe .pers-chip");
    function waehlePers(ton) {
      daten.persoenlichkeit = ton;
      persChips.forEach((c) => c.classList.toggle("aktiv", c.dataset.ton === ton));
      document.getElementById("persHinweis").textContent = TON_HINWEIS[ton] || "";
    }
    persChips.forEach((c) => c.addEventListener("click", () => waehlePers(c.dataset.ton)));
    waehlePers(daten.persoenlichkeit); // Standard vorwählen

    // Antwortstil: einfache Auswahlfelder statt eines technischen Prompt-Editors.
    function chipGruppe(selector, eigenschaft, datenAttribut) {
      const chips = document.querySelectorAll(selector);
      function waehle(wert) {
        daten[eigenschaft] = wert;
        chips.forEach((c) => c.classList.toggle("aktiv", c.dataset[datenAttribut] === wert));
        aktualisiereAntwortVorschau();
      }
      chips.forEach((c) => c.addEventListener("click", () => waehle(c.dataset[datenAttribut])));
      waehle(daten[eigenschaft]);
    }
    // Live-Beispiel: baut aus Länge + Format + Emoji eine echte Beispiel-Antwort
    // auf die feste Frage "Habt ihr sonntags offen?". So sieht man bei jedem Klick
    // sofort, was die Auswahl konkret bewirkt (statt einer abstrakten Beschreibung).
    function baueBeispielAntwort() {
      const nachLaenge = {
        kurz: ["Ja, sonntags 10 bis 16 Uhr."],
        ausgewogen: ["Ja, sonntags haben wir von 10 bis 16 Uhr geöffnet.", "Komm gern vorbei!"],
        ausfuehrlich: [
          "Ja, sonntags sind wir von 10 bis 16 Uhr für dich da.",
          "Unter der Woche öffnen wir schon um 9 Uhr.",
          "Wenn du möchtest, reserviere ich dir gleich einen Tisch.",
        ],
      };
      let teile = (nachLaenge[daten.antwortLaenge] || nachLaenge.ausgewogen).slice();
      if (daten.emojiStil === "dezent") {
        teile[teile.length - 1] += " 🙂";
      } else if (daten.emojiStil === "lebendig") {
        const deko = [" 👍", " 🕙", " 🎉", " 😊"];
        teile = teile.map((t, i) => t + deko[i % deko.length]);
      }
      const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (daten.antwortFormat === "listen") return "<ul>" + teile.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>";
      if (daten.antwortFormat === "fliessend") return "<p>" + esc(teile.join(" ")) + "</p>";
      return teile.map((t) => "<p>" + esc(t) + "</p>").join(""); // absatz
    }
    function aktualisiereAntwortVorschau() {
      const html = baueBeispielAntwort();
      document.querySelectorAll(".stil-demo .demo-antwort").forEach((el) => { el.innerHTML = html; });
    }
    chipGruppe("#laengenListe .pers-chip", "antwortLaenge", "laenge");
    chipGruppe("#emojiListe .pers-chip", "emojiStil", "emoji");
    chipGruppe("#formatListe .pers-chip", "antwortFormat", "format");

    // Aufklapp-Felder: beim Reinklicken wächst das Textfeld (CSS). Danach scrollen
    // wir es in die Mitte des Schritts, damit man das vergrösserte Feld ganz sieht,
    // ohne selbst runterscrollen zu müssen. Wartet die Wachstums-Transition (220ms) ab.
    document.querySelectorAll(".schritt-links textarea").forEach((t) => {
      t.addEventListener("focus", () => {
        setTimeout(() => { try { t.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {} }, 240);
      });
    });
    // Chat-Design: "Automatisch" ist Standard (Farben von der Website). "Selbst
    // anpassen" blendet Farb-/Schrift-Steuerung ein. Keine Startansicht-Wahl mehr
    //, das Widget schaltet auf dem Handy von selbst auf Vollbild (chatLayout bleibt
    // "sidebar" als Default in daten).
    (function () {
      const chips = document.querySelectorAll("#designListe .pers-chip");
      const eigen = document.getElementById("eigenControls");
      function waehleDesign(wert) {
        daten.chatDesign = wert;
        chips.forEach((c) => c.classList.toggle("aktiv", c.dataset.design === wert));
        if (eigen) eigen.hidden = wert !== "eigen";
      }
      chips.forEach((c) => c.addEventListener("click", () => waehleDesign(c.dataset.design)));
      waehleDesign(daten.chatDesign);
    })();

    // Ruhezustand des Widgets: Kreis in der Ecke oder Leiste unten.
    //
    // Beides konnte das Widget schon lange (public/widget.js liest data-stil),
    // waehlbar war es aber nirgends — die eigene Startseite setzt "leiste" von
    // Hand im Quelltext, jeder Kunde bekam zwangslaeufig "orb".
    //
    // Der Wert landet an zwei Stellen: in der Einbett-Zeile (dort liest ihn das
    // Widget) und in der gespeicherten Firma (damit das Dashboard spaeter weiss,
    // was der Kunde gewaehlt hat, und die Zeile neu bauen kann).
    (function () {
      const chips = document.querySelectorAll("#stilListe .pers-chip");
      const vorschau = document.getElementById("stilVorschau");
      const hinweis = document.getElementById("stilHinweis");
      const TEXTE = {
        orb: "Ein Kreis mit dem Gesicht deines Agenten, unten rechts. Zurückhaltend — er wartet, bis jemand klickt.",
        leiste: "Eine Eingabezeile unten mittig, mit dem Gesicht darin. Auffälliger, lädt direkt zum Tippen ein.",
      };
      function waehleStil(wert) {
        const stil = wert === "leiste" ? "leiste" : "orb";
        daten.widgetStil = stil;
        chips.forEach((c) => c.classList.toggle("aktiv", c.dataset.wstil === stil));
        if (vorschau) vorschau.dataset.wstil = stil;
        if (hinweis) hinweis.textContent = TEXTE[stil];
      }
      chips.forEach((c) => c.addEventListener("click", () => {
        waehleStil(c.dataset.wstil);
        // Einbett-Zeile sofort nachziehen, damit sie auch dann stimmt, wenn der
        // Kunde spaeter ueber "Zurueck" hierher kommt und die Wahl aendert.
        //
        // Bewusst NUR beim Klick, nicht beim Initialisieren weiter unten:
        // sammle() uebernimmt die Formularfelder OHNE Fallback (Feld leer ->
        // Wert leer, damit sich etwas auch loeschen laesst). Beim Seitenstart
        // sind die Felder noch leer, ein Aufruf dort koennte also Daten
        // wegwischen, die auf anderem Weg schon gesetzt wurden.
        sammle();
      }));
      waehleStil(daten.widgetStil);
    })();
    document.getElementById("fallbackKontakt").addEventListener("input", (e) => { daten.fallbackKontakt = e.target.value.trim(); });
    document.getElementById("agentGrenzen").addEventListener("input", (e) => { daten.grenzen = e.target.value.trim(); });

    // --- Schritt "Charakter erstellen" (eine Variante: KI-Charakter, Pflicht) ---
    // Es gibt kein Orb-/Basis-Angebot mehr. Der eigene Charakter IST das Produkt.
    const vorFigur = document.getElementById("vorFigur");
    const vorFigurImg = document.getElementById("vorFigurImg");
    const vorLabel = document.getElementById("vorLabel");

    function setVorschauFarben() {
      [document.getElementById("schrittAgent"), document.getElementById("schrittAusdruecke"),
       document.getElementById("vorschauRechts")].forEach((el) => {
        if (!el) return;
        el.style.setProperty("--vor-f1", daten.farbe1);
        el.style.setProperty("--vor-f2", daten.farbe2);
      });
    }
    function aktualisiereAgentVorschau() {
      setVorschauFarben();
      const bild = daten.charakterBilder && daten.charakterBilder.idle;
      if (bild) {
        vorFigurImg.src = bild; vorFigurImg.style.visibility = "visible";
        vorLabel.textContent = "Dein Charakter";
      } else {
        vorFigurImg.removeAttribute("src"); vorFigurImg.style.visibility = "hidden";
        vorLabel.textContent = "Noch kein Charakter, erstelle ihn links";
      }
    }
    aktualisiereAgentVorschau(); // Startzustand der Vorschau setzen

    // ---------- Charakter-Designer: der Chat ----------
    // Der Nutzer erzählt seine Idee, die KI (charakter-prompt.js) baut daraus den
    // Bild-Prompt und erzeugt EINEN Entwurf. Änderungswünsche laufen wieder über
    // den Chat (Bild-Edit), bis die Figur passt. Erst dann die Ausdrücke.
    const charVerlaufEl = document.getElementById("charVerlauf");
    const charEingabe = document.getElementById("charEingabe");
    const charSenden = document.getElementById("charSenden");
    const charVerlauf = [];        // [{rolle:"du"|"ki", text}]
    let charPrompt = "";           // aktueller Bild-Prompt aus dem Chat
    let charEntwurfBildUrl = "";   // aktueller Entwurf (URL in unserem Bucket)
    let charBusy = false;

    function charMsg(rolle, text, klasse) {
      const d = document.createElement("div");
      d.className = "d-msg " + (klasse || (rolle === "du" ? "du" : "ki"));
      d.textContent = text;
      charVerlaufEl.appendChild(d);
      charVerlaufEl.scrollTop = charVerlaufEl.scrollHeight;
      return d;
    }
    function charBusySetzen(an) {
      charBusy = an;
      charSenden.disabled = an;
      charEingabe.disabled = an;
    }
    // Startbild (Wortmarke + Begrüssung) steht im HTML und bleibt sichtbar,
    // bis die erste Nachricht rausgeht. Danach übernehmen die Nachrichten.
    const charStartEl = document.getElementById("charStart");
    function charChatStarten() {
      if (charVerlaufEl.children.length) return;
      if (charStartEl) charStartEl.hidden = false;
    }
    // Fehlt das eigene Maskottchen-Bild noch, zeigt die Marke einen Platzhalter.
    const charMarkeBild = document.getElementById("charMarkeBild");
    if (charMarkeBild) {
      const markePlatzhalter = () => document.getElementById("charMarke").classList.add("ohne-bild");
      charMarkeBild.addEventListener("error", markePlatzhalter);
      // Kann schon gescheitert sein, bevor dieses Skript lief.
      if (charMarkeBild.complete && !charMarkeBild.naturalWidth) markePlatzhalter();
    }

    // Der graue Beispieltext wechselt, damit das Feld nicht wie eine Vorlage
    // wirkt, die man abschreiben soll. Vor dem ersten Bild Ideen, danach
    // Änderungswünsche, denn dann ist das die eigentliche Aufgabe.
    const CHAR_BEISPIELE_IDEE = [
      "z.B. ein netter Hund, der zu unserer Bäckerei passt",
      "z.B. eine freundliche Figur, die zu uns passt",
      "z.B. etwas Verspieltes, unsere Kunden sind Familien",
      "z.B. eher edel und ruhig, wir beraten Firmen",
      "z.B. ein Tier aus unserer Region",
      "z.B. keine Ahnung, überrasch mich",
      "z.B. etwas, das zu Handwerk passt",
      "z.B. eine Figur mit unserer Hausfarbe",
    ];
    const CHAR_BEISPIELE_AENDERN = [
      "z.B. mach die Mütze rot",
      "z.B. etwas freundlicher schauen",
      "z.B. runder und weicher, bitte",
      "z.B. die Brille kann weg",
      "z.B. schlichter, weniger Details",
      "z.B. gib ihm etwas in die Hand",
    ];
    let charLetztesBeispiel = "";
    function charBeispielWechseln() {
      const liste = charEntwurfBildUrl ? CHAR_BEISPIELE_AENDERN : CHAR_BEISPIELE_IDEE;
      const frei = liste.filter((t) => t !== charLetztesBeispiel);
      charLetztesBeispiel = frei[Math.floor(Math.random() * frei.length)];
      charEingabe.placeholder = charLetztesBeispiel;
    }
    charBeispielWechseln();

    // Eingabefeld wächst mit dem Text mit (bis zur CSS-Grenze).
    function charEingabeAnpassen() {
      charEingabe.style.height = "auto";
      charEingabe.style.height = Math.min(charEingabe.scrollHeight, 110) + "px";
    }
    charEingabe.addEventListener("input", charEingabeAnpassen);

    async function charChatSenden() {
      const text = charEingabe.value.trim();
      if (!text || charBusy) return;
      charEingabe.value = "";
      charEingabeAnpassen();
      charBeispielWechseln();
      if (charStartEl) charStartEl.hidden = true; // Startbild weg, Gespräch übernimmt
      charVerlauf.push({ rolle: "du", text });
      charMsg("du", text);
      charBusySetzen(true);
      const tippt = charMsg("ki", "denkt nach…", "ki tippt");
      try {
        const res = await fetch("/.netlify/functions/charakter-prompt", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ verlauf: charVerlauf, firma: daten.name || "", angebot: daten.angebot || "" }),
        });
        const d = await res.json().catch(() => ({}));
        tippt.remove();
        if (!res.ok) {
          charMsg("ki", (d && d.error) || "Das hat gerade nicht geklappt, versuch es nochmal.");
          return;
        }
        charVerlauf.push({ rolle: "ki", text: d.antwort || "" });
        charMsg("ki", d.antwort || "");
        // Der Prompt IST die Beschreibung der Figur. Er wandert mit in die
        // gespeicherten Daten (charakter.beschreibung), damit das Dashboard ihn
        // zeigen/bearbeiten kann und der Agent sein eigenes Aussehen kennt.
        if (d.prompt) { charPrompt = d.prompt; daten.charakterBeschreibung = d.prompt; }
        // Prompt steht: Figur zeichnen (beim ersten Mal) bzw. anpassen.
        if (d.bereit && charPrompt) {
          if (charEntwurfBildUrl) await charEntwurfAnpassen(text);
          else await charEntwurfErstellen();
        }
      } catch (e) {
        tippt.remove();
        charMsg("ki", "Netzwerkfehler, versuch es nochmal.");
      } finally {
        charBusySetzen(false);
        charEingabe.focus();
      }
    }
    charSenden.addEventListener("click", charChatSenden);
    charEingabe.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); charChatSenden(); }
    });

    // Technische Meldungen ("fetch failed") sagen dem Kunden nichts. Hier wird
    // daraus ein Satz, aus dem hervorgeht, ob er warten oder etwas tun muss.
    function charFehlerText(m) {
      const t = String(m || "");
      if (/fetch failed|Failed to fetch|NetworkError|Job (lesen|speichern) fehlgeschlagen|nicht erreichbar/i.test(t))
        return "Unser Bilder-Dienst ist gerade nicht erreichbar. Versuch es in ein paar Minuten nochmal.";
      if (/Zeitüberschreitung/i.test(t))
        return "Das hat zu lange gedauert. Schick deine Nachricht bitte nochmal.";
      if (/Limit erreicht/i.test(t))
        return "Du hast für heute genug Figuren erstellt. Morgen geht es weiter.";
      if (/GEMINI_API_KEY|nicht eingerichtet/i.test(t))
        return "Die Bild-Erstellung ist auf diesem Server noch nicht eingerichtet.";
      return t;
    }

    // EINE Figur aus dem Chat-Prompt zeichnen (nicht mehr vier Varianten).
    async function charEntwurfErstellen() {
      const status = document.getElementById("charErstellenStatus");
      charBusySetzen(true); balken("charBalken", true);
      status.style.color = ""; status.textContent = "Deine Figur wird gezeichnet, das dauert einen Moment…";
      const warte = charMsg("ki", "zeichnet deine Figur…", "ki tippt");
      try {
        const erg = await charJob({ aktion: "entwurf", beschreibung: charPrompt, bild: charReferenzBild || undefined }, 90);
        charEntwurfBildUrl = erg.bild;
        warte.remove();
        zeigeEntwurf(erg.bild);
        charMsg("ki", "Hier ist deine Figur. Was soll ich ändern? Wenn sie passt, klick auf: Passt, Ausdrücke erstellen.");
        status.textContent = "";
      } catch (e) {
        warte.remove();
        charMsg("ki", "Das Zeichnen hat nicht geklappt. " + charFehlerText(e.message));
        status.style.color = "#e11d48"; status.textContent = "";
      } finally { balken("charBalken", false); charBusySetzen(false); }
    }

    // Änderungswunsch aus dem Chat auf den bestehenden Entwurf anwenden.
    async function charEntwurfAnpassen(anweisung) {
      const status = document.getElementById("charErstellenStatus");
      charBusySetzen(true); balken("charBalken", true);
      status.style.color = ""; status.textContent = "Änderung wird umgesetzt…";
      const warte = charMsg("ki", "passt die Figur an…", "ki tippt");
      try {
        const erg = await charJob({ aktion: "bearbeiten", bild: charEntwurfBildUrl, anweisung, beschreibung: charPrompt }, 60);
        charEntwurfBildUrl = erg.bild;
        warte.remove();
        zeigeEntwurf(erg.bild);
        charMsg("ki", "So besser? Sag gern weiter, was noch anders soll.");
        status.textContent = "";
      } catch (e) {
        warte.remove();
        charMsg("ki", "Die Änderung hat nicht geklappt. " + charFehlerText(e.message));
        status.style.color = "#e11d48"; status.textContent = "";
      } finally { balken("charBalken", false); charBusySetzen(false); }
    }

    // Die letzte Bild-Nachricht im Verlauf (für den "Passt"-Knopf): bei einer
    // neuen Figur/Änderung verliert die vorherige ihren Knopf, sonst könnte man
    // aus Versehen eine veraltete Version übernehmen.
    let charLetzteBildBubble = null;
    function zeigeEntwurf(url) {
      if (charLetzteBildBubble) {
        const alterBtn = charLetzteBildBubble.querySelector("button");
        if (alterBtn) alterBtn.remove();
      }
      const bubble = document.createElement("div");
      bubble.className = "d-msg ki d-bild";
      const img = document.createElement("img");
      img.src = url; img.alt = "Deine Figur";
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "btn btn-primar";
      btn.textContent = "Passt, Ausdrücke erstellen";
      btn.addEventListener("click", () => {
        if (!charEntwurfBildUrl) return;
        generiereZustaendeAusBild(charEntwurfBildUrl, charPrompt);
      });
      bubble.appendChild(img); bubble.appendChild(btn);
      charVerlaufEl.appendChild(bubble);
      charVerlaufEl.scrollTop = charVerlaufEl.scrollHeight;
      charLetzteBildBubble = bubble;

      vorFigurImg.src = url; vorFigurImg.style.visibility = "visible";
      vorLabel.textContent = "Dein Entwurf";
      charBeispielWechseln(); // ab jetzt Beispiele für Änderungswünsche
    }

    function balken(id, an) { document.getElementById(id).classList.toggle("an", !!an); }

    // --- Charakter-Generierung (Milestone 6: echte Bilder via Background-Job) ---
    // Gleiches Muster wie der Scan: Job anstoßen (202) -> scan-status pollen.
    // Generieren dauert 30-90s (4 Bilder), Edits ~10-30s (1 Bild).
    const CHAR_ZUSTAENDE = ["idle", "denken", "sprechen", "verlegen"];
    const CHAR_LABELS = { idle: "Ruhe", denken: "Denken", sprechen: "Sprechen", verlegen: "Verlegen" };
    let charReferenzBild = null; // Data-URL des Uploads, dient auch als KI-Vorlage

    // Stilwahl der Figur. Eigene Bindung statt chipGruppe(): Die dortige
    // Funktion ruft am Ende die Antwort-Vorschau auf, die mit dem Aussehen der
    // Figur nichts zu tun hat.
    (function stilWahlBinden() {
      const gruppe = document.getElementById("charStilWahl");
      const hinweis = document.getElementById("charStilHinweis");
      if (!gruppe) return;
      const TEXTE = {
        flach: "Flache Illustration mit klaren Linien.",
        "3d": "Weiches 3D wie eine kleine Knetfigur.",
      };
      const chips = gruppe.querySelectorAll(".pers-chip");
      function waehle(wert) {
        daten.charakterStil = TEXTE[wert] ? wert : "flach";
        chips.forEach((c) => c.classList.toggle("aktiv", c.dataset.stil === daten.charakterStil));
        if (hinweis) hinweis.textContent = TEXTE[daten.charakterStil];
      }
      chips.forEach((c) => c.addEventListener("click", () => waehle(c.dataset.stil)));
      waehle(daten.charakterStil);
    })();

    async function charJob(payload, maxVersuche) {
      const jobId = "char-" + ((window.crypto && crypto.randomUUID) ? crypto.randomUUID()
                     : Date.now() + "-" + Math.random().toString(36).slice(2));
      const start = await fetch("/.netlify/functions/charakter-background", {
        method: "POST", headers: { "content-type": "application/json" },
        // stilWahl geht hier mit, damit sie fuer JEDE Aktion gilt: Entwurf,
        // Richtungen, Zustaende und spaetere Nachbesserungen. Wuerde sie nur
        // beim Entwurf mitgehen, kaeme die Figur in einem Stil und ihre
        // Ausdruecke im anderen.
        body: JSON.stringify({ jobId, firmaId: daten.id || undefined, farbe: daten.farbe1,
          stilWahl: daten.charakterStil, ...payload }),
      });
      if (start.status === 429) throw new Error("Limit erreicht, bitte später erneut versuchen.");
      if (start.status !== 202 && !start.ok) throw new Error("Konnte nicht gestartet werden.");
      // Antwortet die Status-Function mehrfach hintereinander mit einem echten
      // Fehler (z.B. Job-Speicher nicht erreichbar), hat weiteres Warten keinen
      // Sinn: dann lieber sofort die Ursache zeigen statt Minuten lang zu pollen.
      let pannen = 0, letzteMeldung = "";
      for (let versuch = 0; versuch < (maxVersuche || 90); versuch++) {
        await schlaf(2000);
        let s;
        try {
          const r = await fetch("/.netlify/functions/scan-status?jobId=" + encodeURIComponent(jobId));
          s = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(s.error || "Status nicht abrufbar (" + r.status + ")");
        } catch (e) {
          letzteMeldung = e.message || "";
          if (++pannen >= 3) throw new Error(letzteMeldung || "Server nicht erreichbar.");
          continue; // kurzer Netz-Hänger -> weiter pollen
        }
        pannen = 0;
        if (s.status === "done") return s.ergebnis;
        if (s.status === "error") throw new Error(s.fehler || "Fehlgeschlagen");
      }
      throw new Error("Zeitüberschreitung.");
    }

    // 4-Bilder-Raster: jedes Bild prüfen und einzeln per Anweisung nachbessern.
    function zeigeCharGrid() {
      const grid = document.getElementById("charGrid");
      grid.textContent = "";
      const bilder = daten.charakterBilder || {};
      if (!bilder.idle) { grid.hidden = true; return; }
      grid.hidden = false;
      CHAR_ZUSTAENDE.forEach((z) => {
        const zelle = document.createElement("div");
        zelle.style.cssText = "border:1px solid #e5e7eb;border-radius:12px;padding:0.65rem;text-align:center;";
        const im = document.createElement("img");
        im.src = bilder[z] || bilder.idle; im.alt = z;
        // Kein background: die Bilder sind seit dem Freistellen (Chroma-Key) echt
        // transparent, eine Fuellfarbe wuerde nur wieder einen Kasten hinter die
        // Figur malen. Die Zelle selbst (zelle) hat schon einen Rahmen.
        im.style.cssText = "width:100%;aspect-ratio:1;object-fit:contain;border-radius:9px;";
        const lbl = document.createElement("div");
        lbl.textContent = CHAR_LABELS[z]; lbl.style.cssText = "font-size:0.82rem;font-weight:600;margin:0.45rem 0 0.5rem;color:#374151;";
        // Änderungs-Eingabe als mehrzeiliger Textbereich (Platz für 2 bis 3 Sätze),
        // Knopf in voller Breite darunter.
        const reihe = document.createElement("div");
        reihe.style.cssText = "display:flex;flex-direction:column;gap:0.4rem;";
        const inp = document.createElement("textarea");
        inp.placeholder = "z.B. Mütze blau machen. Hintergrund heller. Freundlicher lächeln.";
        inp.maxLength = 300;
        inp.style.cssText = "width:100%;font:inherit;font-size:0.85rem;line-height:1.45;padding:0.55rem 0.65rem;" +
          "border:1.5px solid #e5e7eb;border-radius:9px;min-height:84px;resize:vertical;";
        const btn = document.createElement("button");
        btn.type = "button"; btn.textContent = "Ändern";
        btn.style.cssText = "width:100%;font:inherit;font-size:0.83rem;font-weight:600;padding:0.5rem 0.6rem;border:1.5px solid var(--vor-f1,#4F46E5);color:var(--vor-f1,#4F46E5);border-radius:9px;background:#fff;cursor:pointer;";
        btn.addEventListener("click", async () => {
          const anweisung = inp.value.trim();
          if (!anweisung) { inp.focus(); return; }
          btn.disabled = true; btn.textContent = "…"; im.style.opacity = 0.4;
          try {
            const erg = await charJob({ aktion: "bearbeiten", bild: bilder[z], anweisung, zustand: z,
              beschreibung: daten.charakterBeschreibung || "" }, 45);
            daten.charakterBilder[z] = erg.bild;
            zeigeCharGrid(); aktualisiereAgentVorschau();
          } catch (e) {
            btn.disabled = false; btn.textContent = "Ändern"; im.style.opacity = 1;
            alert("Bearbeiten fehlgeschlagen: " + e.message);
          }
        });
        reihe.appendChild(inp); reihe.appendChild(btn);
        zelle.appendChild(im); zelle.appendChild(lbl); zelle.appendChild(reihe);
        grid.appendChild(zelle);
      });
    }


    // Schritt 2: aus dem im Chat erarbeiteten Entwurf die Ausdrücke erzeugen.
    // Wechselt sofort auf die Ausdrücke-Seite; die Bilder erscheinen dort, sobald
    // sie fertig sind.
    let zustaendeLaufen = false;
    async function generiereZustaendeAusBild(bildUrl, beschreibung) {
      if (!bildUrl || zustaendeLaufen) return;
      zustaendeLaufen = true;
      const status = document.getElementById("charZustandStatus");
      zeige(AUSDRUECKE_STEP, 1);
      document.getElementById("charGrid").hidden = true;
      status.style.color = ""; balken("zustaendeBalken", true);
      status.textContent = "Die Ausdrücke deiner Figur werden erzeugt, noch etwa eine Minute…";
      // Vorfreude: der gewählte Entwurf während des Wartens auf der Seite zeigen.
      document.getElementById("gewaehlteVorschauImg").src = bildUrl;
      document.getElementById("gewaehlteVorschau").hidden = false;
      vorFigurImg.src = bildUrl; vorFigurImg.style.visibility = "visible";
      vorLabel.textContent = "Dein Charakter entsteht…";
      try {
        const erg = await charJob({ aktion: "zustaende", beschreibung: beschreibung || "", bild: bildUrl }, 120);
        daten.charakterBilder = erg.bilder;
        if (beschreibung) daten.charakterBeschreibung = beschreibung;
        status.style.color = "var(--gruen)";
        Icons.praefix(status, "check", "Fertig! Jeder Ausdruck lässt sich unten gezielt anpassen.");
        document.getElementById("gewaehlteVorschau").hidden = true;
        zeigeCharGrid(); aktualisiereAgentVorschau();
      } catch (e) {
        status.style.color = "#e11d48";
        status.textContent = "Konnte die Ausdrücke nicht erstellen: " + e.message;
      } finally {
        balken("zustaendeBalken", false);
        zustaendeLaufen = false;
        // Charakter ist da -> Rückkehrer-Link auf der Erstell-Seite freischalten.
        const l = document.getElementById("zuAusdruecken");
        if (l && daten.charakterBilder && daten.charakterBilder.idle) l.hidden = false;
      }
    }

    // Bild-Upload: dient als Vorlage für die Figur, ODER (dezenter Zweitweg)
    // direkt als Figur, ganz ohne KI. Zwei Wege dorthin: der Plus-Knopf im
    // Eingabefeld und ein Bild, das auf das Feld gezogen wird.
    function charBildUebernehmen(f) {
      if (!f) return;
      const status = document.getElementById("charBildStatus");
      if (!/^image\//.test(f.type)) { status.style.color = "#e11d48"; status.textContent = "Das ist kein Bild."; return; }
      if (f.size > 4.5 * 1024 * 1024) { status.style.color = "#e11d48"; status.textContent = "Bild ist zu groß (max. 4,5 MB)."; return; }
      const r = new FileReader();
      r.onload = () => {
        charReferenzBild = r.result;
        status.style.color = "var(--gruen)";
        Icons.praefix(status, "check", f.name + " übernommen, fliesst als Vorlage in deine Figur ein.");
        document.getElementById("charDirektZeile").hidden = false;
        document.getElementById("charPlus").classList.add("hat-bild");
      };
      r.readAsDataURL(f);
    }
    document.getElementById("charBild").addEventListener("change", (e) => {
      charBildUebernehmen(e.target.files[0]);
      e.target.value = "";
    });
    document.getElementById("charPlus").addEventListener("click", () => {
      document.getElementById("charBild").click();
    });
    // Bild direkt auf das Eingabefeld ziehen.
    const charKomposer = document.getElementById("charKomposer");
    charKomposer.addEventListener("dragover", (e) => { e.preventDefault(); charKomposer.classList.add("zieht"); });
    charKomposer.addEventListener("dragleave", () => charKomposer.classList.remove("zieht"));
    charKomposer.addEventListener("drop", (e) => {
      e.preventDefault(); charKomposer.classList.remove("zieht");
      charBildUebernehmen(e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    document.getElementById("charDirekt").addEventListener("click", () => {
      if (!charReferenzBild) return;
      daten.charakterBilder = { idle: charReferenzBild, denken: charReferenzBild, sprechen: charReferenzBild, verlegen: charReferenzBild };
      const status = document.getElementById("charZustandStatus");
      status.style.color = ""; status.textContent = "Dein Bild wird für alle Ausdrücke verwendet, du kannst es unten per Anweisung variieren.";
      zeigeCharGrid(); aktualisiereAgentVorschau();
      zeige(AUSDRUECKE_STEP, 1);
    });

    document.getElementById("zuAusdruecken").addEventListener("click", () => zeige(AUSDRUECKE_STEP, 1));

    // §8 Veröffentlichungs-Checkliste (+ §2 Warnung bei fehlenden kritischen Daten).
    // Vor dem Live-Gehen sieht die Firma gebündelt, was der Agent schon kann und was
    // ihm fehlt. Kritische Lücken (Name, Angebot, Wissen) lösen eine Warnung aus, der
    // Agent bleibt trotzdem testbar; das ist ein Hinweis, keine Sperre.
    function pruefeStartklar() {
      const box = document.getElementById("startklar");
      const banner = document.getElementById("startklarBanner");
      const liste = document.getElementById("startklarListe");
      if (!box || !banner || !liste) return;
      sammle(); // Felder -> daten, damit der Check den aktuellen Stand prüft
      const hatWissen = !!(daten.angebot || (daten.leistungen && daten.leistungen.length) ||
        daten.weiteres || daten.besonderheiten || daten.preise ||
        (daten.dokumente && daten.dokumente.length) || (daten.faq && daten.faq.length));
      // kritisch: ohne diese ist der Agent nicht wirklich brauchbar
      const kritisch = [
        ["Name deiner Firma", !!daten.name],
        ["Was du anbietest", !!daten.angebot],
        ["Wissen (Scan, Infos oder Dokumente)", hatWissen],
        ["Name deines Agenten", !!daten.agentName],
      ];
      // empfohlen: macht den Agenten deutlich hilfreicher, ist aber kein Muss
      const empfohlen = [
        ["Öffnungszeiten", !!daten.oeffnungszeiten],
        ["Kontaktmöglichkeit", !!daten.kontakt],
        ["Adresse", !!daten.adresse],
        ["Häufige Fragen", !!(daten.faq && daten.faq.length)],
      ];
      liste.textContent = "";
      const zeile = (titel, ok, kritischFehlt) => {
        const z = document.createElement("div");
        Icons.praefix(z, ok ? "check" : (kritischFehlt ? "x" : "circle"), titel);
        z.style.color = ok ? "var(--gruen)" : (kritischFehlt ? "#b45309" : "var(--grau)");
        liste.appendChild(z);
      };
      for (const [t, ok] of kritisch) zeile(t, ok, true);
      for (const [t, ok] of empfohlen) zeile(t, ok, false);
      const fehlendKritisch = kritisch.filter(([, ok]) => !ok).map(([t]) => t);
      if (fehlendKritisch.length) {
        Icons.praefix(banner, "triangle-alert", "Bevor du live gehst, fehlen wichtige Infos: " +
          fehlendKritisch.join(", ") + ". Der Agent funktioniert trotzdem, aber ergänze das " +
          "am besten jetzt (zurück) oder später im Dashboard.");
        banner.style.color = "#b45309";
      } else {
        Icons.praefix(banner, "check", "Startklar, dein Agent kennt alles Wichtige.");
        banner.style.color = "var(--gruen)";
      }
      box.hidden = false;
    }

    function sammle() {
      // Die Felder sind die WAHRHEIT: direkte Übernahme (kein "||"-Fallback,
      // sonst liesse sich ein falsch erkannter Wert nie durch Leeren löschen).
      const wert = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
      daten.email = wert("email");
      daten.webseite = wert("webseite") || daten.webseite;
      daten.name = wert("p-name");
      daten.angebot = wert("p-angebot");
      daten.oeffnungszeiten = wert("p-oeffnung");
      daten.adresse = wert("p-adresse");
      daten.kontakt = wert("p-kontakt");
      daten.faq = faqListe.value();
      daten.weiteres = wert("p-weiteres");
      // Detail-Wissen (Milestone 7 sichtbar gemacht): Leistungen zeilenweise,
      // der Rest als Freitext. Alles fliesst unten in scanText -> Agenten-Wissen.
      daten.leistungen = wert("p-leistungen").split("\n").map((s) => s.trim()).filter(Boolean);
      daten.preise = wert("p-preise");
      daten.team = wert("p-team");
      daten.besonderheiten = wert("p-besonderheiten");
      daten.regeln = wert("p-regeln");
      daten.farbe1 = wert("farbe1") || daten.farbe1;
      daten.farbe2 = wert("farbe2") || daten.farbe2;
      daten.fallbackKontakt = wert("fallbackKontakt");
      daten.grenzen = wert("agentGrenzen");
      // Agenten-Identität (§3): Name Pflicht (mit Firmenname als Fallback),
      // Rolle + Anrede aus den Feldern.
      daten.agentName = wert("agentName") || daten.name || "Assistent";
      daten.agentRolle = wert("agentRolle") || daten.agentRolle || "Assistent";
      // ID erst vergeben, wenn es eine echte Quelle (Name/Webseite) gibt.
      // sammle() läuft bei JEDEM Weiter-Klick, auch ganz am Anfang, wenn noch
      // alles leer ist. Ohne diese Bedingung bekäme jede Firma die ID "firma"
      // (klebt wegen daten.id || …) und alle Kunden überschrieben sich gegenseitig.
      if (!daten.id && (daten.name || daten.webseite)) {
        daten.id = (daten.name || daten.webseite).toLowerCase().replace(/^https?:\/\//,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,24);
      }
      // data-stil nur bei "leiste" mitschreiben: "orb" ist ohnehin der Standard
      // im Widget, ein data-stil="orb" waere also nur Rauschen in einer Zeile,
      // die der Kunde in seinen Quelltext kopiert.
      const stilAttr = daten.widgetStil === "leiste" ? ' data-stil="leiste"' : "";
      document.getElementById("embed-text").textContent =
        '<script src="' + location.origin + '/widget.js" data-firma="' + daten.id + '" data-farbe="' + daten.farbe1 + '" data-farbe2="' + daten.farbe2 + '"' + stilAttr + '><\/script>';
    }
    document.getElementById("copy").addEventListener("click", (e) => {
      navigator.clipboard.writeText(document.getElementById("embed-text").textContent);
      e.target.textContent = ""; const kic = document.createElement("span"); Icons.setzeIcon(kic, "check");
      e.target.append("Kopiert ", kic);
    });
    // Was der Plan hier auf der Seite bedeutet.
    //
    // Zwei Stellen sprechen ueber Geld: die Preiszeile im Willkommensschritt und
    // die Zeile ganz am Ende. Beide standen fest auf "CHF 49" — einem Preis, den
    // es seit der Umstellung auf Free/Start/Grow/Scale nicht mehr gibt. Und
    // schlimmer: Wer eben erst bezahlt hatte, bekam am Ende trotzdem einen
    // Verkaufsknopf zu sehen.
    //
    // Die Betraege stehen WOERTLICH so in public/preis.html. Beim Aendern
    // muessen beide Stellen angefasst werden — es gibt hier bewusst keinen
    // gemeinsamen Datensatz, weil eine dritte Datei nur eine dritte Stelle
    // waere, die auseinanderlaufen kann.
    const PREIS_TEXT = { free: "CHF 0", start: "CHF 29", grow: "CHF 79", scale: "CHF 199" };
    const PLAN_NAME  = { free: "Free", start: "Start", grow: "Grow", scale: "Scale" };

    function zeigePlanTexte() {
      const plan = PLAN_NAME[daten.plan] ? daten.plan : "free";
      const bezahlt = plan !== "free";
      const name = PLAN_NAME[plan];

      const preiszeile = document.getElementById("preiszeileStart");
      if (preiszeile) {
        const b = preiszeile.querySelector("b");
        const dazu = preiszeile.querySelector(".dazu");
        if (bezahlt && istBezahlt) {
          // Der Kunde kommt gerade von der Bezahlseite zurueck. Ihm hier noch
          // einmal einen Preis zu zeigen, waere der falsche Satz im teuersten
          // Moment der ganzen Reise.
          if (b) b.textContent = name + "-Abo aktiv";
          if (dazu) dazu.textContent = "danke — jetzt richten wir deinen Agenten ein";
        } else if (bezahlt) {
          if (b) b.textContent = PREIS_TEXT[plan];
          if (dazu) dazu.textContent = "pro Monat für " + name + ", jederzeit kündbar";
        }
        // free: der Text im HTML stimmt bereits ("ab CHF 0").
      }

      const fsZeile = document.getElementById("fsText");
      const knopf = document.getElementById("obCheckout");
      if (fsZeile && knopf) {
        // Hier zaehlt NUR istBezahlt, nicht der gewaehlte Plan: Wer ueber
        // ?plan=grow hereinkommt, hat den Plan angeklickt, aber nichts bezahlt.
        // Ihm "Grow aktiv" anzuzeigen waere schlicht falsch — er ist bis zur
        // Zahlung im kostenlosen Plan, und genau das soll hier stehen.
        if (istBezahlt) {
          fsZeile.innerHTML = "";
          const fett = document.createElement("b");
          fett.textContent = name + " aktiv";
          const dazu = document.createElement("span");
          dazu.className = "fs-dazu";
          dazu.textContent = "Dein Agent läuft im vollen Umfang. Plan " +
            "ändern kannst du jederzeit im Dashboard.";
          fsZeile.append(fett, dazu);
          // Kein Verkaufsknopf mehr an jemanden, der schon bezahlt hat.
          knopf.hidden = true;
        } else {
          knopf.hidden = false;
        }
      }
    }

    // Der Knopf ist seit dem Umbau ein normaler Link auf die Preisseite.
    //
    // Vorher startete er von hier aus direkt einen Checkout — fest auf "plus"
    // und mit der firmaId. Beides passt nicht mehr: Es gibt vier Plaene, und
    // das Abo haengt am Nutzer, nicht an der Firma. Ausserdem ist es ehrlicher,
    // den Kunden den Plan bewusst wählen zu lassen, statt ihm ungefragt den
    // mittleren zu verkaufen.
    zeigePlanTexte();

    document.getElementById("fertig").addEventListener("click", async () => {
      sammle();
      daten.id = daten.id || "firma"; // letzter Fallback, falls gar nichts eingegeben wurde
      const status = document.getElementById("speicherStatus");
      const btn = document.getElementById("fertig");
      btn.disabled = true; status.textContent = "Speichern…"; status.style.color = "";
      const fakten = {};
      if (daten.oeffnungszeiten) fakten["Öffnungszeiten"] = daten.oeffnungszeiten;
      if (daten.adresse) fakten["Adresse"] = daten.adresse;
      if (daten.kontakt) fakten["Kontakt"] = daten.kontakt;
      // Der Charakter ist EIN Objekt: Aussehen (Farben/Schrift), Beschreibung
      // und Bilder gehören zusammen und werden in derselben Zeile gespeichert.
      // Die Beschreibung braucht sowohl das Dashboard (bearbeiten) als auch der
      // Agent (er soll wissen, wie er aussieht) — deshalb wandert sie mit.
      const charakter = {
        farbe: daten.farbe1, akzent: daten.farbe2, schrift: daten.schrift,
        beschreibung: daten.charakterBeschreibung || "",
      };
      if (daten.charakterBilder && daten.charakterBilder.idle) {
        // Data-URLs zuerst in den Storage hochladen -> kleine öffentliche URLs.
        // Die firmen-Zeile hat ein Größenlimit; Base64 gehört nicht in die DB.
        try {
          status.textContent = "Bilder werden hochgeladen…";
          charakter.bilder = await Store.ladeBilderHoch(daten.id, daten.charakterBilder);
        } catch (e) {
          status.style.color = "#e11d48";
          status.textContent = "Bild-Upload fehlgeschlagen: " + e.message;
          btn.disabled = false;
          return;
        }
      }
      // Wissen als QUELLEN-Liste: Scan/eigene Angaben + jedes Dokument einzeln.
      // So kann das Dashboard später einzelne Quellen aktualisieren oder löschen.
      const heute = new Date().toISOString().slice(0, 10);
      const wissensquellen = [];
      // Scan-Quelle aus ALLEN erkannten Kategorien (Milestone 7) + den vom
      // Nutzer geprüften Feldern, das ist das Wissen, aus dem der Agent lebt.
      const leistungen = Array.isArray(daten.leistungen) ? daten.leistungen : [];
      const scanText = [
        daten.angebot && ("Angebot: " + daten.angebot),
        leistungen.length && ("Leistungen:\n- " + leistungen.join("\n- ")),
        daten.preise && ("Preise: " + daten.preise),
        daten.team && ("Team: " + daten.team),
        daten.besonderheiten && ("Besonderheiten: " + daten.besonderheiten),
        daten.regeln && ("Regeln: " + daten.regeln),
        daten.weiteres,
      ].filter(Boolean).join("\n\n");
      if (scanText) {
        wissensquellen.push({ id: "scan", typ: daten.webseite ? "scan" : "manuell",
          titel: "Webseite & eigene Angaben", quelle: daten.webseite || "", stand: heute, text: scanText });
      }
      for (const doc of daten.dokumente) wissensquellen.push(doc);

      const firma = {
        id: daten.id, name: daten.name || daten.id, email: daten.email, webseite: daten.webseite,
        plan: daten.plan,
        persona: {
          name: daten.agentName || (daten.name ? daten.name + "-Assistent" : "Assistent"),
          rolle: daten.agentRolle || "Assistent",
          ansprache: daten.agentAnrede || "du",
          ton: (TON_TEXTE[daten.persoenlichkeit] || TON_TEXTE.freundlich),
          sprache: "Deutsch",
          antwortLaenge: daten.antwortLaenge,
          emojiStil: daten.emojiStil,
          antwortFormat: daten.antwortFormat,
          uebergabe: daten.uebergabe,
          fallbackKontakt: daten.fallbackKontakt,
          grenzen: daten.grenzen,
        },
        fakten, faq: daten.faq, wissensquellen,
        // Jeder Agent kann von Anfang an Kontaktanfragen aufnehmen (Lead-Capture).
        faehigkeiten: ["kontakt"],
        charakter: { ...charakter, chatDesign: daten.chatDesign, chatLayout: daten.chatLayout, widgetStil: daten.widgetStil },
      };
      try {
        await Store.saveFirma(firma);
        Store.setNutzer(daten.email);
        // Die gerade erstellte Firma merken: das Dashboard öffnet sie dann auch,
        // wenn man OHNE ?firma-Parameter dorthin kommt (z.B. über den E-Mail-
        // Bestätigungs-Link, der nur auf /dashboard.html zeigt). Sonst zeigte das
        // Dashboard firmen[0] = irgendeine ältere Firma.
        try { localStorage.setItem("kiagent-letzteFirma", daten.id); } catch (e) {}
        status.style.color = "var(--gruen)"; status.textContent = "Gespeichert! Öffne den Test-Chat…";
        // Übergabe ans Dashboard: Link zeigt direkt auf den frisch erstellten Agenten.
        const dash = document.querySelector('a[href^="dashboard.html"]');
        if (dash) dash.href = "dashboard.html?firma=" + encodeURIComponent(daten.id);
        window.open("index.html?firma=" + encodeURIComponent(daten.id), "_blank");
      } catch (e) {
        status.style.color = "#e11d48"; status.textContent = "Konnte nicht gespeichert werden: " + e.message;
      } finally {
        btn.disabled = false;
      }
    });

    // Bezahlung findet VOR dem Onboarding statt, kein Checkout mehr in
    // Schritt 9. Fallback für Nicht-Zahler: Abo-Bereich im Dashboard.

    gsap.set([linksSchritte[0], rechtsSchritte[0]], { autoAlpha: 1, x: 0 });
    updateProgress();
    syncSzenenVideos(0);

    // ════════════════════════════════════════════════════════════════════
    // DEV-SKIP (nur zum Testen während der Onboarding-Arbeit)
    // Ein Knopf, unten rechts auf JEDEM Schritt sichtbar, der direkt zum
    // nächsten Schritt springt — auch über die teuren/langsamen Schritte
    // hinweg (Webseite scannen, Charakter zeichnen), die dafür mit
    // Platzhalter-Daten befüllt werden. Nutzt nur bestehende Funktionen
    // (uebernehmeScan, sammle, zeige), verändert sonst nichts.
    //
    // ENTFERNEN: diesen kompletten Block bis "ENDE DEV-SKIP" löschen.
    // Keine andere Datei ist betroffen, nichts weiter anzupassen.
    (function devSkipEinrichten() {
      // NUR LOKAL. Auf einer echten Domain waere das ein Knopf, mit dem jeder
      // Kunde die teuren Schritte ueberspringt und am Ende einen Agenten mit
      // Platzhalter-Daten haette — sichtbar unten rechts auf jedem Schritt,
      // waehrend er gerade zehn Minuten in die Einrichtung steckt.
      //
      // Vorher gab es diese Bedingung nicht; der Knopf war ueberall sichtbar.
      // Aufgefallen beim Durchspielen des ganzen Ablaufs.
      if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "⏭ Skip (Test)";
      btn.title = "Nur zum Testen: überspringt den aktuellen Schritt mit Platzhalter-Daten";
      btn.style.cssText =
        "position:fixed;bottom:14px;right:14px;z-index:9999;padding:0.5rem 0.9rem;" +
        "background:#111827;color:#fbbf24;border:1.5px dashed #fbbf24;border-radius:10px;" +
        "font:inherit;font-size:0.78rem;font-weight:700;cursor:pointer;opacity:0.82;" +
        "box-shadow:0 6px 18px -6px rgba(0,0,0,0.4);";
      btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
      btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.82"; });
      document.body.appendChild(btn);

      btn.addEventListener("click", () => {
        if (aktuell >= ANZAHL - 1 || istUebergang) return;

        // Webseite-Scan-Schritt: Platzhalter-"Ergebnis" statt echtem Scan.
        const webseiteSchritt = [...linksSchritte].findIndex((el) => el.querySelector("#webseite"));
        if (aktuell === webseiteSchritt) {
          const webseiteFeld = document.getElementById("webseite");
          if (webseiteFeld && !webseiteFeld.value.trim()) webseiteFeld.value = "https://beispiel-firma.ch";
          uebernehmeScan({
            name: daten.name || "Test-Firma", angebot: daten.angebot || "Ein Test-Angebot",
            oeffnungszeiten: "Mo–Fr 9–18 Uhr", adresse: "Teststrasse 1, 8000 Zürich",
            kontakt: "test@beispiel.ch", faq: [], leistungen: ["Testleistung"],
            preise: "", team: "", besonderheiten: "",
          });
        }

        // Charakter-Schritt: Platzhalter-Bilder statt echter Generierung.
        if (aktuell === AGENT_STEP && !(daten.charakterBilder && daten.charakterBilder.idle)) {
          const p = "https://placehold.co/512x512/4F46E5/fff?text=Test";
          daten.charakterBilder = { idle: p, denken: p, sprechen: p, verlegen: p };
          zeigeCharGrid(); // Raster sonst leer, weil das normalerweise erst die echte Generierung anstösst
        }

        // Identitäts-Schritt: Name ist sonst Pflicht (siehe data-next-Listener).
        if (aktuell === IDENTITAET_STEP) {
          const el = document.getElementById("agentName");
          if (el && !el.value.trim()) { el.value = "Test"; daten.agentName = "Test"; }
        }

        sammle();
        zeige(aktuell + 1, 1);
      });
    })();
    // ENDE DEV-SKIP
