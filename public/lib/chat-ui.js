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
      ".ki-vorschlag{font:inherit;font-size:0.82rem;cursor:pointer;padding:7px 13px;border-radius:999px;" +
      "border:1px solid color-mix(in srgb,var(--farbe,#4F46E5) 30%,transparent);" +
      "background:color-mix(in srgb,var(--farbe,#4F46E5) 6%,#fff);color:var(--farbe,#4F46E5);" +
      "box-shadow:0 2px 6px -4px color-mix(in srgb,var(--farbe,#4F46E5) 60%,transparent);" +
      "transition:background .18s,color .18s,transform .18s,box-shadow .18s}" +
      ".ki-vorschlag:hover{background:var(--farbe,#4F46E5);color:#fff;transform:translateY(-1px);" +
      "box-shadow:0 5px 12px -5px color-mix(in srgb,var(--farbe,#4F46E5) 70%,transparent)}";
    document.head.appendChild(s);
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
      ".ki-mic{flex-shrink:0;width:40px;height:40px;border-radius:10px;border:1px solid #d1d5db;" +
      "background:#fff;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center;" +
      "transition:color .15s,border-color .15s,background .15s}" +
      ".ki-mic:hover{color:var(--farbe,#4F46E5);border-color:var(--farbe,#4F46E5)}" +
      ".ki-mic.hoert{color:#fff;background:#ef4444;border-color:#ef4444;animation:ki-mic-puls 1.2s ease-in-out infinite}" +
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

  return { istUnsicher, starten, vorschlaegeAus, spracheAn };
})();
