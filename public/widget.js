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
// Version: 5 (Ansprache nur bei Anlass)
//   VERHALTENSÄNDERUNG, bewusst: Die proaktive Sprechblase erscheint nicht mehr
//   pauschal nach 9 Sekunden bei jedem Besucher, sondern nur, wenn ein echter
//   Anlass vorliegt (zögert nach vollständigem Lesen, steckt an der Kasse fest,
//   vergleicht, sucht, will gehen). Ohne Anlass bleibt es still. Für den
//   Einbau-Code der Kunden ändert sich nichts.
// Version: 4 (Seitenverständnis — strukturierte Produktdaten)
//   Neu & optional/abwärtskompatibel: sammelt zusätzlich die strukturierten
//   Auszeichnungen der Seite (JSON-LD, og:/product:-Meta) und reicht sie roh
//   weiter. GEDEUTET wird ausschliesslich serverseitig (lib/seiten-analyse.js) —
//   damit lässt sich das Verständnis verbessern, ohne dass ein Kunde je etwas
//   neu einbetten muss. Die URL-Parameter von Version 3 bleiben unverändert
//   erhalten; die neuen Daten kommen per postMessage nach. Kommt die Nachricht
//   nicht an, verhält sich alles exakt wie in Version 3.
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

  // Strukturierte Auszeichnungen der Seite. Damit weiss der Agent nicht nur, DASS
  // dort ein Text steht, sondern dass es ein Produkt ist, was es kostet und ob es
  // lieferbar ist — die Voraussetzung, um sinnvoll zu empfehlen.
  //
  // Hier wird NUR eingesammelt und geparst, nicht gedeutet: die Deutung liegt
  // serverseitig, damit sie sich verbessern lässt, ohne dass Kunden neu einbetten.
  // Harte Deckel, weil das bei jeder Anfrage mitgeht und von einer fremden Seite
  // stammt, deren Grösse wir nicht kennen.
  var MAX_JSONLD_BLOCK = 12000;   // ein einzelner Block
  var MAX_JSONLD_GESAMT = 12000;  // alle Blöcke zusammen
  function strukturDaten() {
    var jsonLd = [];
    var meta = {};
    try {
      var knoten = document.querySelectorAll('script[type="application/ld+json"]');
      var summe = 0;
      for (var i = 0; i < knoten.length && i < 12 && jsonLd.length < 8; i++) {
        var roh = knoten[i].textContent || "";
        if (!roh || roh.length > MAX_JSONLD_BLOCK) continue;
        if (summe + roh.length > MAX_JSONLD_GESAMT) break;
        try { jsonLd.push(JSON.parse(roh)); summe += roh.length; }
        catch (e) { /* kaputtes JSON-LD überspringen */ }
      }
    } catch (e) { /* egal */ }
    try {
      var m = document.querySelectorAll("meta[property], meta[name]");
      for (var j = 0; j < m.length; j++) {
        var s = m[j].getAttribute("property") || m[j].getAttribute("name");
        // Nur was ausgewertet wird — nicht die halben Kopfdaten mitschleppen.
        if (!s || !/^(og:|twitter:|product:)/i.test(s)) continue;
        meta[s.toLowerCase()] = String(m[j].getAttribute("content") || "").slice(0, 500);
      }
    } catch (e) { /* egal */ }
    return { jsonLd: jsonLd, meta: meta };
  }
  // Voller Kontext = wo + was steht dort + wie ist es ausgezeichnet + wie
  // verhält sich der Besucher.
  function vollerKontext() {
    var k = seitenKontext();
    var s = strukturDaten();
    k.jsonLd = s.jsonLd;
    k.meta = s.meta;
    k.verhalten = verhaltensSignale();
    return k;
  }

  // ── Verhaltenssignale ─────────────────────────────────────────────────────
  // WANN braucht jemand Hilfe? Dafür zählt nicht der Seiteninhalt, sondern das
  // Verhalten: wie lange schon hier, wie weit gelesen, wie lange keine Regung,
  // wie viele Seiten im Besuch, schon mal hier gewesen, gleich weg?
  //
  // DATENSPARSAM (bewusste Grenze): nur anonyme Zähler — Sekunden, Prozent,
  // Anzahl. Keine Namen, keine Klickpfade, keine Kennungen. Alles in
  // sessionStorage, also weg, sobald der Tab zugeht, und nur für DIESE Seite.
  // Nichts wird seitenübergreifend verfolgt. Gedeutet wird serverseitig
  // (lib/verhalten.js); hier wird nur gezählt.
  var SITZUNG_SCHLUESSEL = "kiagent-sitzung";
  var seitenStart = Date.now();
  var letzteRegung = Date.now();
  var maxScroll = 0;
  var exitAbsicht = false;

  function liesSitzung() {
    try { return JSON.parse(sessionStorage.getItem(SITZUNG_SCHLUESSEL)) || {}; }
    catch (e) { return {}; }
  }
  function schreibeSitzung(s) {
    try { sessionStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(s)); } catch (e) {}
  }

  // Trägt DIESE Seite eine Produkt-Auszeichnung? Bewusst nur ein flacher Blick
  // auf die schon eingesammelten Daten — die eigentliche Deutung bleibt auf dem
  // Server. Hier geht es nur darum, den richtigen Zähler zu erhöhen.
  function siehtNachProduktAus(daten) {
    try {
      if (/product/i.test(String(daten.meta["og:type"] || ""))) return true;
      if (daten.meta["product:price:amount"]) return true;
      return JSON.stringify(daten.jsonLd).indexOf('"Product"') > -1;
    } catch (e) { return false; }
  }

  // Diesen Seitenaufruf einmalig in der Sitzung vermerken (nur wegen der
  // Zähler — der Rückgabewert wird nicht gebraucht, gelesen wird später frisch).
  (function () {
    var s = liesSitzung();
    var pfad = String(location.pathname || "/");
    s.seiten = s.seiten && typeof s.seiten === "object" ? s.seiten : {};
    s.seiten[pfad] = (s.seiten[pfad] || 0) + 1;
    s.produkte = Array.isArray(s.produkte) ? s.produkte : [];
    if (siehtNachProduktAus(strukturDaten()) && s.produkte.indexOf(pfad) < 0) {
      s.produkte.push(pfad);
      if (s.produkte.length > 50) s.produkte = s.produkte.slice(-50); // nicht endlos wachsen
    }
    schreibeSitzung(s);
  })();

  function scrollProzent() {
    try {
      var doc = document.documentElement;
      var gesamt = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
      var rest = gesamt - window.innerHeight;
      // Passt die Seite ganz auf den Schirm, gibt es nichts zu scrollen — dann
      // hat der Besucher sie gesehen, nicht 0% gelesen.
      if (rest <= 0) return 100;
      return Math.min(100, Math.max(0, Math.round((window.scrollY / rest) * 100)));
    } catch (e) { return 0; }
  }
  function regung() { letzteRegung = Date.now(); }
  try {
    window.addEventListener("scroll", function () {
      regung();
      var p = scrollProzent();
      if (p > maxScroll) maxScroll = p;
    }, { passive: true });
    ["mousemove", "keydown", "click", "touchstart"].forEach(function (e) {
      window.addEventListener(e, regung, { passive: true });
    });
    // Exit-Absicht: Maus verlässt das Fenster nach OBEN (Richtung Tableiste /
    // Adresszeile). Der verlässlichste Hinweis, den eine Seite bekommt, dass
    // jemand gleich weg ist. Auf Touch-Geräten gibt es das nicht — dort bleibt
    // das Signal einfach aus, statt falsch zu raten.
    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget && e.clientY <= 0) exitAbsicht = true;
    });
  } catch (e) { /* nie die Kundenseite stören */ }

  function verhaltensSignale() {
    var jetzt = Date.now();
    var pfad = String(location.pathname || "/");
    var s = liesSitzung();
    var seiten = s.seiten || {};
    var anzahlSeiten = 0;
    for (var k in seiten) { if (Object.prototype.hasOwnProperty.call(seiten, k)) anzahlSeiten++; }
    return {
      verweildauer: Math.round((jetzt - seitenStart) / 1000),
      scrolltiefe: Math.max(maxScroll, scrollProzent()),
      leerlauf: Math.round((jetzt - letzteRegung) / 1000),
      seitenInSitzung: anzahlSeiten || 1,
      produkteGesehen: (s.produkte || []).length,
      wiederkehr: Math.max(0, (seiten[pfad] || 1) - 1),
      exitAbsicht: exitAbsicht,
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
    // WICHTIG: Author-Styles wie .initial{display:flex} überstimmen sonst das
    // UA-[hidden] — das Initial würde den geladenen Charakter dauerhaft verdecken.
    "[hidden] { display: none !important; }",

    // Launcher. Erscheint verzögert per .sichtbar. Zeigt den Charakter der Firma;
    // solange dessen Bild nicht geladen ist (oder fehlt), ein schlichtes Initial.
    ".bubble {",
    "  position: fixed; bottom: 24px; right: 24px; width: 62px; height: 62px;",
    "  padding: 0; border: 0; background: transparent; cursor: pointer; z-index: 2147483000;",
    // pointer-events wie bei .hinweis: unsichtbar = auch nicht klickbar. Sonst
    // schwebt der ausgeblendete Launcher über der Senden-Ecke des offenen Chats
    // und jeder Klick dort schliesst das Panel statt zu senden.
    "  opacity: 0; transform: scale(0.5); pointer-events: none;",
    "  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1);",
    "}",
    ".bubble.sichtbar { opacity: 1; transform: scale(1); pointer-events: auto; }",
    ".bubble.sichtbar:hover { transform: scale(1.08); }",

    // Charakter-Launcher: das eigene Figur-Bild.
    ".figur {",
    "  display: block; width: 100%; height: 100%; border-radius: 50%; background-size: cover; background-position: center;",
    "  background-color: #fff;", // weisser Grund -> auch transparente Figur-Bilder sind sichtbar
    "  box-shadow: 0 8px 22px rgba(0,0,0,0.28), 0 0 0 3px #fff, 0 0 0 5px " + farbe + "40;",
    "  animation: kiorb-schweben 5s ease-in-out infinite; transition: box-shadow 0.3s ease;",
    "}",
    ".bubble.sichtbar:hover .figur { box-shadow: 0 10px 26px rgba(0,0,0,0.30), 0 0 0 3px #fff, 0 0 18px 4px " + farbe + "80; }",

    // Notfall-Anzeige, falls das Charakterbild (noch) nicht lädt: Initial in
    // Markenfarbe. Kein Orb — nur damit der Launcher nie leer/unsichtbar ist.
    ".initial {",
    "  width: 100%; height: 100%; border-radius: 50%;",
    "  display: flex; align-items: center; justify-content: center;",
    "  font-family: system-ui, -apple-system, sans-serif; font-weight: 700; font-size: 26px; color: #fff;",
    "  background: " + farbe + ";",
    "  box-shadow: 0 8px 22px rgba(0,0,0,0.28), 0 0 0 5px " + farbe + "1f;",
    "  animation: kiorb-schweben 5s ease-in-out infinite; transition: box-shadow 0.3s ease;",
    "}",

    "@keyframes kiorb-schweben { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }",
    "@media (prefers-reduced-motion: reduce) {",
    "  .figur, .initial { animation: none; }",
    "}",

    // Chat-Fenster (fährt aus der Orb-Ecke auf). Gross: reicht nach unten, rechts
    // und oben nahe an den Rand; Höhe = fast volle Fensterhöhe.
    ".panel {",
    "  position: fixed; bottom: 12px; right: 12px;",
    "  width: 480px; max-width: calc(100vw - 24px);",
    "  height: calc(100dvh - 24px); max-height: calc(100dvh - 24px);",
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
    '<button class="bubble" id="bubble" aria-label="Chat öffnen"><span class="figur" id="figur" hidden></span><span class="initial" id="initial"></span></button>',
  ].join("");

  var bubble = root.getElementById("bubble");
  var panel = root.getElementById("panel");
  var figurEl = root.getElementById("figur");
  var initialEl = root.getElementById("initial");
  function setInitial(txt) {
    var s = (txt || firma || "•").trim();
    initialEl.textContent = (s.charAt(0) || "•").toUpperCase();
  }
  setInitial(firma); // sofort etwas Sichtbares, bevor /firma antwortet
  var hinweis = root.getElementById("hinweis");
  var hinweisTextEl = root.getElementById("hinweisText");
  var hinweisZu = root.getElementById("hinweisZu");
  var offen = false;
  var geladen = false;

  // Launcher-Darstellung: der eigene Charakter (Zustands-Bilder). Dafür einmal die
  // öffentliche Firmen-Info holen (Name/Charakter). Lädt das Bild nicht, bleibt das
  // Initial in Markenfarbe stehen — der Launcher ist so nie leer/unsichtbar.
  var figurBilder = null; // Zustands-Bilder (idle/denken/sprechen/verlegen)
  function setFigurBild(zustand) {
    if (!figurBilder) return;
    var bild = figurBilder[zustand] || figurBilder.idle;
    if (bild) figurEl.style.backgroundImage = 'url("' + bild + '")';
  }
  fetch(basis + "/.netlify/functions/firma?id=" + encodeURIComponent(firma))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (f) {
      if (f && f.name) setInitial(f.name); // Initial aus dem echten Firmennamen
      var bilder = f && f.charakter && f.charakter.bilder;
      if (bilder && bilder.idle) {
        // ERST prüfen, ob das Bild wirklich lädt. Nur dann auf die Figur wechseln;
        // bei kaputter/abgelaufener URL bleibt das Initial stehen.
        var probe = new Image();
        probe.onload = function () {
          figurBilder = bilder;
          // restliche Zustands-Bilder vorladen -> Wechsel später ohne Flackern
          for (var z in bilder) { if (bilder[z]) { var im = new Image(); im.src = bilder[z]; } }
          setFigurBild("idle");
          figurEl.hidden = false;
          initialEl.hidden = true;
        };
        probe.onerror = function () { /* Bild kaputt -> Initial bleibt sichtbar */ };
        probe.src = bilder.idle;
      }
    })
    .catch(function () { /* Initial bleibt — kein Problem */ });

  // Verzögertes, ruhiges Erscheinen (kein aufdringliches Sofort-Pop-up).
  setTimeout(function () { bubble.classList.add("sichtbar"); }, 2500);

  // Die strukturierten Seitendaten passen nicht sinnvoll in eine URL — sie kommen
  // per postMessage nach, sobald der Frame geladen ist. Bis dahin arbeitet der
  // Frame mit den URL-Parametern (Version 3), also gibt es nie einen Zustand ohne
  // Kontext, nur einen kurz weniger genauen.
  var frameEl = null;
  var auffrischTimer = null;
  function sendeSeiteAnFrame() {
    if (!frameEl || !frameEl.contentWindow) return;
    try {
      frameEl.contentWindow.postMessage(
        { type: "ki-agent-seite", seite: vollerKontext() },
        basis
      );
    } catch (e) { /* nie die Kundenseite stören */ }
  }
  // Die Verhaltenssignale altern, während der Chat offen ist (Verweildauer
  // läuft weiter). Ohne Auffrischung würde der Agent mitten im Gespräch mit
  // den Zahlen von vor fünf Minuten argumentieren.
  function starteAuffrischen() {
    clearInterval(auffrischTimer);
    auffrischTimer = setInterval(sendeSeiteAnFrame, 20000);
  }
  function stoppeAuffrischen() { clearInterval(auffrischTimer); auffrischTimer = null; }

  function oeffne() {
    versteckeHinweis();
    if (!geladen) {
      var f = document.createElement("iframe");
      f.src = baueFrameUrl(); // Seiten-Kontext beim Öffnen mitgeben
      f.title = "Chat";
      f.setAttribute("allow", "clipboard-write; microphone");
      f.addEventListener("load", sendeSeiteAnFrame);
      panel.appendChild(f);
      frameEl = f;
      geladen = true;
    } else {
      // Schon geladen (Besucher öffnet erneut): Kontext auffrischen — bei
      // Single-Page-Shops kann sich die Seite inzwischen geändert haben.
      sendeSeiteAnFrame();
    }
    starteAuffrischen();
    panel.classList.add("auf");
    // Grosses Fenster deckt die Orb-Ecke ab -> Launcher ausblenden, solange offen
    // (zu wird über das × im Chat-Kopf). Beim Schliessen kommt er wieder.
    bubble.classList.remove("sichtbar");
    bubble.setAttribute("aria-label", "Chat schliessen");
    offen = true;
  }
  function schliesse() {
    stoppeAuffrischen();
    panel.classList.remove("auf");
    bubble.classList.add("sichtbar"); // Orb wieder zeigen
    bubble.setAttribute("aria-label", "Chat öffnen");
    offen = false;
  }
  bubble.addEventListener("click", function () { offen ? schliesse() : oeffne(); });

  // --- Proaktive Sprechblase: nur bei echtem Anlass, selten, wegklickbar ------
  //
  // Vorher: EIN Hinweis nach 9 Sekunden, unabhängig davon, ob der Besucher ihn
  // gebrauchen konnte. Jetzt: das Widget beobachtet still und meldet sich erst,
  // wenn sich lokal etwas Bemerkenswertes ändert (lange da und alles gelesen,
  // an der Kasse festgefahren, im Begriff zu gehen). Ob dann WIRKLICH gesprochen
  // wird, entscheidet die Regel serverseitig (lib/ansprache.js).
  //
  // Die Sperren stehen bewusst HIER, nicht nur auf dem Server: sie greifen ohne
  // Netz und ohne Verzögerung, und keine Netzstörung kann sie aushebeln.
  var HINWEIS_KEY = "kiagent-hinweis-" + firma;
  var hinweisTimer;
  var schonAngesprochen = 0;
  var letzteAnspracheZeit = 0;
  var weggeklickt = false;
  var anspracheLaeuft = false;
  var pruefTimer = null;
  var MAX_ANSPRACHEN = 2;      // spiegelt lib/ansprache.js — Server bleibt die Wahrheit
  var RUHE_MS = 90000;
  // Den statischen Rückfallsatz ("Kann ich dir helfen?") gibt es bewusst NICHT
  // mehr: Er war der Grund, warum sich jeder Besucher angesprochen fühlte, ohne
  // dass es einen Anlass gab. Antwortet der Server nicht, wird geschwiegen —
  // eine ausgebliebene Blase ärgert niemanden, eine überflüssige schon.
  //
  // Kurzer Timeout; jeder fetch mit catch — ein Ausfall darf die Kundenseite
  // nie beeinträchtigen (Update-Vertrag).
  // Fragt den Server: gibt es gerade einen Anlass, und wenn ja, welcher Satz?
  // Antwortet der Server nicht oder verneint er, passiert NICHTS — Schweigen ist
  // der sichere Rückfall. (Der statische Satz greift nur beim Erst-Hinweis ohne
  // Anlass, damit sich das Widget wie bisher verhält, wenn der Server hängt.)
  function frageAnsprache(cb) {
    var fertig = false;
    var ab = setTimeout(function () { if (!fertig) { fertig = true; cb(null); } }, 3000);
    var k = vollerKontext();
    try {
      fetch(basis + "/.netlify/functions/seiten-hinweis", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firmaId: firma, pfad: k.pfad, titel: k.titel, inhalt: k.inhalt,
          jsonLd: k.jsonLd, meta: k.meta,
          verhalten: k.verhalten,
          schonAngesprochen: schonAngesprochen,
          sekundenSeitLetzter: letzteAnspracheZeit
            ? Math.round((Date.now() - letzteAnspracheZeit) / 1000) : null,
          chatOffen: offen,
          weggeklickt: weggeklickt,
        }),
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (fertig) return;
          fertig = true; clearTimeout(ab);
          cb(d && d.ansprechen && d.text ? d.text : null);
        })
        .catch(function () { if (!fertig) { fertig = true; clearTimeout(ab); cb(null); } });
    } catch (e) { if (!fertig) { fertig = true; clearTimeout(ab); cb(null); } }
  }
  function versteckeHinweis() {
    clearTimeout(hinweisTimer);
    hinweis.classList.remove("sichtbar");
  }
  function zeigeSatz(satz) {
    if (offen || !satz) return;
    hinweisTextEl.textContent = satz;
    hinweis.classList.add("sichtbar");
    schonAngesprochen++;
    letzteAnspracheZeit = Date.now();
    hinweisTimer = setTimeout(versteckeHinweis, 8000); // verschwindet von selbst
  }

  // Lokale Vorprüfung. Erst wenn sie durchgeht, wird überhaupt gefragt — sonst
  // liefe bei jedem Besucher im Sekundentakt eine Server-Anfrage.
  function darfUeberhauptFragen() {
    if (offen || weggeklickt || anspracheLaeuft) return false;
    if (schonAngesprochen >= MAX_ANSPRACHEN) return false;
    if (letzteAnspracheZeit && Date.now() - letzteAnspracheZeit < RUHE_MS) return false;
    var s = verhaltensSignale();
    // Grobe Vorfilter, die den Server-Regeln entsprechen: gar nicht erst fragen,
    // solange offensichtlich kein Anlass vorliegt.
    if (s.exitAbsicht) return true;                       // gleich weg
    if (s.leerlauf >= 25 && s.verweildauer >= 40) return true; // stockt
    if (s.verweildauer >= 120 && s.scrolltiefe >= 55) return true; // gelesen, zögert
    if (s.produkteGesehen >= 2 && s.wiederkehr >= 1) return true;  // vergleicht
    if (s.seitenInSitzung >= 4 && s.verweildauer >= 15) return true; // sucht
    return false;
  }
  function pruefeAnlass() {
    if (!darfUeberhauptFragen()) return;
    anspracheLaeuft = true;
    frageAnsprache(function (satz) {
      anspracheLaeuft = false;
      zeigeSatz(satz);
    });
  }

  hinweisTextEl.addEventListener("click", function () { versteckeHinweis(); oeffne(); });
  // Wegklicken ist eine Antwort: für diesen Besuch ist dann Ruhe.
  hinweisZu.addEventListener("click", function (e) {
    e.stopPropagation();
    weggeklickt = true;
    try { localStorage.setItem(HINWEIS_KEY, "weg"); } catch (e2) {}
    versteckeHinweis();
  });
  // Hat der Besucher früher schon einmal weggeklickt, gilt das weiter.
  try { if (localStorage.getItem(HINWEIS_KEY) === "weg") weggeklickt = true; } catch (e) {}

  // Alle 5 Sekunden lokal nachsehen; gefragt wird nur, wenn die Vorprüfung
  // durchgeht. Erst nach 15 Sekunden anfangen — wer gerade erst angekommen ist,
  // wird nicht angesprungen.
  pruefTimer = setInterval(pruefeAnlass, 5000);
  setTimeout(function () { pruefeAnlass(); }, 15000);
  // Exit-Absicht sofort prüfen statt bis zum nächsten Takt zu warten — danach
  // ist der Besucher womöglich weg.
  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget && e.clientY <= 0) setTimeout(pruefeAnlass, 60);
  });

  // Nachrichten aus dem Chat-iframe:
  //  - "ki-agent-schliessen": ×-Button im Chat-Header
  //  - "ki-agent-zustand": Avatar-Zustand (denken/sprechen/…) -> die Launcher-
  //    Figur macht mit (sofern die Charakterbilder geladen sind).
  window.addEventListener("message", function (e) {
    if (!e.data) return;
    if (e.data.type === "ki-agent-schliessen") schliesse();
    if (e.data.type === "ki-agent-zustand" && typeof e.data.zustand === "string") {
      setFigurBild(e.data.zustand);
    }
  });
})();
