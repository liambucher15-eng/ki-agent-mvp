// Gemeinsame Chat-Logik für die volle Seite (index.html) UND das Einbett-Widget
// (widget-frame.html). Kapselt den Sende-Ablauf, das Deuten der Antwort (verlegen
// bei "weiss nicht", sonst sprechen) und die Nachrichten-Bubbles — damit sich diese
// Logik nicht mehr an zwei Stellen auseinanderentwickeln kann.
//
// Was PRO SEITE unterschiedlich ist (Avatar-DOM, Tipp-Anzeige), wird als Callback
// übergeben. So bleibt das Modul frei von seitenspezifischem HTML.

window.ChatUI = (function () {
  // Wirkt die Antwort unsicher? -> Figur schaut dann verlegen.
  function istUnsicher(text) {
    return /wei(ss|ß).{0,6}nicht|leider|nicht sicher|kann ich (dir )?nicht/i.test(text);
  }

  // Startet die Chat-Steuerung und hängt den Absende-Handler ans Formular.
  // cfg:
  //   chat, form, input, send   – DOM-Elemente
  //   firmaId                    – welche Firma
  //   avatar(zustand, dauer)     – Avatar-Reaktion (seitenspezifisch)
  //   tipptAn?()  -> Element     – Tipp-Anzeige einfügen (Standard: Text-Bubble)
  //   holeFirmaConfig?() -> obj  – optionaler Entwurf/Vorschau-Config fürs Backend
  // Rückgabe: { addBubble, messages }
  function starten(cfg) {
    const messages = [];

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

    cfg.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = cfg.input.value.trim();
      if (!text) return;

      addBubble(text, "user");
      messages.push({ role: "user", content: text });
      cfg.input.value = "";
      cfg.send.disabled = true;

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
          cfg.avatar(istUnsicher(data.reply) ? "verlegen" : "sprechen", 3000);
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

    return { addBubble, messages };
  }

  return { istUnsicher, starten };
})();
