// Onboarding-Wizard — Logik zu onboarding-aura.html.
// Aus dem HTML extrahiert (Milestone 1), damit Markup/CSS und Logik getrennt
// wartbar sind. KEINE Logik-Aenderung bei der Extraktion.
    const daten = { id:"", email:"", webseite:"", name:"", angebot:"", oeffnungszeiten:"", adresse:"", kontakt:"", faq:[], weiteres:"", dokumente:[], farbe1:"#4F46E5", farbe2:"#FB7185", schrift:"Plus Jakarta Sans", persoenlichkeit:"freundlich", agentName:"", agentRolle:"Assistent", agentAnrede:"du", antwortLaenge:"ausgewogen", emojiStil:"dezent", antwortFormat:"absatz", uebergabe:"kontakt", grenzen:"", chatDesign:"auto", chatLayout:"sidebar", plan:"plus", charakterBilder:null };

    // Persönlichkeit -> Ton-Beschreibung (fließt in persona.ton für baueSystemPrompt)
    const TON_TEXTE = {
      professionell: "professionell, kompetent und präzise; sachlich und verbindlich",
      freundlich:    "warm, freundlich und hilfsbereit; geduldig und zugänglich",
      humorvoll:     "locker und humorvoll, mit einem Augenzwinkern — aber immer hilfreich",
      sachlich:      "sachlich, knapp und faktenorientiert, ohne Ausschmückungen",
      motivierend:   "motivierend und begeisternd; ermutigt die Besucher",
      luxurioes:     "gehoben, elegant und exklusiv; gewählte, diskrete Sprache",
    };
    const TON_HINWEIS = {
      professionell: "Kompetent und verbindlich — für seriöse Marken.",
      freundlich:    "Warm und nahbar — der Allrounder.",
      humorvoll:     "Locker mit Augenzwinkern — für nahbare Marken.",
      sachlich:      "Knapp und faktenorientiert — für technische Angebote.",
      motivierend:   "Energiegeladen — für Coaching, Fitness, Bildung.",
      luxurioes:     "Gehoben und exklusiv — für Premium-Marken.",
    };
    const linksSchritte = document.querySelectorAll(".schritt-links");
    const rechtsSchritte = document.querySelectorAll(".schritt-rechts");
    const ANZAHL = linksSchritte.length;
    const AGENT_STEP = [...linksSchritte].findIndex((el) => el.id === "schrittAgent");
    const AUSDRUECKE_STEP = [...linksSchritte].findIndex((el) => el.id === "schrittAusdruecke");
    // Identitäts-Schritt (Name Pflicht + Namensvorschlag) — ID-basiert, damit
    // spätere Seiten-Splits die Schrittnummern verschieben können, ohne zu brechen.
    const IDENTITAET_STEP = [...linksSchritte].findIndex((el) => el.id === "schrittIdentitaet");
    let aktuell = 0;

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

    gsap.to("#glow", { rotation: 360, duration: 34, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
    gsap.to(".w1", { x: 26, y: 36, scale: 1.15, duration: 9, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".w2", { x: -34, y: 26, scale: 1.2, duration: 11, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".w3", { x: 18, y: -26, scale: 1.1, duration: 8, ease: "sine.inOut", repeat: -1, yoyo: true });

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
      if (n === AGENT_STEP) {
        const l = document.getElementById("zuAusdruecken");
        if (l) l.hidden = !(daten.charakterBilder && daten.charakterBilder.idle);
      }
      if (n === ANZAHL - 1) pruefeStartklar(); // Fertig-Schritt: §8 Veröffentlichungs-Checkliste
      // Identitäts-Schritt: Agenten-Name aus dem Firmennamen vorschlagen, falls
      // das FELD leer ist. (daten.agentName ist hier durch den sammle()-Fallback
      // oft schon belegt — entscheidend ist, was der Nutzer im Feld sieht.)
      if (n === IDENTITAET_STEP && daten.name) {
        const el = document.getElementById("agentName");
        if (el && !el.value.trim()) { el.value = daten.name; daten.agentName = daten.name; }
      }
    }
    document.querySelectorAll("[data-next]").forEach(b => b.addEventListener("click", () => {
      // §3: Agenten-Name ist Pflicht — beim Verlassen des Identitäts-Schritts prüfen.
      if (aktuell === IDENTITAET_STEP) {
        const el = document.getElementById("agentName");
        if (el && !el.value.trim()) {
          const h = document.getElementById("agentNameHinweis");
          h.textContent = "Bitte gib deinem Assistenten einen Namen."; h.style.color = "#e11d48";
          el.focus(); return;
        }
      }
      // Ausdrücke-Schritt: erst weiter, wenn die Generierung fertig ist.
      // (Der Charakter-Schritt selbst hat keinen Weiter-Knopf — die Stilwahl
      // im Pop-up führt automatisch hierher, Charakter bleibt Pflicht.)
      if (aktuell === AUSDRUECKE_STEP) {
        if (!(daten.charakterBilder && daten.charakterBilder.idle)) {
          const s = document.getElementById("charZustandStatus");
          if (s) { s.style.color = "#e11d48"; s.textContent = "Die Ausdrücke werden noch erstellt — einen Moment bitte."; }
          return;
        }
      }
      sammle(); zeige(aktuell+1, 1);
    }));
    document.querySelectorAll("[data-prev]").forEach(b => b.addEventListener("click", () => zeige(aktuell-1, -1)));

    // Anmelden: echten Bestätigungs-Link schicken, wenn Supabase konfiguriert ist
    // (sonst Simulation — es geht einfach weiter). Verknüpft die anonyme Sitzung
    // mit der E-Mail, ohne die Nutzer-ID zu wechseln -> Besitz der Firma bleibt.
    // Fire-and-forget: der Ablauf wartet nicht auf die Mail.
    document.getElementById("loginBtn").addEventListener("click", () => {
      const email = (document.getElementById("email").value || "").trim();
      const status = document.getElementById("loginStatus");
      if (!email || !(window.Auth && window.Auth.konfiguriert)) return; // Simulation
      status.style.color = ""; status.textContent = "Bestätigungs-Link wird gesendet…";
      window.Auth.verknuepfeEmail(email, location.origin + "/dashboard.html").then((r) => {
        if (r.ok) { status.style.color = "var(--gruen)"; status.textContent = "✓ Link an " + email + " gesendet — du kannst hier weitermachen."; }
        else { status.style.color = "var(--grau)"; status.textContent = "Konnte den Link nicht senden (" + (r.error || "unbekannt") + ") — Onboarding läuft trotzdem weiter."; }
      });
    });

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
      document.getElementById("v-oeffnung").textContent = kurz(document.getElementById("p-oeffnung").value);
      const k = [document.getElementById("p-adresse").value, document.getElementById("p-kontakt").value].filter(Boolean).join(" · ");
      document.getElementById("v-kontakt").textContent = kurz(k);
      const faqAnzahl = faqListe.value().length;
      document.getElementById("v-faq").textContent = faqAnzahl ? faqAnzahl + (faqAnzahl === 1 ? " Frage definiert" : " Fragen definiert") : "noch keine Frage";
      document.getElementById("v-weiteres").textContent = kurz(document.getElementById("p-weiteres").value);
    }
    ["p-oeffnung","p-adresse","p-kontakt","p-weiteres"].forEach(id =>
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
    // gefunden hat — so sieht die Firma sofort, was ihr Agent noch NICHT weiß.
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
        z.textContent = (ok ? "✓ " : "✗ ") + titel + (ok ? "" : " — bitte ergänzen");
        z.style.color = ok ? "var(--gruen)" : "#b45309";
        box.appendChild(z);
      }
      if (d.hinweis) {
        const h = document.createElement("div");
        h.textContent = "⚠ " + d.hinweis;
        h.style.cssText = "grid-column:1/-1;color:#b45309;margin-top:0.3rem;";
        box.appendChild(h);
      }
      box.hidden = false;
    }
    function uebernehmeScan(d) {
      daten.name = d.name||""; daten.angebot = d.angebot||"";
      daten.oeffnungszeiten = d.oeffnungszeiten||""; daten.adresse = d.adresse||"";
      daten.kontakt = d.kontakt||""; daten.faq = d.faq||[]; daten.weiteres = d.weiteres||""; daten.wissen = d.wissen||"";
      // Milestone 7: zusätzliche Scan-Felder — fließen beim Speichern in die Scan-Quelle.
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
      updatePruefVorschau();
      if (d.farbe1) { daten.farbe1 = d.farbe1; document.getElementById("farbe1").value = d.farbe1; }
      if (d.farbe2) { daten.farbe2 = d.farbe2; document.getElementById("farbe2").value = d.farbe2; }
    }
    document.getElementById("scanBtn").addEventListener("click", async () => {
      const url = document.getElementById("webseite").value.trim();
      if (!url) { alert("Bitte gib deine Webseite ein."); return; }
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
        let d = null;
        for (let versuch = 0; versuch < 60; versuch++) {
          await schlaf(1500);
          let s;
          try {
            const r = await fetch("/.netlify/functions/scan-status?jobId=" + encodeURIComponent(jobId));
            s = await r.json();
          } catch { continue; } // kurzer Netz-Hänger -> einfach weiter pollen
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
        status.textContent = "Konnte die Seite nicht lesen. Du kannst die Infos auch selbst eintragen.";
        loader.classList.add("an"); loader.querySelector(".spinner").style.display = "none";
        btn.textContent = "Weiter ohne Scan"; btn.onclick = () => zeige(3, 1);
      }
    });

    // --- Dokumente hochladen ---
    // Jedes Dokument wird eine EIGENE Wissensquelle (daten.dokumente) — mit
    // Herkunft und Stand, einzeln entfernbar. Nichts wird mehr in das Textfeld
    // "Weitere Infos" gemischt (Milestone 3: Jede Info kennt ihre Herkunft).
    const MAX_DATEI = 4.5 * 1024 * 1024;
    function zeigeDokumente() {
      const liste = document.getElementById("doc-liste");
      liste.textContent = "";
      daten.dokumente.forEach((doc) => {
        const eintrag = document.createElement("div"); eintrag.className = "doc-eintrag";
        const nameEl = document.createElement("span"); nameEl.textContent = doc.titel;
        const stat = document.createElement("span"); stat.className = "stat"; stat.textContent = "✓ gelesen";
        stat.style.color = "var(--gruen)";
        const weg = document.createElement("button"); weg.type = "button"; weg.className = "faq-entfernen";
        weg.style.position = "static"; weg.title = "Entfernen"; weg.textContent = "×";
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
        // Fortschritts-Zeile (Dateiname per textContent — nie innerHTML mit Nutzer-Daten)
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
          stat.textContent = "✕ " + (err.message || "Fehler"); stat.style.color = "#dc2626";
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

    // --- Persönlichkeit (Ton) wählen — NUR die Chips in #persListe ---
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
        kurz: ["Ja, sonntags 10–16 Uhr."],
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
    // Chat-Design: "Automatisch" ist Standard (Farben von der Website). "Selbst
    // anpassen" blendet Farb-/Schrift-Steuerung ein. Keine Startansicht-Wahl mehr
    // — das Widget schaltet auf dem Handy von selbst auf Vollbild (chatLayout bleibt
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
    document.getElementById("uebergabe").addEventListener("change", (e) => { daten.uebergabe = e.target.value; });
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
        vorLabel.textContent = "Noch kein Charakter — erstelle ihn links";
      }
    }
    aktualisiereAgentVorschau(); // Startzustand der Vorschau setzen

    // Stilwahl-Pop-up: öffnet sich, wenn die Varianten fertig sind. Schliessen
    // ist erlaubt — die Varianten bleiben über den Link auf der Seite erreichbar
    // (keine Bild-Credits verlieren). Funktions-Deklaration: wird auch im
    // data-next-Handler weiter oben gebraucht.
    const stilModal = document.getElementById("stilModal");
    function oeffneStilModal() { if (charRichtungen.length) stilModal.hidden = false; }
    function schliesseStilModal() { stilModal.hidden = true; }
    document.getElementById("stilModalZu").addEventListener("click", schliesseStilModal);
    stilModal.addEventListener("click", (e) => { if (e.target === stilModal) schliesseStilModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !stilModal.hidden) schliesseStilModal(); });
    document.getElementById("charVariantenOeffnen").addEventListener("click", oeffneStilModal);
    // "4 neue Varianten": Änderungswunsch fliesst in die Beschreibung ein,
    // dann läuft die Generierung erneut (Pop-up öffnet sich automatisch wieder).
    document.getElementById("richtungenNeu").addEventListener("click", () => {
      const anpassung = document.getElementById("richtungenAnpassung").value.trim();
      const beschrFeld = document.getElementById("charBeschr");
      if (anpassung) {
        beschrFeld.value = (beschrFeld.value.trim() ? beschrFeld.value.trim() + " — " + anpassung : anpassung).slice(0, 500);
        document.getElementById("richtungenAnpassung").value = "";
      }
      schliesseStilModal();
      starteRichtungen({
        beschreibung: beschrFeld.value.trim(),
        status: document.getElementById("charErstellenStatus"),
        btn: document.getElementById("charErstellen"),
      });
    });

    function balken(id, an) { document.getElementById(id).classList.toggle("an", !!an); }

    // --- Charakter-Generierung (Milestone 6: echte Bilder via Background-Job) ---
    // Gleiches Muster wie der Scan: Job anstoßen (202) -> scan-status pollen.
    // Generieren dauert 30-90s (4 Bilder), Edits ~10-30s (1 Bild).
    const CHAR_ZUSTAENDE = ["idle", "denken", "sprechen", "verlegen"];
    const CHAR_LABELS = { idle: "Ruhe", denken: "Denken", sprechen: "Sprechen", verlegen: "Verlegen" };
    let charReferenzBild = null; // Data-URL des Uploads, dient auch als KI-Vorlage
    let charRichtungen = [];
    let gewaehltRichtung = null;

    async function charJob(payload, maxVersuche) {
      const jobId = "char-" + ((window.crypto && crypto.randomUUID) ? crypto.randomUUID()
                     : Date.now() + "-" + Math.random().toString(36).slice(2));
      const start = await fetch("/.netlify/functions/charakter-background", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, firmaId: daten.id || undefined, farbe: daten.farbe1, ...payload }),
      });
      if (start.status === 429) throw new Error("Limit erreicht — bitte später erneut versuchen.");
      if (start.status !== 202 && !start.ok) throw new Error("Konnte nicht gestartet werden.");
      for (let versuch = 0; versuch < (maxVersuche || 90); versuch++) {
        await schlaf(2000);
        let s;
        try {
          const r = await fetch("/.netlify/functions/scan-status?jobId=" + encodeURIComponent(jobId));
          s = await r.json();
        } catch { continue; } // kurzer Netz-Hänger -> weiter pollen
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
        im.style.cssText = "width:100%;aspect-ratio:1;object-fit:contain;border-radius:9px;background:#fafafa;";
        const lbl = document.createElement("div");
        lbl.textContent = CHAR_LABELS[z]; lbl.style.cssText = "font-size:0.82rem;font-weight:600;margin:0.45rem 0 0.5rem;color:#374151;";
        // Änderungs-Eingabe als mehrzeiliger Textbereich (Platz für 2–3 Sätze),
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
            const erg = await charJob({ aktion: "bearbeiten", bild: bilder[z], anweisung, zustand: z }, 45);
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

    // Varianten ins Pop-up rendern — jede Karte hat ihren eigenen
    // Bestätigen-Knopf, der die Wahl direkt auslöst.
    function zeigeRichtungen(richtungen) {
      const grid = document.getElementById("richtungsGrid");
      charRichtungen = Array.isArray(richtungen) ? richtungen : [];
      gewaehltRichtung = null;
      grid.textContent = "";
      charRichtungen.forEach((richtung) => {
        const karte = document.createElement("div");
        karte.className = "richtungs-karte";
        const bild = document.createElement("img");
        bild.src = richtung.bild; bild.alt = richtung.label;
        const fuss = document.createElement("div"); fuss.className = "richtungs-fuss";
        const label = document.createElement("span"); label.textContent = richtung.label;
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "btn-waehlen"; btn.textContent = "✓ Diese wählen";
        btn.addEventListener("click", () => generiereZustaendeAusRichtung(richtung));
        fuss.append(label, btn);
        karte.append(bild, fuss);
        grid.appendChild(karte);
      });
      document.getElementById("charVariantenZeile").hidden = false;
    }

    // Schritt 1: Beschreibung und/oder Bild-Vorlage -> 4 Stil-Varianten,
    // danach öffnet sich das Stilwahl-Pop-up.
    async function starteRichtungen({ beschreibung, status, btn }) {
      btn.disabled = true; status.style.color = ""; balken("charBalken", true);
      status.textContent = "Wir entwickeln vier Stil-Varianten deiner Figur — das dauert ungefähr eine Minute…";
      try {
        const erg = await charJob({ aktion: "richtungen", beschreibung, bild: charReferenzBild || undefined }, 120);
        zeigeRichtungen(erg.richtungen);
        status.style.color = "var(--gruen)";
        status.textContent = "✓ Deine Varianten sind bereit.";
        oeffneStilModal();
      } catch (e) {
        status.style.color = "#e11d48";
        status.textContent = "Konnte die Varianten nicht erstellen: " + e.message;
      } finally {
        balken("charBalken", false);
        btn.disabled = false;
        if (charRichtungen.length) btn.textContent = "↻ Neue Varianten erstellen";
      }
    }

    // Schritt 2 (Bestätigung einer Variante im Pop-up): sofort auf die
    // Ausdrücke-Seite wechseln; die Bilder erscheinen dort, sobald sie fertig sind.
    let zustaendeLaufen = false;
    async function generiereZustaendeAusRichtung(richtung) {
      if (!richtung || zustaendeLaufen) return;
      zustaendeLaufen = true;
      gewaehltRichtung = richtung;
      const beschreibung = document.getElementById("charBeschr").value.trim();
      const status = document.getElementById("charZustandStatus");
      document.querySelectorAll("#richtungsGrid .btn-waehlen").forEach((b) => { b.disabled = true; });
      schliesseStilModal();
      zeige(AUSDRUECKE_STEP, 1);
      document.getElementById("andereRichtungZeile").hidden = false;
      document.getElementById("charGrid").hidden = true;
      status.style.color = ""; balken("zustaendeBalken", true);
      status.textContent = "Die Ausdrücke deiner Figur werden erzeugt — noch etwa eine Minute…";
      // Vorfreude: die gewählte Variante während des Wartens auf der Seite zeigen.
      document.getElementById("gewaehlteVorschauImg").src = richtung.bild;
      document.getElementById("gewaehlteVorschau").hidden = false;
      vorFigurImg.src = richtung.bild; vorFigurImg.style.visibility = "visible";
      vorLabel.textContent = "Dein Charakter entsteht…";
      try {
        const erg = await charJob({ aktion: "zustaende", beschreibung, bild: richtung.bild }, 120);
        daten.charakterBilder = erg.bilder;
        status.style.color = "var(--gruen)";
        status.textContent = "✓ Fertig! Jeder Ausdruck lässt sich unten gezielt anpassen.";
        document.getElementById("gewaehlteVorschau").hidden = true;
        zeigeCharGrid(); aktualisiereAgentVorschau();
      } catch (e) {
        status.style.color = "#e11d48";
        status.textContent = "Konnte die Ausdrücke nicht erstellen: " + e.message + " — wähle nochmal eine Richtung.";
      } finally {
        balken("zustaendeBalken", false);
        zustaendeLaufen = false;
        document.querySelectorAll("#richtungsGrid .btn-waehlen").forEach((b) => { b.disabled = false; });
        // Charakter ist da -> Rückkehrer-Link auf der Erstell-Seite freischalten.
        const l = document.getElementById("zuAusdruecken");
        if (l && daten.charakterBilder && daten.charakterBilder.idle) l.hidden = false;
      }
    }

    // Bild-Upload: dient als Vorlage für die Varianten — ODER (dezenter
    // Zweitweg) direkt als Figur, ganz ohne KI.
    document.getElementById("charBild").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const status = document.getElementById("charBildStatus");
      if (f.size > 4.5 * 1024 * 1024) { status.style.color = "#e11d48"; status.textContent = "Bild ist zu groß (max. 4,5 MB)."; e.target.value = ""; return; }
      const r = new FileReader();
      r.onload = () => {
        charReferenzBild = r.result;
        status.style.color = "var(--gruen)";
        status.textContent = "✓ „" + f.name + "“ übernommen — fliesst als Vorlage in die Varianten ein.";
        document.getElementById("charDirektZeile").hidden = false;
      };
      r.readAsDataURL(f);
      e.target.value = "";
    });
    document.getElementById("charDirekt").addEventListener("click", () => {
      if (!charReferenzBild) return;
      daten.charakterBilder = { idle: charReferenzBild, denken: charReferenzBild, sprechen: charReferenzBild, verlegen: charReferenzBild };
      const status = document.getElementById("charZustandStatus");
      status.style.color = ""; status.textContent = "Dein Bild wird für alle Ausdrücke verwendet — du kannst es unten per Anweisung variieren.";
      zeigeCharGrid(); aktualisiereAgentVorschau();
      zeige(AUSDRUECKE_STEP, 1);
    });

    // "4 Varianten erstellen": Beschreibung ODER Bild-Vorlage reicht.
    document.getElementById("charErstellen").addEventListener("click", () => {
      const beschr = document.getElementById("charBeschr").value.trim();
      const status = document.getElementById("charErstellenStatus");
      if (!beschr && !charReferenzBild) {
        status.style.color = "#e11d48";
        status.textContent = "Beschreibe deine Figur kurz oder lade ein Bild als Vorlage hoch.";
        return;
      }
      starteRichtungen({ beschreibung: beschr, status, btn: document.getElementById("charErstellen") });
    });
    document.getElementById("andereRichtung").addEventListener("click", () => {
      zeige(AGENT_STEP, -1);
      oeffneStilModal();
    });
    document.getElementById("zuAusdruecken").addEventListener("click", () => zeige(AUSDRUECKE_STEP, 1));

    // §8 Veröffentlichungs-Checkliste (+ §2 Warnung bei fehlenden kritischen Daten).
    // Vor dem Live-Gehen sieht die Firma gebündelt, was der Agent schon kann und was
    // ihm fehlt. Kritische Lücken (Name, Angebot, Wissen) lösen eine Warnung aus — der
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
        z.textContent = (ok ? "✓ " : (kritischFehlt ? "✗ " : "○ ")) + titel;
        z.style.color = ok ? "var(--gruen)" : (kritischFehlt ? "#b45309" : "var(--grau)");
        liste.appendChild(z);
      };
      for (const [t, ok] of kritisch) zeile(t, ok, true);
      for (const [t, ok] of empfohlen) zeile(t, ok, false);
      const fehlendKritisch = kritisch.filter(([, ok]) => !ok).map(([t]) => t);
      if (fehlendKritisch.length) {
        banner.textContent = "⚠ Bevor du live gehst, fehlen wichtige Infos: " +
          fehlendKritisch.join(", ") + ". Der Agent funktioniert trotzdem, aber ergänze das " +
          "am besten jetzt (zurück) oder später im Dashboard.";
        banner.style.color = "#b45309";
      } else {
        banner.textContent = "✓ Startklar — dein Agent kennt alles Wichtige.";
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
      daten.farbe1 = wert("farbe1") || daten.farbe1;
      daten.farbe2 = wert("farbe2") || daten.farbe2;
      daten.uebergabe = wert("uebergabe") || daten.uebergabe;
      daten.grenzen = wert("agentGrenzen");
      // Agenten-Identität (§3): Name Pflicht (mit Firmenname als Fallback),
      // Rolle + Anrede aus den Feldern.
      daten.agentName = wert("agentName") || daten.name || "Assistent";
      daten.agentRolle = wert("agentRolle") || daten.agentRolle || "Assistent";
      // ID erst vergeben, wenn es eine echte Quelle (Name/Webseite) gibt.
      // sammle() läuft bei JEDEM Weiter-Klick — auch ganz am Anfang, wenn noch
      // alles leer ist. Ohne diese Bedingung bekäme jede Firma die ID "firma"
      // (klebt wegen daten.id || …) und alle Kunden überschrieben sich gegenseitig.
      if (!daten.id && (daten.name || daten.webseite)) {
        daten.id = (daten.name || daten.webseite).toLowerCase().replace(/^https?:\/\//,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,24);
      }
      document.getElementById("embed-text").textContent =
        '<script src="' + location.origin + '/widget.js" data-firma="' + daten.id + '" data-farbe="' + daten.farbe1 + '" data-farbe2="' + daten.farbe2 + '"><\/script>';
    }
    document.getElementById("copy").addEventListener("click", (e) => {
      navigator.clipboard.writeText(document.getElementById("embed-text").textContent); e.target.textContent = "Kopiert ✓";
    });
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
      const charakter = { farbe: daten.farbe1, akzent: daten.farbe2, schrift: daten.schrift };
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
      // Nutzer geprüften Feldern — das ist das Wissen, aus dem der Agent lebt.
      const leistungen = Array.isArray(daten.leistungen) ? daten.leistungen : [];
      const scanText = [
        daten.angebot && ("Angebot: " + daten.angebot),
        leistungen.length && ("Leistungen:\n- " + leistungen.join("\n- ")),
        daten.preise && ("Preise: " + daten.preise),
        daten.team && ("Team: " + daten.team),
        daten.besonderheiten && ("Besonderheiten: " + daten.besonderheiten),
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
          grenzen: daten.grenzen,
        },
        fakten, faq: daten.faq, wissensquellen,
        // Jeder Agent kann von Anfang an Kontaktanfragen aufnehmen (Lead-Capture).
        faehigkeiten: ["kontakt"],
        charakter: { ...charakter, chatDesign: daten.chatDesign, chatLayout: daten.chatLayout },
      };
      try {
        await Store.saveFirma(firma);
        Store.setNutzer(daten.email);
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

    // Bezahlung findet VOR dem Onboarding statt — kein Checkout mehr in
    // Schritt 9. Fallback für Nicht-Zahler: Abo-Bereich im Dashboard.

    gsap.set([linksSchritte[0], rechtsSchritte[0]], { autoAlpha: 1, x: 0 });
    updateProgress();
    syncSzenenVideos(0);
  
