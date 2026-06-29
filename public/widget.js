// KI-Agent — Einbett-Script ("Widget").
// Eine einzige Zeile auf einer fremden Webseite genügt:
//   <script src="https://DEINE-DOMAIN/widget.js" data-firma="salbei"></script>
//
// Das Script baut unten rechts ein rundes Icon ("Bubble"). Klickt der Besucher
// drauf, öffnet sich der fertige Chat-Agent in einem iframe — KEIN Onboarding,
// das macht nur die Firma einmalig vorher.
//
// Warum iframe? -> Saubere Isolation: das CSS der fremden Seite kann den Chat
// nicht stören, und der Chat läuft technisch auf unserer eigenen Domain
// (darum kein CORS-Problem beim Aufruf der Backend-Funktionen).

(function () {
  // Doppeltes Laden verhindern (falls das Script zweimal eingebunden wird).
  if (window.__kiAgentWidget) return;
  window.__kiAgentWidget = true;

  // Das eigene <script>-Tag finden -> daraus Firma, Farbe und Basis-URL lesen.
  var script = document.currentScript || (function () {
    var alle = document.querySelectorAll('script[src*="widget.js"]');
    return alle[alle.length - 1];
  })();
  if (!script) return;

  var firma = script.getAttribute("data-firma") || "salbei";
  var farbe = script.getAttribute("data-farbe") || "#3f7d5a";
  // Basis = die Domain, von der DIESES Script geladen wurde (unsere Agent-Domain).
  // So funktioniert es ohne Hardcoding — lokal (localhost) wie live (Netlify).
  var basis = new URL(script.src, location.href).origin;
  var frameUrl = basis + "/widget-frame.html?firma=" + encodeURIComponent(firma);

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V5z" ' +
    'fill="currentColor"/></svg>';
  var ICON_X =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round"/></svg>';

  // Host-Element mit Shadow-DOM: kapselt unser CSS komplett von der fremden Seite ab.
  var host = document.createElement("div");
  host.id = "ki-agent-widget";
  (document.body || document.documentElement).appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  root.innerHTML = [
    "<style>",
    ":host { all: initial; }",
    "* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }",
    ".bubble {",
    "  position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px;",
    "  border-radius: 50%; border: 0; cursor: pointer; z-index: 2147483000;",
    "  background: " + farbe + "; color: #fff;",
    "  box-shadow: 0 6px 24px rgba(0,0,0,0.25);",
    "  display: flex; align-items: center; justify-content: center;",
    "  transition: transform 0.15s ease;",
    "}",
    ".bubble:hover { transform: scale(1.06); }",
    ".bubble svg { width: 28px; height: 28px; }",
    ".panel {",
    "  position: fixed; bottom: 92px; right: 20px;",
    "  width: 380px; height: 560px; max-height: calc(100vh - 120px);",
    "  border: 0; border-radius: 16px; overflow: hidden; z-index: 2147483000;",
    "  box-shadow: 0 12px 40px rgba(0,0,0,0.28); background: #fff;",
    "  display: none; opacity: 0; transform: translateY(16px) scale(0.98);",
    "  transition: opacity 0.2s ease, transform 0.2s ease;",
    "}",
    ".panel.auf { display: block; opacity: 1; transform: translateY(0) scale(1); }",
    ".panel iframe { width: 100%; height: 100%; border: 0; display: block; }",
    "@media (max-width: 480px) {",
    "  .panel { right: 0; bottom: 0; width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; }",
    "  .bubble { bottom: 16px; right: 16px; }",
    "}",
    "</style>",
    '<div class="panel" id="panel"></div>',
    '<button class="bubble" id="bubble" aria-label="Chat öffnen">' + ICON_CHAT + "</button>",
  ].join("");

  var bubble = root.getElementById("bubble");
  var panel = root.getElementById("panel");
  var offen = false;
  var geladen = false;

  function oeffne() {
    // iframe erst beim ersten Öffnen laden (spart Ressourcen auf der fremden Seite).
    if (!geladen) {
      var f = document.createElement("iframe");
      f.src = frameUrl;
      f.title = "Chat";
      f.setAttribute("allow", "clipboard-write");
      panel.appendChild(f);
      geladen = true;
    }
    panel.classList.add("auf");
    bubble.innerHTML = ICON_X;
    bubble.setAttribute("aria-label", "Chat schliessen");
    offen = true;
  }
  function schliesse() {
    panel.classList.remove("auf");
    bubble.innerHTML = ICON_CHAT;
    bubble.setAttribute("aria-label", "Chat öffnen");
    offen = false;
  }
  bubble.addEventListener("click", function () { offen ? schliesse() : oeffne(); });

  // Der Chat im iframe kann das Schliessen anfordern (×-Button im Chat-Header).
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "ki-agent-schliessen") schliesse();
  });
})();
