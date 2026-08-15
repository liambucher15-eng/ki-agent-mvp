// Probefahrt: eigene Webseite scannen lassen und drei Fragen stellen.
//
// Der Ablauf in vier Stufen: Adresse -> Warten -> Ergebnis -> drei Fragen.
//
// Was hier bewusst NICHT passiert: mitzählen, wie viele Fragen noch offen sind.
// Der Zähler unten in der Ecke ist Anzeige, nicht Schranke — die Grenze zieht
// der Server (netlify/functions/chat.js, PROBE_FRAGEN, atomar in der Datenbank).
// Ein Zähler im Browser wäre in zwei Sekunden umgangen.

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const stufen = {
    adresse: $("stufeAdresse"),
    warten: $("stufeWarten"),
    fehler: $("stufeFehler"),
    ergebnis: $("stufeErgebnis"),
  };

  let probeId = null;   // die jobId des Scans, zugleich der Schlüssel zum Gespräch
  let verlauf = [];     // Gesprächsverlauf für chat.js
  let laeuft = false;   // verhindert doppelte Absendung
  let fertig = false;   // Kontingent aufgebraucht — nicht mehr absenden

  function zeige(name) {
    for (const [schluessel, el] of Object.entries(stufen)) el.hidden = schluessel !== name;
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

  // ── Stufe 2: Scan ─────────────────────────────────────────────────────

  const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

  function setzeSchritt(name, stand) {
    const el = document.querySelector('#schritteListe li[data-schritt="' + name + '"]');
    if (el) el.dataset.stand = stand;
  }

  // Die vier Zeilen der Warteliste laufen mit einer Zeitschätzung mit, weil der
  // Server keinen Fortschritt meldet — scan-status kennt nur running/done/error.
  // Ehrlich bleibt es trotzdem: Die letzte Zeile bleibt auf "läuft" stehen, bis
  // das echte Ergebnis da ist. Keine Zeile wird abgehakt, die noch offen ist.
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
    zeige("warten");
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
      zeigeErgebnis(ergebnis, adresse);
    } catch (e) {
      clearInterval(takt);
      $("fehlerText").textContent = e.message || "Unbekannter Fehler.";
      zeige("fehler");
    }
  }

  // ── Stufe 3: Ergebnis ─────────────────────────────────────────────────

  // DOM statt innerHTML: Der ganze Befund stammt von einer FREMDEN Seite. Ein
  // Firmenname mit einem <script>-Tag darin wäre sonst genau das, wonach er
  // aussieht.
  function feld(titel, wert, breit) {
    const box = document.createElement("dl");
    box.className = "befund-feld" + (breit ? " breit" : "");
    const dt = document.createElement("dt");
    dt.textContent = titel;
    const dd = document.createElement("dd");
    dd.textContent = wert;
    box.append(dt, dd);
    return box;
  }

  function zeigeErgebnis(d, adresse) {
    const seiten = Array.isArray(d.gescannt) ? d.gescannt.length : 1;
    $("ergebnisQuelle").textContent =
      seiten === 1 ? "Gelesen: die Startseite von " + adresse
                   : "Gelesen: " + seiten + " Seiten von " + adresse;

    // Der Firmenname steht über dem Raster statt darin: Als Kachel liess er die
    // halbe Zeile leer, und er ist ohnehin der Befund, der als erstes überzeugt.
    const nameEl = $("ergebnisName");
    nameEl.textContent = d.name || "";
    nameEl.hidden = !d.name;

    const befund = $("befund");
    befund.textContent = "";
    if (d.angebot) befund.append(feld("Angebot", d.angebot, true));
    if (d.oeffnungszeiten) befund.append(feld("Öffnungszeiten", d.oeffnungszeiten));
    if (d.adresse) befund.append(feld("Adresse", d.adresse));
    if (d.kontakt) befund.append(feld("Kontakt", d.kontakt));
    if (Array.isArray(d.leistungen) && d.leistungen.length) {
      befund.append(feld("Leistungen", d.leistungen.slice(0, 8).join("\n"), true));
    }
    if (d.preise) befund.append(feld("Preise", d.preise));
    if (!befund.children.length) {
      befund.append(feld("Gefunden", "Auf dieser Seite stand kaum Text, den ich einordnen konnte.", true));
    }

    // Fehlendes benennen statt verschweigen. Das ist der ehrlichste Teil der
    // Seite — und zugleich der beste Grund, weiterzumachen.
    const fehlt = [
      !d.oeffnungszeiten && "Öffnungszeiten",
      !d.adresse && "Adresse",
      !d.kontakt && "Kontaktweg (Telefon oder E-Mail)",
      !d.preise && "Preise",
      !(Array.isArray(d.faq) && d.faq.length) && "häufige Fragen",
    ].filter(Boolean);
    if (fehlt.length) {
      const liste = $("lueckenListe");
      liste.textContent = "";
      for (const f of fehlt) {
        const li = document.createElement("li");
        li.textContent = f;
        liste.append(li);
      }
      $("luecken").hidden = false;
    }

    // Die Adresse an das Onboarding weiterreichen, damit sie dort nicht noch
    // einmal getippt werden muss (onboarding.js liest ?webseite= aus).
    $("weiterKnopf").href = "onboarding-aura.html?webseite=" + encodeURIComponent(adresse);

    zeige("ergebnis");
    $("frage").focus();
  }

  // ── Stufe 4: drei Fragen ──────────────────────────────────────────────

  function blase(klasse, text) {
    const el = document.createElement("div");
    el.className = "blase " + klasse;
    el.textContent = text;
    $("verlauf").append(el);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return el;
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

  const AUFGEBRAUCHT = "Das waren die drei Fragen. Mit einem Konto geht es unbegrenzt weiter.";

  function beendeGespraech() {
    fertig = true;
    // Auch leeren: Ein gesperrtes Feld mit stehengebliebenem Text sieht aus wie
    // eine Eingabe, die noch abgeschickt werden könnte.
    $("frage").value = "";
    $("frage").disabled = true;
    $("frageKnopf").disabled = true;
    $("frageHinweis").textContent = AUFGEBRAUCHT;
    $("weiter").hidden = false;
    $("weiter").scrollIntoView({ block: "nearest", behavior: "smooth" });
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
