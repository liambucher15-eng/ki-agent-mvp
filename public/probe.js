// Probefahrt: eigene Webseite scannen lassen und drei Fragen stellen.
//
// Ablauf: Adresse -> Scan -> Gespräch -> Abo. Kein Onboarding dazwischen und
// keines danach: Wer hier ankommt, will nicht eingerichtet werden, er will
// sehen, ob das Ding taugt.
//
// Was hier bewusst NICHT passiert: mitzählen, wie viele Fragen noch offen
// sind. Der Zähler oben ist Anzeige, nicht Schranke — die Grenze zieht der
// Server (netlify/functions/chat.js, PROBE_FRAGEN, atomar in der Datenbank).
// Ein Zähler im Browser wäre in zwei Sekunden umgangen.

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Die Kopfzeile ist fixed und damit aus dem Fluss; die Karte rechnet ihre
  // Hoehe davon ab (--kopf-hoehe in lib/probe.css). Der Vorgabewert dort ist
  // gemessen, aber er veraltet, sobald die Kopfzeile sich aendert oder auf
  // einem schmalen Schirm umbricht. Darum hier nachmessen.
  function misseKopf() {
    const k = $("kopf");
    if (!k) return;
    const h = Math.round(k.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty("--kopf-hoehe", h + "px");
  }
  misseKopf();
  addEventListener("resize", misseKopf);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(misseKopf);

  let probeId = null;   // die jobId des Scans, zugleich der Schlüssel zum Gespräch
  let verlauf = [];     // Gesprächsverlauf für chat.js
  let laeuft = false;   // verhindert doppelte Absendung
  let fertig = false;   // Kontingent aufgebraucht — nicht mehr absenden

  // ── Stufen und Filme ──────────────────────────────────────────────────
  // Beide werden zusammen umgeschaltet, damit der Film nie zu einem Schritt
  // steht, der gar nicht mehr sichtbar ist.
  function zeige(name) {
    for (const el of document.querySelectorAll(".stufe")) {
      el.hidden = el.dataset.stufe !== name;
    }
    for (const film of document.querySelectorAll(".film")) {
      const dran = film.dataset.fuer === name;
      film.hidden = !dran;
      const v = film.querySelector("video");
      if (!v) continue;
      // Verdeckte Filme anhalten: Sie kosten sonst weiter Rechenzeit, und auf
      // dem Handy heisst das Akku für ein Bild, das niemand sieht.
      if (dran) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      else v.pause();
    }
  }

  // ── Stufe 1: Adresse ──────────────────────────────────────────────────

  // Grobe Plausibilität, mehr nicht: Die echte Prüfung macht der Server, der
  // die Seite tatsächlich abruft. Hier geht es nur darum, offensichtlichen
  // Unsinn abzufangen, bevor jemand vierzig Sekunden wartet.
  function sinnvolleAdresse(wert) {
    const roh = wert.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$/i.test(roh);
  }

  $("formular").addEventListener("submit", (e) => {
    e.preventDefault();
    const wert = $("adresse").value.trim();
    const fehler = $("adresseFehler");
    if (!sinnvolleAdresse(wert)) {
      fehler.textContent = "Das sieht nicht nach einer Webadresse aus. Beispiel: deine-firma.ch";
      return;
    }
    fehler.textContent = "";
    starte(wert);
  });

  $("nochmalKnopf").addEventListener("click", () => {
    zeige("adresse");
    $("adresse").focus();
  });

  // "Andere Seite testen" nach dem Abschluss: Die Seite wird frisch geladen.
  // Ein Zurücksetzen von Hand müsste Verlauf, Zähler, Sperren und probeId
  // gleichzeitig treffen — ein vergessenes Stück davon wäre ein Gespräch, das
  // zur falschen Firma gehört.
  $("andereSeite").addEventListener("click", () => { location.href = "probe.html"; });

  // ── Stufe 2: Scan ─────────────────────────────────────────────────────

  const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

  function setzeSchritt(name, stand) {
    const el = document.querySelector('#schritteListe li[data-schritt="' + name + '"]');
    if (el) el.dataset.stand = stand;
  }

  // Die vier Zeilen laufen mit einer Zeitschätzung mit, weil der Server keinen
  // Fortschritt meldet — scan-status kennt nur running/done/error. Ehrlich
  // bleibt es trotzdem: Die letzte Zeile bleibt auf "läuft" stehen, bis das
  // echte Ergebnis da ist. Keine Zeile wird abgehakt, die noch offen ist.
  function starteWarteanzeige() {
    const folge = ["laden", "unterseiten", "lesen", "ordnen"];
    folge.forEach((n) => setzeSchritt(n, "offen"));
    let i = 0;
    setzeSchritt(folge[0], "laeuft");
    return setInterval(() => {
      if (i >= folge.length - 1) return;   // letzte Zeile nie von allein abhaken
      setzeSchritt(folge[i], "fertig");
      setzeSchritt(folge[++i], "laeuft");
    }, 7000);
  }

  async function starte(adresse) {
    zeige("scan");
    $("wartenAdresse").textContent = adresse;
    const takt = starteWarteanzeige();

    try {
      const jobId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now() + "-" + Math.random().toString(36).slice(2);

      // probe: true — der Server scannt dann sparsam (Startseite + 2 statt 12)
      // und markiert den Job als Probefahrt. Nur solche Jobs dürfen später als
      // Gesprächsgrundlage dienen.
      const start = await fetch("/.netlify/functions/scan-background", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: adresse, jobId, probe: true }),
      });
      if (start.status === 429) throw new Error("Gerade sind zu viele Probefahrten unterwegs. Bitte in einer Minute nochmal.");
      if (start.status !== 202 && !start.ok) throw new Error("Der Scan liess sich nicht starten.");

      let ergebnis = null, pannen = 0;
      for (let versuch = 0; versuch < 60; versuch++) {
        await schlaf(1500);
        let s;
        try {
          const r = await fetch("/.netlify/functions/scan-status?jobId=" + encodeURIComponent(jobId));
          s = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(s.error || "Status nicht abrufbar (" + r.status + ")");
        } catch (e) {
          // Ein einzelner Netz-Hänger ist kein Abbruchgrund; drei am Stück schon.
          if (++pannen >= 3) throw new Error(e.message || "Server nicht erreichbar");
          continue;
        }
        pannen = 0;
        if (s.status === "done") { ergebnis = s.ergebnis; break; }
        if (s.status === "error") throw new Error(s.fehler || "Die Seite liess sich nicht lesen.");
      }
      if (!ergebnis) throw new Error("Das hat zu lange gedauert.");

      clearInterval(takt);
      ["laden", "unterseiten", "lesen", "ordnen"].forEach((n) => setzeSchritt(n, "fertig"));
      probeId = jobId;
      oeffneGespraech(ergebnis, adresse);
    } catch (e) {
      clearInterval(takt);
      $("fehlerText").textContent = e.message || "Unbekannter Fehler.";
      zeige("fehler");
    }
  }

  // ── Stufe 3: Gespräch ─────────────────────────────────────────────────

  // Ans Ende des Verlaufs. Steht als eigene Funktion da, weil sie an zwei
  // Stellen gebraucht wird: bei jeder neuen Blase und nach dem Abschluss.
  function ansEnde() {
    const v = $("verlauf");
    v.scrollTop = v.scrollHeight;
  }

  function blase(klasse, text) {
    const el = document.createElement("div");
    el.className = "blase " + klasse;
    // textContent, nicht innerHTML: Der Firmenname stammt von einer FREMDEN
    // Seite. Einer mit einem <script>-Tag darin wäre sonst genau das, wonach
    // er aussieht.
    el.textContent = text;
    $("verlauf").append(el);
    ansEnde();
    return el;
  }

  // Drei Vorschläge, die zur gescannten Seite passen. Nur was auch gefunden
  // wurde: Eine Frage nach Öffnungszeiten an eine Seite ohne Öffnungszeiten
  // führt zu einer Fehlanzeige als erster Antwort — der denkbar schlechteste
  // erste Eindruck.
  function baueVorschlaege(d) {
    const liste = [];
    if (d.angebot || (Array.isArray(d.leistungen) && d.leistungen.length)) liste.push("Was bietet ihr genau an?");
    if (d.oeffnungszeiten) liste.push("Wann habt ihr offen?");
    if (d.kontakt) liste.push("Wie erreiche ich euch am schnellsten?");
    if (d.preise) liste.push("Was kostet das ungefähr?");
    if (d.adresse) liste.push("Wo seid ihr?");
    if (!liste.length) liste.push("Was macht ihr?");

    const kasten = $("vorschlaege");
    kasten.textContent = "";
    for (const text of liste.slice(0, 3)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "vorschlag";
      b.textContent = text;
      b.addEventListener("click", () => {
        if (fertig) return;
        $("frage").value = text;
        $("frage").focus();
      });
      kasten.append(b);
    }
    kasten.hidden = false;
  }

  // Kein Befund-Raster mehr: Dass die Seite gelesen wurde, belegt seine erste
  // Zeile besser als eine Tabelle. Sie nennt die Firma beim Namen — etwas,
  // das nur dort stehen kann, wenn wirklich gelesen wurde.
  function oeffneGespraech(d, adresse) {
    const seiten = Array.isArray(d.gescannt) ? d.gescannt.length : 1;
    $("chatTitel").textContent = d.name ? d.name : "Deine Seite";

    const gelesen = seiten === 1 ? "deine Startseite" : seiten + " Seiten";
    blase(
      "blase-er",
      d.name
        ? "Ich habe " + gelesen + " von " + d.name + " gelesen. Frag mich etwas darüber — du hast drei Fragen."
        : "Ich habe " + gelesen + " von " + adresse + " gelesen. Frag mich etwas darüber — du hast drei Fragen."
    );

    baueVorschlaege(d);
    zeige("chat");
    $("frage").focus();
  }

  function setzeZaehler(uebrig) {
    const el = $("zaehler");
    if (uebrig === 0) {
      el.textContent = "Keine Frage mehr offen";
      el.dataset.leer = "ja";
    } else {
      el.textContent = uebrig === 1 ? "1 Frage offen" : uebrig + " Fragen offen";
      delete el.dataset.leer;
    }
  }

  function beendeGespraech() {
    fertig = true;
    // Eingabe ganz weg statt nur gesperrt: Ein gesperrtes Feld mit Knopf
    // daneben sieht aus wie etwas, das gleich wieder aufgeht. Hier geht
    // nichts mehr auf — an seine Stelle tritt der Abschluss.
    $("frage").value = "";
    $("frageForm").hidden = true;
    $("vorschlaege").hidden = true;
    $("frageHinweis").textContent = "";
    $("probe-abschluss").hidden = false;
    // Ans Ende scrollen, NACHDEM der Abschluss Platz genommen hat.
    //
    // Am echten Durchlauf nachgemessen: Der Verlauf stand bei scrollTop 505
    // statt 665. Er war ans Ende der ALTEN Aufteilung gescrollt — Verlauf noch
    // 611 px hoch, Eingabe noch da — bevor der Abschluss seinen Platz genommen
    // und den Verlauf auf 451 px verkuerzt hatte. Die letzte Antwort ragte
    // dadurch 160 px unter den sichtbaren Bereich: ausgerechnet die Antwort,
    // die ueberzeugen soll.
    //
    // setTimeout statt requestAnimationFrame: rAF laeuft NICHT, solange das
    // Blatt nicht gezeichnet wird (Hintergrund-Tab, minimiertes Fenster). Genau
    // dann bliebe die Korrektur aus und der Besucher faende beim Zurueckkommen
    // eine halb abgeschnittene Antwort vor. setTimeout feuert unabhaengig davon.
    // Der erste Aufruf greift sofort, der zweite in der dann gueltigen Geometrie.
    ansEnde();
    setTimeout(ansEnde, 0);
  }

  $("frageForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    // fertig zuerst: Ein gesperrtes Eingabefeld verhindert das Absenden NICHT
    // zuverlässig (requestSubmit, Autofill-Eigenheiten). Ohne diese Zeile ging
    // die vierte Frage noch zum Server — abgelehnt zwar, aber unnötig.
    if (laeuft || fertig) return;
    const text = $("frage").value.trim();
    if (!text || !probeId) return;

    laeuft = true;
    $("frage").value = "";
    $("frageKnopf").disabled = true;
    $("vorschlaege").hidden = true;
    const meine = blase("blase-du", text);
    verlauf.push({ role: "user", content: text });
    const denkt = blase("blase-er blase-denkt", "denkt nach …");

    try {
      const r = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: verlauf, probeId }),
      });
      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        denkt.remove();
        // Die abgelehnte Frage verschwindet aus dem Verlauf UND aus dem Bild.
        // Bliebe die Blase stehen, sähe der Besucher eine Frage, die das Modell
        // nie bekommen hat — die nächste Antwort würde sich auf nichts beziehen.
        meine.remove();
        verlauf.pop();
        blase("blase-fehler", d.error || "Das hat nicht geklappt.");
        if (r.status === 429) beendeGespraech();
        return;
      }

      denkt.remove();
      blase("blase-er", d.reply || "");
      verlauf.push({ role: "assistant", content: d.reply || "" });

      if (typeof d.probeUebrig === "number") {
        setzeZaehler(d.probeUebrig);
        if (d.probeUebrig === 0) beendeGespraech();
      }
    } catch (err) {
      denkt.remove();
      meine.remove();
      verlauf.pop();
      blase("blase-fehler", "Der Server ist gerade nicht erreichbar.");
    } finally {
      laeuft = false;
      if (!fertig) { $("frageKnopf").disabled = false; $("frage").focus(); }
    }
  });

  // ── Einstieg ──────────────────────────────────────────────────────────
  // Die Startseite schickt die Adresse per ?url= mit. Dann direkt loslegen,
  // statt sie den Besucher ein zweites Mal tippen zu lassen.
  const ausUrl = new URLSearchParams(location.search).get("url");
  if (ausUrl && sinnvolleAdresse(ausUrl)) {
    $("adresse").value = ausUrl.trim();
    starte(ausUrl.trim());
  } else {
    if (ausUrl) $("adresse").value = ausUrl.trim();
    $("adresse").focus();
  }
})();
