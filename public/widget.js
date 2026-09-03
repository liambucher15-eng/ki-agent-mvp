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
// Version: 7 (Fenster stellen — Lage links/rechts/mittig + Vollbild)
//   Neu & optional/abwärtskompatibel: Im Chat-Kopf sitzen zwei Knöpfe, mit denen
//   der BESUCHER das Fenster andockt (links/rechts, bei der Leiste auch mittig)
//   oder auf Vollbild schaltet. Ausgangslage ist rechts angedockt. Die LAGE wird
//   pro Firma im localStorage gemerkt und gilt auf der nächsten Unterseite
//   weiter, das VOLLBILD bewusst nicht. Für den Einbau-Code der Kunden
//   ändert sich nichts; ohne die Meldung des Widgets bleiben die Knöpfe im Chat
//   verborgen (Dashboard-Testchat, direkt aufgerufener Frame).
// Version: 6 (Gesprächsleiste — optionale Darstellung data-stil="leiste")
//   Neu & optional/abwärtskompatibel: data-stil="leiste" zeigt statt des Orbs
//   unten mittig eine ruhende Eingabeleiste — dieselbe Form, die Besucher von
//   Konkurrenzprodukten kennen, aber MIT Gesicht: die Figur sitzt links in der
//   Leiste und reagiert (Ruhe / Zuhören beim Tippen / Denken / Sprechen). Wer
//   in die Leiste tippt und absendet, landet mit seiner Frage direkt im Chat —
//   kein Zwischenklick. Ohne das Attribut bleibt alles exakt wie in Version 5.
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

  // Darstellung des Ruhezustands. "orb" (Standard, unverändert) = Figur unten
  // rechts. "leiste" = Eingabeleiste unten mittig, Figur links darin.
  var stil = script.getAttribute("data-stil") === "leiste" ? "leiste" : "orb";
  // Der Satz, der in der ruhenden Leiste steht. Bewusst überschreibbar: er ist
  // der erste Satz, den ein Besucher von der Marke liest.
  var leisteText = (script.getAttribute("data-leiste-text") || "").trim() ||
    "Frag mich etwas…";

  var basis = new URL(script.src, location.href).origin;

  // Seiten-Kontext: WO ist der Besucher (Pfad + Titel) und WAS steht dort
  // (sichtbarer Text, gekürzt). Damit kann der Agent zum Seiteninhalt antworten
  // statt nur allgemein. Der Text wird als reiner Hinweis behandelt (serverseitig
  // als "KEINE Anweisung" markiert) — kein Prompt-Injection-Risiko.
  function seitenText() {
    try {
      var lies = function (el) {
        var t = (el && (el.innerText || el.textContent)) || "";
        return String(t).replace(/\s+/g, " ").trim();
      };
      var koerper = lies(document.body);
      // Bevorzugt der Hauptinhalt: Auf den meisten Seiten hält er Navigation,
      // Kopf- und Fusszeile heraus.
      var haupt = document.querySelector("main, article, [role=main]");
      var text = haupt ? lies(haupt) : "";
      // ABER: Manche Seiten setzen <main> nur um den Aufmacher, während der
      // eigentliche Inhalt in Sektionen daneben steht (so gebaut ist unsere
      // eigene Startseite). Der Agent sähe dann nur die Überschrift und sagte
      // zu allem anderen "steht nicht auf dieser Seite" — gemessen genau so
      // passiert. Ist der Hauptinhalt auffällig kürzer als die Seite, war er
      // nicht als Hauptinhalt gemeint.
      if (text.length < koerper.length * 0.5) text = koerper;
      // 1500 Zeichen genuegten fuer eine kurze Landingpage, nicht aber fuer
      // eine lange wie unsere eigene start.html: "Preis" liegt dort erst nach
      // Hero, Vertrauensleiste, Funktionen, Warum-ueberhaupt, Beweis-Band,
      // Charaktere und "So funktioniert es" — gemessen bei Zeichen 6439, also
      // auch ausserhalb eines ersten (zu knapp bemessenen) Versuchs mit 6000.
      // Der Agent bekam den Preis-Abschnitt serverseitig nie zu sehen,
      // seite_zeigen("Preis") schlug an zielStehtAufSeite() fehl (siehe
      // netlify/functions/lib/seiten-analyse.js, derselbe Deckel dort MUSS
      // mitwachsen), und er redete nur ÜBER das Abo statt dorthin zu fuehren.
      // 9000 Zeichen deckt die komplette heutige start.html (gemessen 8022)
      // mit etwas Reserve ab. Waechst die Seite deutlich weiter, muss diese
      // Zahl mitwachsen — sonst wiederholt sich genau dieser Fehler.
      return text.slice(0, 9000);
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
  // Der Name des Produkts auf dieser Seite — flach aus den schon eingesammelten
  // Daten gegriffen, ohne Deutung. Nur damit der Agent beim Vergleichen sagen
  // kann, WORIN sich die Stücke unterscheiden.
  function produktName(daten) {
    try {
      var m = String(daten.meta["og:title"] || "").trim();
      if (m) return m.slice(0, 80);
      for (var i = 0; i < daten.jsonLd.length; i++) {
        var k = daten.jsonLd[i];
        if (k && typeof k === "object" && k.name && /product/i.test(JSON.stringify(k["@type"] || ""))) {
          return String(k.name).slice(0, 80);
        }
      }
      var h1 = document.querySelector("h1");
      return h1 ? String(h1.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) : "";
    } catch (e) { return ""; }
  }

  // Diesen Seitenaufruf einmalig in der Sitzung vermerken (nur wegen der
  // Zähler — der Rückgabewert wird nicht gebraucht, gelesen wird später frisch).
  (function () {
    var s = liesSitzung();
    var pfad = String(location.pathname || "/");
    s.seiten = s.seiten && typeof s.seiten === "object" ? s.seiten : {};
    s.seiten[pfad] = (s.seiten[pfad] || 0) + 1;
    s.produkte = Array.isArray(s.produkte) ? s.produkte : [];
    var daten = strukturDaten();
    if (siehtNachProduktAus(daten) && s.produkte.indexOf(pfad) < 0) {
      s.produkte.push(pfad);
      if (s.produkte.length > 50) s.produkte = s.produkte.slice(-50); // nicht endlos wachsen
    }
    // Zusätzlich der NAME des Produkts. Ohne ihn weiss der Agent zwar, DASS
    // verglichen wird, aber nicht WOMIT — und kann den Unterschied nicht
    // benennen, um den es eigentlich geht. Der Name steht ohnehin sichtbar auf
    // der Seite und ist keine personenbezogene Angabe.
    s.gesehen = Array.isArray(s.gesehen) ? s.gesehen : [];
    var name = produktName(daten);
    if (name && s.gesehen.indexOf(name) < 0) {
      s.gesehen.push(name);
      if (s.gesehen.length > 12) s.gesehen = s.gesehen.slice(-12);
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
      // Die Namen der zuletzt gesehenen Produkte — damit der Agent beim
      // Vergleichen konkret werden kann statt nur zu wissen, DASS verglichen wird.
      gesehen: (s.gesehen || []).slice(-6),
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
    // Eine Fahrt über die halbe Bildschirmhöhe ist genau das, was hier gemeint
    // ist, wenn jemand weniger Bewegung einstellt: Das Fenster blendet dann auf,
    // statt zu fahren.
    "  .panel { transition: opacity 0.2s ease !important; transform: none !important; }",
    "  .leiste { transition: opacity 0.3s ease !important; }",
    "  .leiste, .leiste.sichtbar, .leiste.sichtbar:hover { transform: translateX(-50%) !important; }",
    "}",

    // Chat-Fenster (fährt aus der Orb-Ecke auf). Gross: reicht nach unten, rechts
    // und oben nahe an den Rand; Höhe = fast volle Fensterhöhe.
    ".panel {",
    "  position: fixed; bottom: 12px; right: 12px;",
    "  width: 480px; max-width: calc(100vw - 24px);",
    "  height: calc(100dvh - 24px); max-height: calc(100dvh - 24px);",
    "  border: 0; border-radius: 16px; overflow: hidden; z-index: 2147483000;",
    "  box-shadow: 0 12px 40px rgba(0,0,0,0.28); background: #fff;",
    // display bleibt in der Hand von JS (.bereit), NICHT an .auf gekoppelt:
    // Ein Wechsel von display:none auf block im selben Frame lässt den Browser
    // die Übergänge überspringen — das Fenster wäre schlagartig da statt zu
    // kommen. Erst sichtbar machen, Layout erzwingen, dann .auf setzen.
    "  display: none; opacity: 0; transform: translateY(12px) scale(0.96); transform-origin: bottom right;",
    "  transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.4,0.64,1);",
    "}",
    ".panel.bereit { display: block; }",
    ".panel.auf { opacity: 1; transform: translateY(0) scale(1); }",
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
    // Antwort-Knoepfe unter dem Satz. Sie sind der eigentliche Zweck der Blase:
    // Der Besucher muss nicht selbst formulieren, was er fragen will, sondern
    // waehlt. Untereinander statt nebeneinander — die Blase ist nur 220px breit,
    // zwei Knoepfe nebeneinander waeren beide zu schmal zum Lesen.
    ".hinweis .wahl { display: flex; flex-direction: column; gap: 5px; margin-top: 7px; }",
    ".hinweis .wahl button {",
    "  font: inherit; font-size: 0.82rem; text-align: left; cursor: pointer;",
    "  padding: 6px 10px; border-radius: 9px; border: 1px solid " + farbe + "33;",
    "  background: " + farbe + "14; color: " + farbe + ";",
    "  transition: background 0.15s ease, border-color 0.15s ease;",
    "}",
    ".hinweis .wahl button:hover { background: " + farbe + "26; border-color: " + farbe + "66; }",

    // ── Gesprächsleiste (data-stil="leiste") ────────────────────────────────
    // Warum überhaupt eine zweite Form: Die ruhende Pille unten mittig ist die
    // Geste, die Besucher inzwischen kennen — sie sagt "hier kannst du reden",
    // ohne dass jemand erst ein Symbol deuten muss. Der Orb verlangt einen
    // Klick ins Ungewisse, die Pille sagt in Worten, was passiert.
    //
    // Der Unterschied zu den nackten Eingabeleisten der anderen: Links sitzt die
    // Figur, nicht ein Symbol. Damit ist von der ersten Sekunde an klar, dass
    // hier jemand antwortet und nicht ein Suchfeld.
    //
    // SIE IST BEWUSST KLEIN. Sie ist nur die Einladung; getippt wird drinnen.
    // Eine breite Leiste mit echtem Eingabefeld nimmt im Ruhezustand Platz und
    // Aufmerksamkeit weg, die ihr nicht zusteht — sie sieht aus wie eine
    // Aufgabe. Die Pille ist so gross wie ihr Satz und nicht grösser.
    ".leiste {",
    "  position: fixed; bottom: 22px; left: 50%; z-index: 2147483000;",
    "  max-width: calc(100vw - 28px);",
    "  display: flex; align-items: center; gap: 10px; padding: 5px 6px 5px 5px;",
    "  background: #fff; border: 0; border-radius: 999px; cursor: pointer; text-align: left;",
    "  box-shadow: 0 8px 26px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(17,17,20,0.04);",
    "  font-family: system-ui, -apple-system, sans-serif;",
    "  opacity: 0; transform: translateX(-50%) translateY(14px); pointer-events: none;",
    "  transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.34,1.3,0.64,1), box-shadow 0.25s ease;",
    "}",
    ".leiste.sichtbar { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }",
    ".leiste.sichtbar:hover {",
    "  transform: translateX(-50%) translateY(-2px);",
    "  box-shadow: 0 14px 34px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(17,17,20,0.04);",
    "}",

    ".l-figur { flex: 0 0 auto; width: 42px; height: 42px; }",
    ".leiste .figur, .leiste .initial {",
    "  box-shadow: 0 3px 10px rgba(0,0,0,0.16), 0 0 0 2px #fff, 0 0 0 4px " + farbe + "33;",
    "}",
    ".leiste .initial { font-size: 18px; }",
    ".leiste.sichtbar:hover .figur, .leiste.sichtbar:hover .initial {",
    "  box-shadow: 0 4px 14px rgba(0,0,0,0.20), 0 0 0 2px #fff, 0 0 14px 3px " + farbe + "66; }",

    ".l-text {",
    "  flex: 0 1 auto; font-size: 14.5px; line-height: 1.3; color: #4b5563;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "}",
    ".l-pfeil {",
    "  flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%;",
    "  background: " + farbe + "; color: #fff; display: flex; align-items: center; justify-content: center;",
    "  transition: transform 0.2s ease;",
    "}",
    ".leiste.sichtbar:hover .l-pfeil { transform: translateY(-1px); }",
    ".l-pfeil svg { width: 15px; height: 15px; }",

    // Der proaktive Satz steht bei der Leiste ÜBER der Pille, nicht daneben —
    // daneben wäre er am Bildschirmrand und liefe bei schmalen Fenstern hinaus.
    stil === "leiste"
      ? ".hinweis { left: 50%; right: auto; bottom: 92px; width: 260px;" +
        " max-width: calc(100vw - 32px); margin-left: -130px; text-align: center; }"
      : "",

    // Das Fenster kommt bei der Leiste von UNTEN hoch, mittig, und nicht aus der
    // Ecke: Es fährt genau dort heraus, wo die Pille steht, die es geöffnet hat.
    // Deshalb auch nur translate (kein scale) — geschoben, nicht aufgeploppt.
    stil === "leiste"
      ? [
        ".panel {",
        "  left: 50%; right: auto; bottom: 0;",
        "  width: 440px; max-width: calc(100vw - 24px);",
        "  height: min(680px, calc(100dvh - 40px)); max-height: calc(100dvh - 40px);",
        "  border-radius: 20px 20px 0 0; transform-origin: bottom center;",
        "  transform: translateX(-50%) translateY(100%);",
        "  box-shadow: 0 -8px 50px rgba(0,0,0,0.22);",
        "  transition: opacity 0.25s ease, transform 0.46s cubic-bezier(0.22,1,0.36,1);",
        "}",
        ".panel.auf { transform: translateX(-50%) translateY(0); }",
      ].join("")
      : "",

    // ── Lage und Vollbild ───────────────────────────────────────────────────
    // Gesteuert aus dem Chat-Kopf, gemerkt pro Besucher. Warum überhaupt: Wo
    // das Fenster gut steht, hängt von der Seite ab, nicht vom Widget — auf
    // einer Produktseite verdeckt die rechte Seite den Warenkorb, auf einer
    // Textseite die Navigation. Das weiss nur, wer davor sitzt.
    //
    // Erst ab 481px: Darunter füllt der Chat ohnehin den Bildschirm, da gibt es
    // keine Seite zum Andocken. Die Knöpfe sind dort auch ausgeblendet.
    "@media (min-width: 481px) {",
    "  .panel.pos-links, .panel.pos-rechts {",
    "    width: 440px; max-width: calc(100vw - 24px); bottom: 12px;",
    "    height: calc(100dvh - 24px); max-height: calc(100dvh - 24px);",
    "    border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.28);",
    "  }",
    "  .panel.pos-links { left: 12px; right: auto; transform: translateY(calc(100% + 12px)); }",
    "  .panel.pos-rechts { right: 12px; left: auto; transform: translateY(calc(100% + 12px)); }",
    "  .panel.pos-links.auf, .panel.pos-rechts.auf { transform: translateY(0); }",
    // Vollbild steht zuletzt und gewinnt darum über jede Lage.
    // width:auto statt 100vw: 100vw zählt die Scrollleiste mit und wäre auf
    // Seiten mit Scrollleiste rund 15px zu breit — das erzeugt auf der
    // Kundenseite eine waagrechte Scrollleiste, die vorher nicht da war.
    "  .panel.voll {",
    "    left: 0; right: 0; top: 0; bottom: 0; width: auto; max-width: none;",
    "    height: auto; max-height: none; border-radius: 0;",
    "    transform: translateY(100%);",
    "  }",
    "  .panel.voll.auf { transform: translateY(0); }",
    "}",

    "@media (max-width: 480px) {",
    "  .hinweis { display: none; }",
    "  .panel { right: 0; bottom: 0; width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; }",
    "  .bubble { bottom: 18px; right: 18px; }",
    "}",
    // Auf dem Handy bleibt die Pille mittig und kompakt; nur das Fenster wird
    // ganzflächig — dort fährt es weiterhin von unten hoch statt zu erscheinen.
    stil === "leiste"
      ? [
        "@media (max-width: 480px) {",
        "  .panel { left: 0; transform: translateY(100%); border-radius: 0; }",
        "  .panel.auf { transform: translateY(0); }",
        "}",
        "@media (max-width: 560px) {",
        "  .leiste { bottom: 14px; }",
        "  .l-figur { width: 38px; height: 38px; }",
        "  .l-text { font-size: 14px; }",
        "}",
      ].join("")
      : "",
    "</style>",
    '<div class="panel" id="panel"></div>',
    '<div class="hinweis" id="hinweis"><span class="zu" id="hinweisZu">×</span><span class="text" id="hinweisText"></span>' +
      '<div class="wahl" id="hinweisWahl"></div></div>',
    // Die ganze Pille ist EIN Knopf — nicht Figur, Text und Pfeil einzeln. Wer
    // sie anklickt, meint immer dasselbe, und mit der Tastatur ist es ein Halt
    // statt drei.
    stil === "leiste"
      ? '<button class="leiste" id="bubble" type="button" aria-label="Chat öffnen">' +
        '<span class="l-figur"><span class="figur" id="figur" hidden></span>' +
        '<span class="initial" id="initial"></span></span>' +
        '<span class="l-text" id="leisteTextEl"></span>' +
        '<span class="l-pfeil" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path></svg></span>' +
        "</button>"
      : '<button class="bubble" id="bubble" aria-label="Chat öffnen"><span class="figur" id="figur" hidden></span><span class="initial" id="initial"></span></button>',
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
  var hinweisWahl = root.getElementById("hinweisWahl");
  // Frame-Bereitschaft und eine ggf. wartende Frage (siehe stelleFrage weiter unten).
  var frameBereit = false;
  var offeneFrage = null;
  var leisteTextEl = root.getElementById("leisteTextEl");
  if (leisteTextEl) leisteTextEl.textContent = leisteText;

  // ── Lage des Fensters ──────────────────────────────────────────────────────
  // Der Besucher entscheidet, wo das Fenster steht, und es bleibt so — auch auf
  // der nächsten Unterseite. Wer es einmal nach links geschoben hat, hat es
  // dorthin geschoben, weil es rechts im Weg war; rechts wäre es dort wieder.
  // Gemerkt wird nur die Lage, pro Firma, im localStorage.
  var LAGE_KEY = "kiagent-lage-" + firma;
  // Erster Eintrag = Ausgangslage: rechts angedockt. Das ist die Ecke, in der
  // Besucher einen Chat erwarten, und sie verdeckt am wenigsten. Die
  // Gesprächsleiste kennt zusätzlich "mitte" als Lage, in die man zurück kann;
  // der Orb nur die beiden Seiten.
  var LAGEN = stil === "leiste" ? ["rechts", "links", "mitte"] : ["rechts", "links"];
  var lage = LAGEN[0];
  // Vollbild wird BEWUSST nicht gemerkt: Es ist ein Griff für den Moment ("jetzt
  // mehr sehen"), keine Vorliebe. Gemerkt käme es auf der nächsten Seite
  // ungefragt über den ganzen Bildschirm — der Besucher hat dort nichts
  // gewählt, er ist nur weitergeklickt. Die Lage dagegen ist eine Vorliebe.
  var vollbild = false;
  try {
    var gemerkt = JSON.parse(localStorage.getItem(LAGE_KEY) || "null");
    if (gemerkt && LAGEN.indexOf(gemerkt.lage) >= 0) lage = gemerkt.lage;
  } catch (e) { /* ohne Gedächtnis eben die Ausgangslage */ }

  function wendeLageAn() {
    panel.classList.remove("pos-mitte", "pos-links", "pos-rechts");
    panel.classList.add("pos-" + lage);
    if (vollbild) panel.classList.add("voll");
    else panel.classList.remove("voll");
  }
  function merkeLage() {
    try {
      localStorage.setItem(LAGE_KEY, JSON.stringify({ lage: lage }));
    } catch (e) { /* privater Modus o.ä. — dann gilt es nur für diesen Besuch */ }
  }
  wendeLageAn();
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
      // Die Pille spricht mit dem Namen der Figur ("Frag Mona etwas…"), sobald
      // er bekannt ist — ausser die Firma hat einen eigenen Satz gesetzt.
      var personaName = f && (f.persona || f.name);
      if (leisteTextEl && !script.hasAttribute("data-leiste-text") && personaName) {
        leisteTextEl.textContent = "Frag " + personaName + " etwas…";
      }
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

  // Beim Öffnen den Schreibcursor gleich in den Chat setzen: Wer die Pille
  // anklickt, will reden, nicht noch einmal zielen. NICHT auf dem Handy — dort
  // spränge sofort die Tastatur hoch und deckte die halbe Antwort zu, bevor
  // überhaupt eine da ist.
  function fokussiereFrame() {
    if (!frameEl || !frameEl.contentWindow) return;
    if (window.innerWidth <= 560) return;
    try {
      frameEl.contentWindow.postMessage({ type: "ki-agent-fokus" }, basis);
    } catch (e) { /* nie die Kundenseite stören */ }
  }

  // Dem Chat sagen, dass er das Fenster stellen darf — und wie es gerade steht.
  // Ohne diese Nachricht bleiben die Knöpfe im Chat-Kopf verborgen; so gibt es
  // sie nur dort, wo sie auch etwas bewirken.
  function meldeFensterAnFrame() {
    if (!frameEl || !frameEl.contentWindow) return;
    try {
      frameEl.contentWindow.postMessage(
        {
          type: "ki-agent-fenster", lagen: LAGEN, lage: lage, vollbild: vollbild,
          // Wie breit der BILDSCHIRM ist, kann der Frame nicht wissen: Er misst
          // sich selbst und ist angedockt immer schmal. Also von hier.
          schmal: window.innerWidth <= 480,
        },
        basis
      );
    } catch (e) { /* nie die Kundenseite stören */ }
  }

  // Das Fenster muss sichtbar (display) sein, BEVOR .auf kommt, sonst
  // überspringt der Browser die Fahrt. Ein erzwungenes Layout dazwischen ist
  // genau der Punkt, an dem der Startzustand verbindlich wird.
  var zuTimer = null;
  function oeffne() {
    versteckeHinweis();
    clearTimeout(zuTimer);
    if (!geladen) {
      var f = document.createElement("iframe");
      f.src = baueFrameUrl(); // Seiten-Kontext beim Öffnen mitgeben
      f.title = "Chat";
      f.setAttribute("allow", "clipboard-write; microphone");
      f.addEventListener("load", function () {
        frameBereit = true;
        sendeSeiteAnFrame();
        meldeFensterAnFrame();
        fokussiereFrame();
        // Hat der Besucher eine Antwortmoeglichkeit angeklickt, bevor der Frame
        // stand, wird sie jetzt nachgereicht.
        if (offeneFrage) {
          var f2 = offeneFrage; offeneFrage = null;
          stelleFrage(f2);
        }
      });
      panel.appendChild(f);
      frameEl = f;
      geladen = true;
    } else {
      // Schon geladen (Besucher öffnet erneut): Kontext auffrischen — bei
      // Single-Page-Shops kann sich die Seite inzwischen geändert haben.
      sendeSeiteAnFrame();
      meldeFensterAnFrame(); // Bildschirmbreite kann sich geändert haben
      fokussiereFrame();
    }
    starteAuffrischen();
    panel.classList.add("bereit");
    void panel.offsetWidth; // Startzustand festschreiben -> die Fahrt läuft wirklich
    panel.classList.add("auf");
    // Grosses Fenster deckt den Launcher ab -> ausblenden, solange offen (zu
    // wird über das × im Chat-Kopf). Beim Schliessen kommt er wieder.
    bubble.classList.remove("sichtbar");
    bubble.setAttribute("aria-label", "Chat schliessen");
    offen = true;
  }
  function schliesse() {
    stoppeAuffrischen();
    panel.classList.remove("auf");
    // Erst wegblenden lassen, dann aus dem Layout nehmen — sonst verschwindet
    // das Fenster schlagartig statt hinunterzufahren. Der iframe bleibt dabei
    // erhalten (das Gespräch geht beim nächsten Öffnen weiter).
    clearTimeout(zuTimer);
    zuTimer = setTimeout(function () { panel.classList.remove("bereit"); }, 500);
    bubble.classList.add("sichtbar"); // Orb bzw. Pille wieder zeigen
    bubble.setAttribute("aria-label", "Chat öffnen");
    offen = false;
  }
  bubble.addEventListener("click", function () { offen ? schliesse() : oeffne(); });

  // Wer das Browserfenster verkleinert, soll die Andock-Knöpfe verlieren, sobald
  // sie nichts mehr bewirken (und zurückbekommen, sobald wieder Platz ist).
  var breiteTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(breiteTimer);
    breiteTimer = setTimeout(meldeFensterAnFrame, 200);
  });

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
          cb(d && d.ansprechen && d.text ? { text: d.text, knoepfe: Array.isArray(d.knoepfe) ? d.knoepfe : [] } : null);
        })
        .catch(function () { if (!fertig) { fertig = true; clearTimeout(ab); cb(null); } });
    } catch (e) { if (!fertig) { fertig = true; clearTimeout(ab); cb(null); } }
  }
  function versteckeHinweis() {
    clearTimeout(hinweisTimer);
    hinweis.classList.remove("sichtbar");
  }
  function zeigeSatz(satz, knoepfe) {
    if (offen || !satz) return;
    hinweisTextEl.textContent = satz;

    // Antwort-Knoepfe. Per DOM gebaut, NIE per innerHTML: Die Beschriftungen
    // stammen aus einer Modell-Antwort, die ihrerseits Seitentext gelesen hat.
    // textContent kann nichts ausfuehren, eingeschleustes Markup bliebe Text.
    hinweisWahl.textContent = "";
    var liste = Array.isArray(knoepfe) ? knoepfe.slice(0, 2) : [];
    for (var i = 0; i < liste.length; i++) {
      (function (frage) {
        if (typeof frage !== "string" || !frage.trim()) return;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = frage;
        b.addEventListener("click", function (e) {
          e.stopPropagation();   // sonst greift zusaetzlich der Klick auf den Satz
          versteckeHinweis();
          oeffne();
          stelleFrage(frage);
        });
        hinweisWahl.appendChild(b);
      })(liste[i]);
    }

    hinweis.classList.add("sichtbar");
    schonAngesprochen++;
    letzteAnspracheZeit = Date.now();
    // Mit Knoepfen laenger stehen lassen: Sie wollen gelesen und abgewogen
    // werden, dafuer reichen acht Sekunden nicht.
    hinweisTimer = setTimeout(versteckeHinweis, liste.length ? 14000 : 8000);
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
    frageAnsprache(function (ergebnis) {
      anspracheLaeuft = false;
      if (ergebnis) zeigeSatz(ergebnis.text, ergebnis.knoepfe);
    });
  }

  // Eine angeklickte Antwortmoeglichkeit als erste Frage in den Chat geben.
  //
  // Der Frame muss dafuer bereit sein. Beim ERSTEN Oeffnen wird er gerade erst
  // erzeugt und geladen — eine sofort gesendete Nachricht ginge ins Leere.
  // Darum wird auf sein "bereit" gewartet, mit einer Obergrenze, damit ein
  // haengender Frame nicht ewig einen Timer offen haelt.
  function stelleFrage(frage) {
    // "geladen" heisst nur, dass das iframe ERZEUGT wurde — sein Skript und
    // damit sein Nachrichten-Empfaenger laufen zu dem Zeitpunkt noch nicht.
    // Eine sofort gesendete Nachricht ginge ins Leere, ohne Fehler: Wo niemand
    // zuhoert, verpufft postMessage stillschweigend.
    //
    // Deshalb wird beim ersten Oeffnen gemerkt und erst gesendet, wenn das
    // load-Ereignis des Frames kommt. Bis dahin sind seine Inline-Skripte
    // sicher gelaufen.
    if (frameBereit && frameEl && frameEl.contentWindow) {
      try {
        frameEl.contentWindow.postMessage({ type: "ki-agent-frage", frage: frage }, basis);
      } catch (e) { /* Frame weg -> Frage faellt weg, der Chat ist trotzdem offen */ }
      return;
    }
    offeneFrage = frage;
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
    // Nur der eigene Chat-Frame darf etwas anweisen — sonst könnte jedes
    // fremde Fenster die Seite fernsteuern.
    if (e.origin !== basis) return;
    if (e.data.type === "ki-agent-schliessen") schliesse();
    // Lage/Vollbild: der Chat sagt, was der Besucher gewählt hat — ausgeführt
    // und gemerkt wird es hier. Unbekannte Lagen werden verworfen, nicht
    // erraten; sonst stünde das Fenster nach einem Tippfehler nirgends.
    if (e.data.type === "ki-agent-lage" && LAGEN.indexOf(e.data.lage) >= 0) {
      lage = e.data.lage;
      vollbild = false; // andocken hebt das Vollbild auf, sonst sieht man nichts davon
      wendeLageAn();
      merkeLage();
    }
    if (e.data.type === "ki-agent-vollbild") {
      vollbild = !!e.data.an; // absichtlich nicht gemerkt, s.o.
      wendeLageAn();
    }
    if (e.data.type === "ki-agent-zustand" && typeof e.data.zustand === "string") {
      setFigurBild(e.data.zustand);
    }
    if (e.data.type === "ki-agent-aktion") fuehreAktionAus(e.data.aktion);
  });

  // ── Seiten-Aktionen ausführen ─────────────────────────────────────────────
  //
  // WAS HIER NICHT STEHT, PASSIERT NICHT. Es gibt genau zwei Aktionen, beide
  // ohne bleibende Folgen: zu einer Stelle scrollen und sie kurz hervorheben,
  // oder eine andere Seite DESSELBEN Shops öffnen (mit dem Zurück-Knopf
  // umkehrbar). Kein Klicken, kein Absenden, kein Warenkorb — ein Kauf ist die
  // Entscheidung des Besuchers.
  //
  // Serverseitig ist das schon geprüft. Hier wird es NOCH EINMAL geprüft, weil
  // die Anweisung aus einer Modell-Antwort stammt und das Modell Seitentexte
  // liest, die manipuliert sein können. Eine einzige Prüfstelle wäre eine
  // einzige Stelle zum Umgehen.
  var HEIKEL = /\b(kaufen|bestellen|bezahlen|zahlungspflichtig|absenden|abschicken|buy now|order now|checkout)\b/i;
  var markierung = null;

  function fuehreAktionAus(a) {
    try {
      if (!a || typeof a !== "object") return;
      if (a.aktion === "zeigen") return zeigeStelle(a.ziel);
      if (a.aktion === "oeffnen") return oeffneSeite(a.pfad);
      // alles andere: bewusst nichts
    } catch (e) { /* nie die Kundenseite stören */ }
  }

  function oeffneSeite(pfad) {
    if (typeof pfad !== "string") return;
    // Muss ein Pfad auf DIESER Seite sein. Absolute URLs werden gar nicht erst
    // akzeptiert — so ist "gleiche Herkunft" eine Frage der Form, nicht einer
    // Prüfung, die man falsch schreiben kann.
    if (!/^\/[^/\s]/.test(pfad)) return;
    location.href = pfad;
  }

  // Sucht die Stelle über ihren SICHTBAREN Text. Das Modell kann keine
  // CSS-Pfade kennen — es kennt nur, was auf der Seite steht.
  function findeStelle(text) {
    var suche = String(text || "").toLowerCase().trim();
    if (!suche) return null;
    var kandidaten = document.querySelectorAll(
      "h1,h2,h3,h4,dt,dd,th,td,summary,legend,label,p,li,section,article"
    );
    var bester = null;
    for (var i = 0; i < kandidaten.length; i++) {
      var el = kandidaten[i];
      var t = (el.textContent || "").toLowerCase();
      if (t.indexOf(suche) < 0) continue;
      // Der KLEINSTE Treffer ist der genaueste: <body> enthält den Text auch,
      // meint ihn aber nicht.
      if (!bester || t.length < (bester.textContent || "").length) bester = el;
    }
    return bester;
  }

  function zeigeStelle(ziel) {
    if (HEIKEL.test(String(ziel || ""))) return; // nicht auf Kaufknöpfe deuten
    var el = findeStelle(ziel);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Hervorheben über eine eigene Ebene statt über die Stile der Kundenseite:
    // so wird nichts an fremdem CSS verändert, das hinterher kaputt sein könnte.
    if (markierung && markierung.parentNode) markierung.parentNode.removeChild(markierung);
    var r = el.getBoundingClientRect();
    markierung = document.createElement("div");
    markierung.setAttribute("aria-hidden", "true");
    markierung.style.cssText = [
      "position:absolute", "z-index:2147482999", "pointer-events:none",
      "border-radius:6px",
      "box-shadow:0 0 0 3px " + farbe + ", 0 0 0 9999px rgba(15,23,42,0.08)",
      "transition:opacity .4s ease", "opacity:1",
      "left:" + (r.left + window.scrollX - 4) + "px",
      "top:" + (r.top + window.scrollY - 4) + "px",
      "width:" + (r.width + 8) + "px",
      "height:" + (r.height + 8) + "px",
    ].join(";");
    (document.body || document.documentElement).appendChild(markierung);
    var meine = markierung;
    setTimeout(function () { meine.style.opacity = "0"; }, 2200);
    setTimeout(function () {
      if (meine.parentNode) meine.parentNode.removeChild(meine);
      if (markierung === meine) markierung = null;
    }, 2800);
  }
})();
