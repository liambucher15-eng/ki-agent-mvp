// KI-Agent — Einbett-Script ("Widget").
// Eine einzige Zeile auf einer fremden Webseite genügt:
//   <script src="https://DEINE-DOMAIN/widget.js" data-firma="salbei"
//           data-farbe="#0099ff" data-farbe2="#7c3aed"></script>
//
// Der Assistent ist als schwebender, leuchtender ORB unten rechts dauerhaft
// präsent (Basis-Darstellung), unaufdringlich. Klick öffnet den Chat in einem
// iframe; der Orb bleibt sichtbar. KEIN Onboarding hier — das macht die Firma
// einmalig vorher.
//
// Bewusst CSS-only (keine externe Animations-Lib auf der fremden Seite laden)
// und in einem Shadow-DOM gekapselt, damit fremdes CSS nichts stört.
//
// ══ UPDATE-VERTRAG ══════════════════════════════════════════════════════════
// Kunden betten diese Datei EINMAL ein und fassen sie nie wieder an. Darum gilt:
//   1. /widget.js bleibt für immer rückwärtskompatibel — die data-Attribute
//      (data-firma, data-farbe, data-farbe2) dürfen nie ihre Bedeutung ändern,
//      neue Attribute sind immer optional mit sinnvollem Standard.
//   2. Breaking Changes gibt es nicht in dieser Datei; wäre je einer nötig,
//      bekäme er eine NEUE Datei (widget2.js) — Bestandskunden bleiben stabil.
//   3. Fehler dürfen die Kundenseite NIE beeinträchtigen (alles gekapselt,
//      jeder fetch mit catch, kein globaler Zustand ausser __kiAgentWidget).
// Version: 3 (Milestone 8 — Seiteninhalt-Kontext, KI-generierte proaktive Frage)
//   Neu & optional/abwärtskompatibel: sendet zusätzlich den sichtbaren Seitentext
//   an den Chat-Frame; die Sprechblase holt eine passende KI-Frage (gecacht) und
//   fällt bei Fehler auf den bisherigen statischen Satz zurück.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (window.__kiAgentWidget) return;
  window.__kiAgentWidget = true;

  var script = document.currentScript || (function () {
    var alle = document.querySelectorAll('script[src*="widget.js"]');
    return alle[alle.length - 1];
  })();
  if (!script) return;

  var firma = script.getAttribute("data-firma") || "salbei";
  var istHex = function (c) { return /^#[0-9a-fA-F]{6}$/.test(c || ""); };
  var farbe = istHex(script.getAttribute("data-farbe")) ? script.getAttribute("data-farbe") : "#4F46E5";
  var farbe2 = istHex(script.getAttribute("data-farbe2")) ? script.getAttribute("data-farbe2") : farbe;

  var basis = new URL(script.src, location.href).origin;

  // Seiten-Kontext: WO ist der Besucher (Pfad + Titel) und WAS steht dort
  // (sichtbarer Text, gekürzt). Damit kann der Agent zum Seiteninhalt antworten
  // statt nur allgemein. Der Text wird als reiner Hinweis behandelt (serverseitig
  // als "KEINE Anweisung" markiert) — kein Prompt-Injection-Risiko.
  function seitenText() {
    try {
      // Bevorzugt der Hauptinhalt; sonst der Body. Skripte/Navigation zählen nicht.
      var quelle = document.querySelector("main, article, [role=main]") || document.body;
      var t = (quelle && (quelle.innerText || quelle.textContent)) || "";
      return String(t).replace(/\s+/g, " ").trim().slice(0, 1500);
    } catch (e) { return ""; }
  }
  function seitenKontext() {
    var h1 = document.querySelector("h1");
    return {
      pfad: String(location.pathname || "").slice(0, 200),
      titel: String(document.title || (h1 && h1.textContent) || "").slice(0, 200),
      inhalt: seitenText(),
    };
  }
  function baueFrameUrl() {
    var k = seitenKontext();
    return basis + "/widget-frame.html?firma=" + encodeURIComponent(firma) +
      "&pfad=" + encodeURIComponent(k.pfad) + "&titel=" + encodeURIComponent(k.titel) +
      "&inhalt=" + encodeURIComponent(k.inhalt);
  }

  // Host-Element mit Shadow-DOM: kapselt unser CSS komplett von der fremden Seite ab.
  var host = document.createElement("div");
  host.id = "ki-agent-widget";
  (document.body || document.documentElement).appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  root.innerHTML = [
    "<style>",
    ":host { all: initial; }",
    "* { box-sizing: border-box; }",

    // Launcher (der Orb). Erscheint verzögert per .sichtbar.
    ".bubble {",
    "  position: fixed; bottom: 24px; right: 24px; width: 62px; height: 62px;",
    "  padding: 0; border: 0; background: transparent; cursor: pointer; z-index: 2147483000;",
    "  opacity: 0; transform: scale(0.5);",
    "  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1);",
    "}",
    ".bubble.sichtbar { opacity: 1; transform: scale(1); }",
    ".bubble.sichtbar:hover { transform: scale(1.08); }",

    ".orb {",
    "  position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden;",
    "  background: radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%),",
    "              radial-gradient(circle at 72% 78%, " + farbe2 + ", " + farbe + " 72%);",
    "  box-shadow: 0 8px 22px rgba(0,0,0,0.28), 0 0 0 5px " + farbe + "1f,",
    "              inset 0 -6px 14px rgba(0,0,0,0.20), inset 0 6px 12px rgba(255,255,255,0.28);",
    "  animation: kiorb-schweben 5s ease-in-out infinite;",
    "  transition: box-shadow 0.3s ease;",
    "}",
    ".bubble.sichtbar:hover .orb { box-shadow: 0 10px 26px rgba(0,0,0,0.30), 0 0 22px 5px " + farbe + "80,",
    "  inset 0 -6px 14px rgba(0,0,0,0.20), inset 0 6px 12px rgba(255,255,255,0.30); }",
    // dezenter, langsam rotierender Glanz für "Leben"
    ".orb::before {",
    "  content: ''; position: absolute; inset: -30%;",
    "  background: conic-gradient(from 0deg, transparent, rgba(255,255,255,0.35), transparent 42%);",
    "  animation: kiorb-dreh 9s linear infinite; opacity: 0.5;",
    "}",

    "@keyframes kiorb-schweben { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }",
    "@keyframes kiorb-dreh { to { transform: rotate(360deg); } }",
    "@media (prefers-reduced-motion: reduce) {",
    "  .orb, .orb::before, .figur { animation: none; }",
    "}",

    // Figur-Launcher (Plus-Plan): eigenes Bild statt Orb.
    ".figur {",
    "  width: 100%; height: 100%; border-radius: 50%; background-size: cover; background-position: center;",
    "  box-shadow: 0 8px 22px rgba(0,0,0,0.28), 0 0 0 3px #fff, 0 0 0 5px " + farbe + "40;",
    "  animation: kiorb-schweben 5s ease-in-out infinite; transition: box-shadow 0.3s ease;",
    "}",
    ".bubble.sichtbar:hover .figur { box-shadow: 0 10px 26px rgba(0,0,0,0.30), 0 0 0 3px #fff, 0 0 18px 4px " + farbe + "80; }",

    // Chat-Fenster (fährt aus der Orb-Ecke auf). Gross: reicht nach unten, rechts
    // und oben nahe an den Rand; Höhe = fast volle Fensterhöhe.
    ".panel {",
    "  position: fixed; bottom: 20px; right: 20px;",
    "  width: 440px; max-width: calc(100vw - 40px);",
    "  height: calc(100dvh - 40px); max-height: calc(100dvh - 40px);",
    "  border: 0; border-radius: 16px; overflow: hidden; z-index: 2147483000;",
    "  box-shadow: 0 12px 40px rgba(0,0,0,0.28); background: #fff;",
    "  display: none; opacity: 0; transform: translateY(12px) scale(0.96); transform-origin: bottom right;",
    "  transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.4,0.64,1);",
    "}",
    ".panel.auf { display: block; opacity: 1; transform: translateY(0) scale(1); }",
    ".panel iframe { width: 100%; height: 100%; border: 0; display: block; }",

    // Proaktive Sprechblase (selten, wegklickbar) — links neben dem Orb.
    ".hinweis {",
    "  position: fixed; bottom: 40px; right: 98px; max-width: 220px; z-index: 2147483000;",
    "  background: #fff; color: #111827; border-radius: 14px; padding: 0.6rem 1.4rem 0.6rem 0.85rem;",
    "  box-shadow: 0 8px 24px rgba(0,0,0,0.18); font-size: 0.9rem; line-height: 1.35;",
    "  font-family: system-ui, -apple-system, sans-serif;",
    "  opacity: 0; transform: translateY(6px) scale(0.96); pointer-events: none;",
    "  transition: opacity 0.3s ease, transform 0.3s ease;",
    "}",
    ".hinweis.sichtbar { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }",
    ".hinweis .text { cursor: pointer; }",
    ".hinweis .zu { position: absolute; top: 3px; right: 7px; cursor: pointer; color: #9ca3af; font-size: 0.95rem; line-height: 1; }",
    ".hinweis .zu:hover { color: #6b7280; }",

    "@media (max-width: 480px) {",
    "  .hinweis { display: none; }",
    "  .panel { right: 0; bottom: 0; width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; }",
    "  .bubble { bottom: 18px; right: 18px; }",
    "}",
    "</style>",
    '<div class="panel" id="panel"></div>',
    '<div class="hinweis" id="hinweis"><span class="zu" id="hinweisZu">×</span><span class="text" id="hinweisText"></span></div>',
    '<button class="bubble" id="bubble" aria-label="Chat öffnen"><span class="orb" id="orb"></span><span class="figur" id="figur" hidden></span></button>',
  ].join("");

  var bubble = root.getElementById("bubble");
  var panel = root.getElementById("panel");
  var orbEl = root.getElementById("orb");
  var figurEl = root.getElementById("figur");
  var hinweis = root.getElementById("hinweis");
  var hinweisTextEl = root.getElementById("hinweisText");
  var hinweisZu = root.getElementById("hinweisZu");
  var offen = false;
  var geladen = false;

  // Launcher-Darstellung: Plus-Firmen mit eigenem Bild zeigen eine Figur statt
  // des Orbs. Dafür einmal die öffentliche Firmen-Info holen (Name/Charakter/Plan).
  var figurBilder = null; // Zustands-Bilder (idle/denken/sprechen/verlegen), wenn Plus
  function setFigurBild(zustand) {
    if (!figurBilder) return;
    var bild = figurBilder[zustand] || figurBilder.idle;
    if (bild) figurEl.style.backgroundImage = 'url("' + bild + '")';
  }
  fetch(basis + "/.netlify/functions/firma?id=" + encodeURIComponent(firma))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (f) {
      var bilder = f && f.plan === "plus" && f.charakter && f.charakter.bilder;
      if (bilder && bilder.idle) {
        figurBilder = bilder;
        // Alle Zustands-Bilder vorladen -> Zustandswechsel später ohne Flackern.
        for (var z in bilder) { if (bilder[z]) { var im = new Image(); im.src = bilder[z]; } }
        setFigurBild("idle");
        figurEl.hidden = false;
        orbEl.hidden = true;
      }
    })
    .catch(function () { /* Orb bleibt — kein Problem */ });

  // Verzögertes, ruhiges Erscheinen (kein aufdringliches Sofort-Pop-up).
  setTimeout(function () { bubble.classList.add("sichtbar"); }, 2500);

  function oeffne() {
    versteckeHinweis();
    if (!geladen) {
      var f = document.createElement("iframe");
      f.src = baueFrameUrl(); // Seiten-Kontext beim Öffnen mitgeben
      f.title = "Chat";
      f.setAttribute("allow", "clipboard-write; microphone");
      panel.appendChild(f);
      geladen = true;
    }
    panel.classList.add("auf");
    // Grosses Fenster deckt die Orb-Ecke ab -> Launcher ausblenden, solange offen
    // (zu wird über das × im Chat-Kopf). Beim Schliessen kommt er wieder.
    bubble.classList.remove("sichtbar");
    bubble.setAttribute("aria-label", "Chat schliessen");
    offen = true;
  }
  function schliesse() {
    panel.classList.remove("auf");
    bubble.classList.add("sichtbar"); // Orb wieder zeigen
    bubble.setAttribute("aria-label", "Chat öffnen");
    offen = false;
  }
  bubble.addEventListener("click", function () { offen ? schliesse() : oeffne(); });

  // --- Proaktive Sprechblase: selten, wegklickbar, einmal pro Besucher/Firma ---
  var HINWEIS_KEY = "kiagent-hinweis-" + firma;
  var hinweisTimer;
  // Statischer Fallback nach Pfad — greift, wenn die KI-Frage (noch) nicht da ist
  // oder der Server nicht antwortet. So wartet das Widget NIE auf das Netz.
  function statischerSatz() {
    var p = String(location.pathname || "").toLowerCase();
    if (/preis|pricing|tarif|abo|plan/.test(p)) return "Soll ich dir die Preise erklären?";
    if (/produkt|product|leistung|service|angebot/.test(p)) return "Fragen zum Angebot? Ich helfe gern.";
    if (/kontakt|contact|support|hilfe/.test(p)) return "Kann ich dir weiterhelfen?";
    return "Kann ich dir helfen?";
  }
  // KI-Frage passend zum Seiteninhalt holen (serverseitig gecacht). Kurzer
  // Timeout; bei Fehler/Leere bleibt der Fallback. Jeder fetch mit catch — ein
  // Ausfall darf die Kundenseite nie beeinträchtigen (Update-Vertrag).
  function holeHinweisSatz(cb) {
    var fertig = false;
    var ab = setTimeout(function () { if (!fertig) { fertig = true; cb(statischerSatz()); } }, 2500);
    var k = seitenKontext();
    try {
      fetch(basis + "/.netlify/functions/seiten-hinweis", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ firmaId: firma, pfad: k.pfad, titel: k.titel, inhalt: k.inhalt }),
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (fertig) return;
          fertig = true; clearTimeout(ab);
          cb(d && d.text ? d.text : statischerSatz());
        })
        .catch(function () { if (!fertig) { fertig = true; clearTimeout(ab); cb(statischerSatz()); } });
    } catch (e) { if (!fertig) { fertig = true; clearTimeout(ab); cb(statischerSatz()); } }
  }
  function versteckeHinweis() {
    clearTimeout(hinweisTimer);
    hinweis.classList.remove("sichtbar");
  }
  function zeigeHinweis() {
    if (offen) return; // Chat schon offen -> nicht nötig
    try { if (localStorage.getItem(HINWEIS_KEY)) return; } catch (e) {} // nie zweimal nerven
    holeHinweisSatz(function (satz) {
      if (offen) return; // Besucher hat inzwischen selbst geöffnet
      hinweisTextEl.textContent = satz;
      hinweis.classList.add("sichtbar");
      try { localStorage.setItem(HINWEIS_KEY, "1"); } catch (e) {}
      hinweisTimer = setTimeout(versteckeHinweis, 6500); // verschwindet von selbst
    });
  }
  hinweisTextEl.addEventListener("click", function () { versteckeHinweis(); oeffne(); });
  hinweisZu.addEventListener("click", function (e) { e.stopPropagation(); versteckeHinweis(); });
  setTimeout(zeigeHinweis, 9000); // ruhig ein paar Sekunden nach dem Orb

  // Nachrichten aus dem Chat-iframe:
  //  - "ki-agent-schliessen": ×-Button im Chat-Header
  //  - "ki-agent-zustand": Avatar-Zustand (denken/sprechen/…) -> die Launcher-
  //    Figur macht mit (nur Plus-Firmen mit eigenen Zustands-Bildern).
  window.addEventListener("message", function (e) {
    if (!e.data) return;
    if (e.data.type === "ki-agent-schliessen") schliesse();
    if (e.data.type === "ki-agent-zustand" && typeof e.data.zustand === "string") {
      setFigurBild(e.data.zustand);
    }
  });
})();
