// Onboarding-Wizard — Logik zu onboarding-aura.html.
// Aus dem HTML extrahiert (Milestone 1), damit Markup/CSS und Logik getrennt
// wartbar sind. KEINE Logik-Aenderung bei der Extraktion.
    const daten = { id:"", email:"", webseite:"", name:"", angebot:"", oeffnungszeiten:"", adresse:"", kontakt:"", faq:[], weiteres:"", wissen:"", farbe1:"#4F46E5", farbe2:"#FB7185", schrift:"Plus Jakarta Sans", persoenlichkeit:"freundlich", plan:"basis", charakterBilder:null };

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
    let aktuell = 0;

    const progress = document.getElementById("progress");
    for (let i = 0; i < ANZAHL; i++) { const d = document.createElement("div"); d.className = "dot"; progress.appendChild(d); }
    const dots = progress.querySelectorAll(".dot");
    function updateProgress() { dots.forEach((d,i)=>{ d.classList.toggle("done", i<aktuell); d.classList.toggle("aktiv", i===aktuell); }); }

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
          lNeu.hidden = false; rNeu.hidden = false; lNeu.scrollTop = 0;
          gsap.fromTo([lNeu, rNeu], { autoAlpha: 0, x: 24 * richtung }, { autoAlpha: 1, x: 0, duration: 0.32, ease: "power2.out",
            onComplete: () => { istUebergang = false; } });
        }});
      aktuell = n; updateProgress();
      if (n === AGENT_STEP) aktualisiereAgentVorschau(); // Vorschau mit aktuellen Farben
    }
    document.querySelectorAll("[data-next]").forEach(b => b.addEventListener("click", () => { sammle(); zeige(aktuell+1, 1); }));
    document.querySelectorAll("[data-prev]").forEach(b => b.addEventListener("click", () => zeige(aktuell-1, -1)));

    // Überprüfen: Karten auf/zu + "Passt"-Haken
    document.querySelectorAll(".pk-kopf").forEach(k => k.addEventListener("click", () => k.parentElement.classList.toggle("auf")));
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
    function uebernehmeScan(d) {
      daten.name = d.name||""; daten.angebot = d.angebot||"";
      daten.oeffnungszeiten = d.oeffnungszeiten||""; daten.adresse = d.adresse||"";
      daten.kontakt = d.kontakt||""; daten.faq = d.faq||[]; daten.weiteres = d.weiteres||""; daten.wissen = d.wissen||"";
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
    const MAX_DATEI = 4.5 * 1024 * 1024;
    document.getElementById("docs").addEventListener("change", async (e) => {
      const liste = document.getElementById("doc-liste");
      for (const f of e.target.files) {
        const eintrag = document.createElement("div"); eintrag.className = "doc-eintrag";
        eintrag.innerHTML = "<span>"+f.name+"</span><span class='stat'>…</span>"; liste.appendChild(eintrag);
        const stat = eintrag.querySelector(".stat");
        try {
          if (f.size > MAX_DATEI) throw new Error("zu gross");
          const istText = /\.(txt|md|markdown)$/i.test(f.name) || (f.type||"").startsWith("text/");
          if (istText) { const t = await f.text(); daten.weiteres += "\n\n--- "+f.name+" ---\n"+t.trim(); stat.textContent = "✓"; }
          else {
            stat.textContent = "liest";
            const dataUrl = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
            const resp = await fetch("/.netlify/functions/dokument-lesen", { method:"POST", headers:{"content-type":"application/json"},
              body: JSON.stringify({ dateiname:f.name, mediaType:f.type, daten:String(dataUrl).split(",")[1] }) });
            const d = await resp.json(); if (!resp.ok) throw new Error(d.error||"Fehler");
            daten.weiteres += "\n\n--- "+f.name+" (gelesen) ---\n"+(d.text||""); stat.textContent = "✓ gelesen";
          }
        } catch (err) { stat.textContent = "✕"; stat.style.color = "#dc2626"; }
      }
      e.target.value = "";
    });

    // --- Schrift wählen ---
    document.getElementById("schrift").addEventListener("change", (e) => {
      daten.schrift = e.target.value;
      document.getElementById("fontVorschau").style.fontFamily = '"' + e.target.value + '", sans-serif';
    });

    // --- Persönlichkeit wählen ---
    const persChips = document.querySelectorAll(".pers-chip");
    function waehlePers(ton) {
      daten.persoenlichkeit = ton;
      persChips.forEach((c) => c.classList.toggle("aktiv", c.dataset.ton === ton));
      document.getElementById("persHinweis").textContent = TON_HINWEIS[ton] || "";
    }
    persChips.forEach((c) => c.addEventListener("click", () => waehlePers(c.dataset.ton)));
    waehlePers(daten.persoenlichkeit); // Standard vorwählen

    // --- Schritt "Dein Agent": Orb (Basis) vs. eigene Figur (Plus) ---
    const optOrb = document.getElementById("optOrb");
    const optFigur = document.getElementById("optFigur");
    const figurEditor = document.getElementById("figurEditor");
    const vorOrb = document.getElementById("vorOrb");
    const vorFigur = document.getElementById("vorFigur");
    const vorFigurImg = document.getElementById("vorFigurImg");
    const vorLabel = document.getElementById("vorLabel");
    const figurMini = document.getElementById("figurMini");
    let plusFrei = false;

    function setVorschauFarben() {
      [document.getElementById("schrittAgent"), document.querySelector(".schritt-rechts[data-step='6']")].forEach((el) => {
        if (!el) return;
        el.style.setProperty("--vor-f1", daten.farbe1);
        el.style.setProperty("--vor-f2", daten.farbe2);
      });
    }
    function aktualisiereAgentVorschau() {
      setVorschauFarben();
      const bild = daten.charakterBilder && daten.charakterBilder.idle;
      if (daten.plan === "plus" && bild) {
        vorFigurImg.src = bild; vorFigur.hidden = false; vorOrb.hidden = true;
        vorLabel.textContent = "Deine Figur";
        figurMini.textContent = "";
        const im = document.createElement("img"); im.src = bild; im.alt = ""; figurMini.appendChild(im);
      } else {
        vorFigur.hidden = true; vorOrb.hidden = false;
        vorLabel.textContent = daten.plan === "plus" ? "Lade ein Bild hoch oder erstelle einen Charakter" : "Dein Leucht-Orb";
      }
    }
    function waehleTyp(typ) {
      if (typ === "figur" && !plusFrei) { document.getElementById("plusTesten").focus(); return; }
      daten.plan = (typ === "figur") ? "plus" : "basis";
      optOrb.classList.toggle("aktiv", typ === "orb");
      optFigur.classList.toggle("aktiv", typ === "figur");
      figurEditor.hidden = (typ !== "figur");
      aktualisiereAgentVorschau();
    }
    optOrb.addEventListener("click", () => waehleTyp("orb"));
    optFigur.addEventListener("click", () => waehleTyp("figur"));
    document.getElementById("plusTesten").addEventListener("click", () => {
      plusFrei = true;
      optFigur.classList.remove("gesperrt");
      const h = document.getElementById("plusHinweis");
      h.textContent = ""; const ok = document.createElement("span");
      ok.style.color = "var(--gruen)"; ok.style.fontWeight = "600"; ok.textContent = "✓ Plus (Simulation) aktiv";
      h.appendChild(ok);
      waehleTyp("figur");
    });

    // Tabs im Figur-Editor
    document.querySelectorAll("#figurEditor .tab").forEach((t) => t.addEventListener("click", () => {
      document.querySelectorAll("#figurEditor .tab").forEach((x) => x.classList.toggle("aktiv", x === t));
      document.querySelectorAll("#figurEditor .tab-inhalt").forEach((x) => { x.hidden = (x.dataset.tab !== t.dataset.tab); });
    }));

    // Weg 1: Bild hochladen -> ein Bild gilt für alle 4 Ausdrücke (wie der Stub)
    document.getElementById("charBild").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const status = document.getElementById("charBildStatus");
      if (f.size > 4.5 * 1024 * 1024) { status.style.color = "#e11d48"; status.textContent = "Bild ist zu groß (max. 4,5 MB)."; e.target.value = ""; return; }
      const r = new FileReader();
      r.onload = () => {
        const url = r.result;
        daten.charakterBilder = { idle: url, denken: url, sprechen: url, verlegen: url };
        status.style.color = "var(--gruen)"; status.textContent = "✓ Bild übernommen.";
        aktualisiereAgentVorschau();
      };
      r.readAsDataURL(f);
      e.target.value = "";
    });

    // Weg 2: Charakter erstellen -> Stub liefert 4 SVG-Vorschauen + fertige Bild-Prompts
    document.getElementById("charErstellen").addEventListener("click", async () => {
      const beschr = document.getElementById("charBeschr").value.trim();
      const status = document.getElementById("charErstellenStatus");
      if (!beschr) { status.style.color = "#e11d48"; status.textContent = "Bitte kurz beschreiben."; return; }
      const btn = document.getElementById("charErstellen");
      btn.disabled = true; status.style.color = ""; status.textContent = "Erstelle Vorschau…";
      try {
        const res = await fetch("/.netlify/functions/charakter-generieren", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ modus: "text", beschreibung: beschr, farbe: daten.farbe1, akzent: daten.farbe2 }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Fehler");
        daten.charakterBilder = d.bilder;
        aktualisiereAgentVorschau();
        status.style.color = "var(--gruen)";
        status.textContent = d.stub ? "Vorschau erstellt — finale Bilder folgen." : "Erstellt.";
        const box = document.getElementById("charPrompts");
        box.hidden = false; box.textContent = "";
        const lbl = document.createElement("label"); lbl.className = "feld"; lbl.textContent = "Bild-Prompts (z.B. für Higgsfield):";
        box.appendChild(lbl);
        Object.entries(d.prompts || {}).forEach(([z, p]) => {
          const el = document.createElement("div"); el.className = "prompt-box";
          const copy = document.createElement("button"); copy.type = "button"; copy.className = "copy"; copy.textContent = "Kopieren";
          copy.addEventListener("click", () => { navigator.clipboard.writeText(p); copy.textContent = "Kopiert ✓"; });
          const strong = document.createElement("strong"); strong.textContent = z + ": ";
          el.appendChild(copy); el.appendChild(strong); el.appendChild(document.createTextNode(p));
          box.appendChild(el);
        });
      } catch (e) {
        status.style.color = "#e11d48"; status.textContent = "Konnte keine Vorschau erstellen: " + e.message;
      } finally { btn.disabled = false; }
    });

    aktualisiereAgentVorschau(); // Anfangszustand (Orb)

    function sammle() {
      daten.email = (document.getElementById("email")||{}).value || daten.email;
      daten.webseite = (document.getElementById("webseite")||{}).value || daten.webseite;
      daten.name = (document.getElementById("p-name")||{}).value || daten.name;
      daten.angebot = (document.getElementById("p-angebot")||{}).value || daten.angebot;
      daten.oeffnungszeiten = (document.getElementById("p-oeffnung")||{}).value || daten.oeffnungszeiten;
      daten.adresse = (document.getElementById("p-adresse")||{}).value || daten.adresse;
      daten.kontakt = (document.getElementById("p-kontakt")||{}).value || daten.kontakt;
      daten.faq = faqListe.value();
      daten.weiteres = (document.getElementById("p-weiteres")||{}).value || daten.weiteres;
      daten.farbe1 = (document.getElementById("farbe1")||{}).value || daten.farbe1;
      daten.farbe2 = (document.getElementById("farbe2")||{}).value || daten.farbe2;
      // Freitext-Wissen fürs Agenten-Backend; Öffnungszeiten/Adresse/Kontakt/FAQ gehen strukturiert in fakten/faq (siehe "fertig")
      daten.wissen = [daten.angebot, daten.weiteres].filter(Boolean).join("\n\n");
      daten.id = daten.id || (daten.name || daten.webseite || "firma").toLowerCase().replace(/^https?:\/\//,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,24) || "firma";
      document.getElementById("embed-text").textContent =
        '<script src="' + location.origin + '/widget.js" data-firma="' + daten.id + '" data-farbe="' + daten.farbe1 + '" data-farbe2="' + daten.farbe2 + '"><\/script>';
    }
    document.getElementById("copy").addEventListener("click", (e) => {
      navigator.clipboard.writeText(document.getElementById("embed-text").textContent); e.target.textContent = "Kopiert ✓";
    });
    document.getElementById("fertig").addEventListener("click", async () => {
      sammle();
      const status = document.getElementById("speicherStatus");
      const btn = document.getElementById("fertig");
      btn.disabled = true; status.textContent = "Speichern…"; status.style.color = "";
      const fakten = {};
      if (daten.oeffnungszeiten) fakten["Öffnungszeiten"] = daten.oeffnungszeiten;
      if (daten.adresse) fakten["Adresse"] = daten.adresse;
      if (daten.kontakt) fakten["Kontakt"] = daten.kontakt;
      const charakter = { farbe: daten.farbe1, akzent: daten.farbe2, schrift: daten.schrift };
      if (daten.plan === "plus" && daten.charakterBilder && daten.charakterBilder.idle) {
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
      const firma = {
        id: daten.id, name: daten.name || daten.id, email: daten.email, webseite: daten.webseite,
        plan: daten.plan,
        persona: { name: (daten.name ? daten.name + "-Assistent" : "Assistent"), rolle: "der Assistent von " + (daten.name || "der Firma"), ton: (TON_TEXTE[daten.persoenlichkeit] || TON_TEXTE.freundlich), sprache: "Deutsch" },
        fakten, faq: daten.faq, wissen: daten.wissen,
        charakter,
      };
      try {
        await Store.saveFirma(firma);
        Store.setNutzer(daten.email);
        status.style.color = "var(--gruen)"; status.textContent = "Gespeichert! Öffne den Test-Chat…";
        window.open("index.html?firma=" + encodeURIComponent(daten.id), "_blank");
      } catch (e) {
        status.style.color = "#e11d48"; status.textContent = "Konnte nicht gespeichert werden: " + e.message;
      } finally {
        btn.disabled = false;
      }
    });

    gsap.set([linksSchritte[0], rechtsSchritte[0]], { autoAlpha: 1, x: 0 });
    updateProgress();
  