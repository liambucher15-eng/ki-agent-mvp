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
  var frameUrl = basis + "/widget-frame.html?firma=" + encodeURIComponent(firma);

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
    "  .orb, .orb::before { animation: none; }",
    "}",

    // Chat-Fenster (fährt aus der Orb-Ecke auf)
    ".panel {",
    "  position: fixed; bottom: 96px; right: 24px;",
    "  width: 380px; height: 560px; max-height: calc(100vh - 130px);",
    "  border: 0; border-radius: 16px; overflow: hidden; z-index: 2147483000;",
    "  box-shadow: 0 12px 40px rgba(0,0,0,0.28); background: #fff;",
    "  display: none; opacity: 0; transform: translateY(12px) scale(0.96); transform-origin: bottom right;",
    "  transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.4,0.64,1);",
    "}",
    ".panel.auf { display: block; opacity: 1; transform: translateY(0) scale(1); }",
    ".panel iframe { width: 100%; height: 100%; border: 0; display: block; }",

    "@media (max-width: 480px) {",
    "  .panel { right: 0; bottom: 0; width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; }",
    "  .bubble { bottom: 18px; right: 18px; }",
    "}",
    "</style>",
    '<div class="panel" id="panel"></div>',
    '<button class="bubble" id="bubble" aria-label="Chat öffnen"><span class="orb"></span></button>',
  ].join("");

  var bubble = root.getElementById("bubble");
  var panel = root.getElementById("panel");
  var offen = false;
  var geladen = false;

  // Verzögertes, ruhiges Erscheinen (kein aufdringliches Sofort-Pop-up).
  setTimeout(function () { bubble.classList.add("sichtbar"); }, 2500);

  function oeffne() {
    if (!geladen) {
      var f = document.createElement("iframe");
      f.src = frameUrl;
      f.title = "Chat";
      f.setAttribute("allow", "clipboard-write");
      panel.appendChild(f);
      geladen = true;
    }
    panel.classList.add("auf");
    bubble.setAttribute("aria-label", "Chat schliessen");
    offen = true;
  }
  function schliesse() {
    // Nur das Fenster verschwindet — der Orb bleibt sichtbar und ansprechbar.
    panel.classList.remove("auf");
    bubble.setAttribute("aria-label", "Chat öffnen");
    offen = false;
  }
  bubble.addEventListener("click", function () { offen ? schliesse() : oeffne(); });

  // Der Chat im iframe kann das Schliessen anfordern (×-Button im Chat-Header).
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "ki-agent-schliessen") schliesse();
  });
})();
