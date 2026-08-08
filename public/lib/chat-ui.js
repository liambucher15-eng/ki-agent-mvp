// Gemeinsame Chat-Logik für die volle Seite (index.html) UND das Einbett-Widget
// (widget-frame.html). Kapselt den Sende-Ablauf, das Deuten der Antwort (verlegen
// bei "weiss nicht", sonst sprechen), die Nachrichten-Bubbles und die
// Vorschlags-Chips — damit sich diese Logik nicht an zwei Stellen auseinanderentwickelt.
//
// Was PRO SEITE unterschiedlich ist (Avatar-DOM, Tipp-Anzeige), wird als Callback
// übergeben. So bleibt das Modul frei von seitenspezifischem HTML.

window.ChatUI = (function () {
  // Wirkt die Antwort unsicher? -> Figur schaut dann verlegen.
  function istUnsicher(text) {
    return /wei(ss|ß).{0,6}nicht|leider|nicht sicher|kann ich (dir )?nicht/i.test(text);
  }

  // Vorschlags-Chips: aus den Firmen-Daten sinnvolle Einstiegsfragen ableiten.
  function vorschlaegeAus(firma) {
    const v = [];
    const faq = firma && firma.faq;
    if (Array.isArray(faq)) faq.slice(0, 2).forEach((x) => { if (x && x.frage) v.push(x.frage); });
    const fakten = (firma && firma.fakten) || {};
    if (fakten["Öffnungszeiten"]) v.push("Wann habt ihr offen?");
    if (fakten["Adresse"] || fakten["Standort"] || fakten["Kontakt"]) v.push("Wie erreiche ich euch?");
    if (!v.length) { v.push("Was bietet ihr an?"); v.push("Wie erreiche ich euch?"); }
    return v.slice(0, 4);
  }

  // Chip-Styles einmal pro Seite injizieren (nutzt die Marken-Farbe --farbe).
  let stilDa = false;
  function sorgeFuerStil() {
    if (stilDa) return;
    stilDa = true;
    const s = document.createElement("style");
    s.textContent =
      ".ki-vorschlaege{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 2px}" +
      // Kein Rahmen mehr (bewusste Design-Entscheidung): die Fuellung ist dafuer
      // kraeftiger, sonst waere der Chip auf weissem Grund kaum zu sehen.
      ".ki-vorschlag{font:inherit;font-size:0.82rem;cursor:pointer;padding:7px 13px;border-radius:999px;" +
      "border:0;" +
      "background:color-mix(in srgb,var(--farbe,#4F46E5) 12%,#fff);color:var(--farbe,#4F46E5);" +
      "box-shadow:0 2px 6px -4px color-mix(in srgb,var(--farbe,#4F46E5) 60%,transparent);" +
      "transition:background .18s,color .18s,transform .18s,box-shadow .18s}" +
      ".ki-vorschlag:hover{background:var(--farbe,#4F46E5);color:#fff;transform:translateY(-1px);" +
      "box-shadow:0 5px 12px -5px color-mix(in srgb,var(--farbe,#4F46E5) 70%,transparent)}";
    document.head.appendChild(s);
  }

  // ── Produktkarten ─────────────────────────────────────────────────────────
  // "Der Stuhl Lund passt dazu, 249 €" liest man weg. Eine Karte mit Namen,
  // Preis und Link ist ein Weg, den man geht. Deshalb bekommen Produktvorschläge
  // eine eigene Darstellung statt im Fliesstext unterzugehen.
  //
  // Bewusst per DOM aufgebaut, nicht per innerHTML: Name, Preis und Grund
  // stammen aus einer Modell-Antwort. textContent kann nichts ausführen,
  // eingesetzter Markup-Text bliebe Text.
  let kartenStilDa = false;
  function sorgeFuerKartenStil() {
    if (kartenStilDa) return;
    kartenStilDa = true;
    const s = document.createElement("style");
    s.textContent =
      ".ki-karten{display:flex;flex-direction:column;gap:10px;margin:10px 0 2px;align-self:stretch}" +
      // Die Karte ist ein Kasten mit Bild links und Text rechts — wie eine
      // Produktkachel im Shop, nur klein. Kein <a> um das Ganze: der Knopf ist
      // das Klickziel, sonst weiss man nicht, was der Klick auslöst.
      ".ki-karte{display:flex;gap:11px;padding:11px;border-radius:12px;background:#fff;" +
      "box-shadow:0 1px 2px rgba(15,23,42,.06),0 6px 16px -10px rgba(15,23,42,.45)}" +
      // Feste Bildgrösse: unterschiedlich hohe Karten wirken unruhig, und die
      // Höhe darf nicht davon abhängen, welches Bild gerade lädt.
      ".ki-karte-bild{width:64px;height:64px;flex-shrink:0;border-radius:9px;object-fit:cover;" +
      "background:color-mix(in srgb,var(--farbe,#4F46E5) 7%,#f1f5f9);display:block}" +
      // Platzhalter, wenn es kein Bild gibt oder es nicht lädt: die Initiale des
      // Produkts. Nie ein leeres Loch und nie ein kaputtes Bild-Symbol.
      ".ki-karte-platz{display:grid;place-items:center;font-weight:700;font-size:1.5rem;" +
      "color:var(--farbe,#4F46E5)}" +
      ".ki-karte-text{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}" +
      ".ki-karte-name{font-weight:650;font-size:0.9rem;line-height:1.25}" +
      ".ki-karte-preis{font-weight:700;font-size:0.9rem;color:#0f172a}" +
      ".ki-karte-grund{font-size:0.79rem;line-height:1.35;color:#64748b}" +
      // Der Knopf steht bewusst am Ende und trägt die Markenfarbe: er ist das
      // Einzige, was der Besucher hier anklicken kann.
      ".ki-karte-knopf{display:inline-block;margin-top:5px;align-self:flex-start;" +
      "font:inherit;font-size:0.78rem;font-weight:600;text-decoration:none;" +
      "padding:6px 13px;border-radius:999px;border:0;cursor:pointer;" +
      "background:var(--farbe,#4F46E5);color:#fff;transition:opacity .18s,transform .18s}" +
      ".ki-karte-knopf:hover{opacity:.88;transform:translateY(-1px)}";
    document.head.appendChild(s);
  }

  // Baut die Karten: Bild links, Name/Preis/Grund rechts, darunter der Knopf.
  //
  // Der Knopf ist das EINZIGE Klickziel, nicht die ganze Karte. Bei einer
  // klickbaren Karte weiss man nie, was der Klick auslöst — beim beschrifteten
  // Knopf schon. Fehlt der Link, entfällt der Knopf: einer, der nirgends
  // hinführt, ist schlimmer als keiner.
  function baueKarten(produkte) {
    sorgeFuerKartenStil();
    const box = document.createElement("div");
    box.className = "ki-karten";
    for (const p of produkte) {
      const karte = document.createElement("div");
      karte.className = "ki-karte";

      // Bild oder Initiale. Lädt das Bild nicht (tote URL, Netzfehler), wird
      // still auf die Initiale gewechselt — ein kaputtes Bild-Symbol in einer
      // Empfehlung sieht nach Pfusch aus.
      const platzhalter = () => {
        const d = document.createElement("div");
        d.className = "ki-karte-bild ki-karte-platz";
        d.textContent = (p.name.trim().charAt(0) || "•").toUpperCase();
        d.setAttribute("aria-hidden", "true");
        return d;
      };
      if (p.bild) {
        const img = document.createElement("img");
        img.className = "ki-karte-bild";
        img.src = p.bild;
        img.alt = "";           // der Name steht daneben — sonst doppelt vorgelesen
        // Bewusst KEIN loading="lazy": höchstens drei kleine Bilder, die sofort
        // sichtbar sind. Lazy sparte hier nichts und liess die Karten messbar
        // einen Moment leer stehen.
        img.decoding = "async";
        img.addEventListener("error", () => {
          if (img.parentNode) img.parentNode.replaceChild(platzhalter(), img);
        });
        karte.appendChild(img);
      } else {
        karte.appendChild(platzhalter());
      }

      const text = document.createElement("div");
      text.className = "ki-karte-text";
      const name = document.createElement("div");
      name.className = "ki-karte-name";
      name.textContent = p.name;
      text.appendChild(name);
      if (p.preis) {
        const preis = document.createElement("div");
        preis.className = "ki-karte-preis";
        preis.textContent = p.preis;
        text.appendChild(preis);
      }
      const grund = document.createElement("div");
      grund.className = "ki-karte-grund";
      grund.textContent = p.grund;
      text.appendChild(grund);

      if (p.url) {
        const knopf = document.createElement("a");
        knopf.className = "ki-karte-knopf";
        knopf.href = p.url;
        // Das Widget lebt im iframe — ohne _top öffnete der Link IM Chatfenster.
        knopf.target = "_top";
        knopf.rel = "noopener";
        knopf.textContent = "Ansehen";
        text.appendChild(knopf);
      }
      karte.appendChild(text);
      box.appendChild(karte);
    }
    return box;
  }

  // Spracheingabe (Web Speech API). Aktiviert den Mikrofon-Knopf, wenn der Browser
  // es kann; sonst wird der Knopf ausgeblendet. Gesprochenes landet live im
  // Eingabefeld — abgeschickt wird bewusst NICHT automatisch (Nutzer prüft/ergänzt).
  let micStilDa = false;
  function sorgeFuerMicStil() {
    if (micStilDa) return;
    micStilDa = true;
    const s = document.createElement("style");
    s.textContent =
      // Kein Rahmen: getoente Fuellung uebernimmt die Abgrenzung.
      ".ki-mic{flex-shrink:0;width:40px;height:40px;border:0;border-radius:10px;" +
      "background:color-mix(in srgb,var(--farbe,#4F46E5) 8%,#fff);color:#6b7280;" +
      "cursor:pointer;display:flex;align-items:center;justify-content:center;" +
      "transition:color .15s,background .15s}" +
      ".ki-mic:hover{color:var(--farbe,#4F46E5);background:color-mix(in srgb,var(--farbe,#4F46E5) 16%,#fff)}" +
      ".ki-mic.hoert{color:#fff;background:#ef4444;animation:ki-mic-puls 1.2s ease-in-out infinite}" +
      "@keyframes ki-mic-puls{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}";
    document.head.appendChild(s);
  }
  function spracheAn(mic, input) {
    if (!mic) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { mic.style.display = "none"; return; } // Browser kann's nicht
    sorgeFuerMicStil();
    let rec = null, laeuft = false;
    mic.addEventListener("click", () => {
      if (laeuft && rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = "de-DE";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onstart = () => { laeuft = true; mic.classList.add("hoert"); };
      rec.onresult = (e) => {
        let t = "";
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        input.value = t;
      };
      rec.onerror = () => { laeuft = false; mic.classList.remove("hoert"); };
      rec.onend = () => { laeuft = false; mic.classList.remove("hoert"); input.focus(); };
      try { rec.start(); } catch (e) {}
    });
  }

  // ── Platz-Regler für die Charakter-Figur ─────────────────────────────────
  // Zielkonflikt: Der Gesprächsverlauf soll ohne Scrollen lesbar sein, die Figur
  // soll aber gross und präsent bleiben, damit man das Gefühl hat, mit jemandem
  // zu sprechen. Beides gleichzeitig geht nicht, sobald der Text länger wird.
  //
  // Lösung: Die Figur gibt Platz ab, aber nur genau dann, wenn der Verlauf ihn
  // wirklich braucht (der Chat überläuft), in ruhigen Stufen und niemals unter
  // die letzte Stufe. So bleibt sie immer eine Figur und wird nie zum Symbol
  // neben einem Textfeld. Innerhalb eines Gesprächs wächst sie nie zurück —
  // das verhindert ein Zappeln zwischen zwei Grössen.
  //
  // cfg: buehne (Element, das --figur trägt), chat (scrollender Verlauf),
  //      stufen (CSS-Längen, grösste zuerst; die letzte ist die Untergrenze)
  //      aktiv? (optional) — liefert false, wenn gar nicht geregelt werden soll
  //             (z.B. im Vollbild, wo die Figur eine eigene Spalte hat und
  //             deshalb nie schrumpfen muss)
  function figurRegler(cfg) {
    const buehne = cfg.buehne, chat = cfg.chat;
    const stufen = cfg.stufen || [];
    // Etwas länger als die CSS-Übergangszeit (0.35s): erst wenn die Figur ihre
    // neue Grösse wirklich erreicht hat, ist die Messung des Verlaufs gültig.
    const UEBERGANG = 420;
    let stufe = -1;

    function setze(i) {
      if (i <= stufe || i >= stufen.length || !buehne) return false;
      stufe = i;
      buehne.style.setProperty("--figur", stufen[i]);
      return true;
    }
    // Massstab ist die NEUESTE Nachricht, nicht der ganze Verlauf. Ein Verlauf
    // laeuft zwangslaeufig irgendwann ueber, sobald er Geschichte hat — daran
    // die Figur zu messen hiesse, sie nach der ersten laengeren Antwort fuer
    // immer auf die Untergrenze zu druecken. Gefragt ist nur: kann man das
    // gerade Gesagte in einem Blick lesen? Zurueckscrollen in aeltere
    // Nachrichten ist normal und kostet die Figur keinen Platz.
    function neuesteNachrichtPasstNicht() {
      const letzte = chat.lastElementChild;
      if (!letzte) return false;
      // Ist der Verlauf gar nicht sichtbar (z.B. Begruessungszustand, in dem nur
      // die Sprechblase zaehlt), gibt es nichts zu messen. Ohne diese Bremse
      // rechnet der Regler mit clientHeight 0 minus Polsterung einen NEGATIVEN
      // Platz aus, haelt das fuer "viel zu eng" und schrumpft die Figur sofort
      // auf die Untergrenze — genau der Fehler, der die Figur winzig machte.
      if (chat.clientHeight <= 0) return false;
      // Gegen den INHALTSBEREICH messen, nicht gegen clientHeight: dort zaehlt
      // die Innenpolsterung mit, und der Regler haette zu frueh aufgehoert.
      const stil = getComputedStyle(chat);
      // SICHERHEITSABSTAND: Zum Messzeitpunkt ist das Layout noch in Bewegung
      // (Buehne wechselt gerade ihre Groesse), der Platz schrumpft danach oft
      // noch um ein paar Pixel. Ohne Reserve entscheidet der Regler bei einer
      // knapp passenden Antwort "passt" — und sie ragt dann doch unten raus.
      const RESERVE = 12;
      const platz = chat.clientHeight
        - parseFloat(stil.paddingTop || 0) - parseFloat(stil.paddingBottom || 0) - RESERVE;
      return letzte.getBoundingClientRect().height > platz;
    }
    function pruefe() {
      if (!buehne || !chat) return;
      if (cfg.aktiv && !cfg.aktiv()) return;
      if (!neuesteNachrichtPasstNicht()) return;
      if (setze(stufe + 1)) {
        setTimeout(() => {
          // Nach dem Verkleinern ans Ende scrollen: der Platz ist neu verteilt,
          // die vorherige Scroll-Position zeigt sonst mitten in die Antwort.
          chat.scrollTop = chat.scrollHeight;
          pruefe();
        }, UEBERGANG);
      }
    }
    return {
      pruefe,
      // Für einen Neustart des Gesprächs: zurück auf die CSS-Grösse.
      zuruecksetzen() { stufe = -1; if (buehne) buehne.style.removeProperty("--figur"); },
    };
  }

  // Startet die Chat-Steuerung und hängt den Absende-Handler ans Formular.
  // cfg:
  //   chat, form, input, send   – DOM-Elemente
  //   firmaId                    – welche Firma
  //   avatar(zustand, dauer)     – Avatar-Reaktion (seitenspezifisch)
  //   tipptAn?()  -> Element     – Tipp-Anzeige einfügen (Standard: Text-Bubble)
  //   holeFirmaConfig?() -> obj  – optionaler Entwurf/Vorschau-Config fürs Backend
  //   seiteInfo?  { pfad, titel } – auf welcher Unterseite ist der Besucher
  //   chipsZiel?  Element         – wohin die Vorschlags-Chips (Standard: chat)
  //   onFrage?(text)              – Besucher hat gefragt (für die Charakter-Bühne)
  //   onAntwort?(text, unsicher)  – Agent hat geantwortet (Bühne/Stimme steuern)
  //   nachNachricht?()            – nach JEDER Bubble (Platz-Regler, s. figurRegler)
  // Rückgabe: { addBubble, messages, zeigeVorschlaege }
  function starten(cfg) {
    const messages = [];
    let vorschlaegeEl = null;

    function addBubble(text, who) {
      const div = document.createElement("div");
      div.className = "msg " + who;
      div.textContent = text;
      cfg.chat.appendChild(div);
      cfg.chat.scrollTop = cfg.chat.scrollHeight;
      if (cfg.nachNachricht) cfg.nachNachricht();
      return div;
    }
    function tipptAnzeigen() {
      return cfg.tipptAn ? cfg.tipptAn() : addBubble("tippt…", "bot meta");
    }
    function entferneVorschlaege() {
      if (vorschlaegeEl) { vorschlaegeEl.remove(); vorschlaegeEl = null; }
    }
    function zeigeVorschlaege(liste) {
      if (!liste || !liste.length) return;
      sorgeFuerStil();
      entferneVorschlaege();
      const box = document.createElement("div");
      box.className = "ki-vorschlaege";
      liste.slice(0, 4).forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ki-vorschlag";
        b.textContent = t;
        b.addEventListener("click", () => {
          cfg.input.value = t;
          cfg.form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        });
        box.appendChild(b);
      });
      const ziel = cfg.chipsZiel || cfg.chat;
      ziel.appendChild(box);
      cfg.chat.scrollTop = cfg.chat.scrollHeight;
      vorschlaegeEl = box;
    }

    cfg.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = cfg.input.value.trim();
      if (!text) return;

      entferneVorschlaege(); // Chips verschwinden, sobald das Gespräch beginnt
      addBubble(text, "user");
      messages.push({ role: "user", content: text });
      cfg.input.value = "";
      cfg.send.disabled = true;
      if (cfg.onFrage) cfg.onFrage(text);

      cfg.avatar("denken");
      const tippt = tipptAnzeigen();

      try {
        const res = await fetch("/.netlify/functions/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages,
            firmaId: cfg.firmaId,
            firmaConfig: cfg.holeFirmaConfig ? cfg.holeFirmaConfig() : null,
            seiteInfo: cfg.seiteInfo || null,
          }),
        });
        const data = await res.json();
        tippt.remove();

        if (!res.ok) {
          addBubble("Entschuldige, da ging gerade etwas schief. Versuch es bitte nochmal.", "bot meta");
          cfg.avatar("verlegen", 2500);
        } else {
          addBubble(data.reply, "bot");
          messages.push({ role: "assistant", content: data.reply });
          // Produktvorschläge als Karten UNTER die Antwort. Sie gehören nicht in
          // den Gesprächsverlauf für das Modell — es hat sie ja selbst erzeugt.
          if (Array.isArray(data.produkte) && data.produkte.length) {
            cfg.chat.appendChild(baueKarten(data.produkte));
            cfg.chat.scrollTop = cfg.chat.scrollHeight;
            if (cfg.nachNachricht) cfg.nachNachricht();
          }
          // Seiten-Aktion (zeigen/öffnen) an die Seite weiterreichen. Der Chat
          // selbst führt sie nicht aus — er sitzt im iframe und käme gar nicht
          // an die Seite heran. Wer sie ausführt, prüft sie noch einmal.
          if (data.seitenAktion && cfg.onSeitenAktion) {
            cfg.onSeitenAktion(data.seitenAktion);
          }
          const unsicher = istUnsicher(data.reply);
          cfg.avatar(unsicher ? "verlegen" : "sprechen", 3000);
          if (cfg.onAntwort) cfg.onAntwort(data.reply, unsicher);
        }
      } catch (err) {
        tippt.remove();
        addBubble("Verbindungsfehler. Bist du online?", "bot meta");
        cfg.avatar("verlegen", 2500);
      } finally {
        cfg.send.disabled = false;
        cfg.input.focus();
      }
    });

    return { addBubble, messages, zeigeVorschlaege };
  }

  return { istUnsicher, starten, vorschlaegeAus, spracheAn, figurRegler };
})();
