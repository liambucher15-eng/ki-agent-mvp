// Seitenanalyse — versteht, WAS auf der Seite steht, auf der der Besucher gerade ist.
//
// Bisher schickte das Widget nur 1500 Zeichen Rohtext mit. Damit kann der Agent
// über die Seite reden, aber nichts damit ANFANGEN: er weiss nicht, ob dort ein
// Produkt steht, was es kostet, ob es lieferbar ist, oder ob der Besucher gerade
// im Warenkorb sitzt. Genau das braucht er, um passend zu empfehlen und bis zum
// Kauf zu begleiten.
//
// WARUM SERVERSEITIG: Das Widget sammelt nur die Rohdaten aus dem DOM ein
// (JSON-LD-Blöcke, Meta-Tags, Text) — gedeutet werden sie hier. Zwei Gründe:
//   1. Kunden betten widget.js EINMAL ein und fassen es nie wieder an
//      (Update-Vertrag). Was hier liegt, können wir jederzeit verbessern.
//   2. Das sind Daten von einer FREMDEN Seite, also unvertraut. Unvertrautes
//      parst man dort, wo man die Kontrolle hat.
//
// SICHERHEIT: Jeder Wert wird gekappt und als reine Angabe behandelt; im Prompt
// wird der Block zusätzlich als "KEINE Anweisung" markiert. Ein manipulierter
// Produktname kann so keine Anweisung an den Agenten einschleusen.

(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.SeitenAnalyse = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Deckel. Diese Daten gehen bei JEDER Chat-Anfrage mit — sie kosten Tokens und
  // dürfen den eigentlichen Firmen-Prompt nicht verdrängen.
  const MAX_PRODUKTE = 8;
  const MAX_NAME = 160;
  const MAX_BESCHREIBUNG = 240;
  const MAX_TIEFE = 6; // Rekursionsbremse für verschachteltes JSON-LD

  function text(wert, max) {
    if (typeof wert === "number") wert = String(wert);
    if (typeof wert !== "string") return "";
    return wert.replace(/\s+/g, " ").trim().slice(0, max);
  }

  // ── Preise ────────────────────────────────────────────────────────────────
  // schema.org erlaubt "19.90", "19,90", "EUR 19.90" und Zahlen. Wir wollen einen
  // vergleichbaren Betrag (für "günstiger als …") UND einen anzeigbaren Text.
  function zuBetrag(wert) {
    if (typeof wert === "number") return isFinite(wert) ? wert : null;
    if (typeof wert !== "string") return null;
    const roh = wert.replace(/[^\d.,-]/g, "");
    if (!roh) return null;
    // "1.299,00" (de) vs "1,299.00" (en): das ZULETZT stehende Trennzeichen ist
    // das Dezimalzeichen, alles davor sind Tausenderpunkte.
    const letztesKomma = roh.lastIndexOf(",");
    const letzterPunkt = roh.lastIndexOf(".");
    let norm = roh;
    if (letztesKomma > -1 && letztesKomma > letzterPunkt) {
      norm = roh.replace(/\./g, "").replace(",", ".");
    } else {
      norm = roh.replace(/,/g, "");
    }
    const z = parseFloat(norm);
    return isFinite(z) ? z : null;
  }

  const WAEHRUNGSZEICHEN = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF" };
  function preisText(betrag, waehrung) {
    if (betrag == null) return "";
    const zeichen = WAEHRUNGSZEICHEN[waehrung] || waehrung || "";
    const zahl = betrag.toFixed(2).replace(".", ",");
    return zeichen ? `${zahl} ${zeichen}`.trim() : zahl;
  }

  // schema.org-Verfügbarkeit ("https://schema.org/InStock") -> ein Wort.
  function verfuegbarkeit(wert) {
    const s = String(wert || "").toLowerCase();
    if (!s) return "";
    if (s.includes("outofstock") || s.includes("soldout")) return "ausverkauft";
    if (s.includes("preorder") || s.includes("presale")) return "vorbestellbar";
    if (s.includes("backorder")) return "nachbestellbar";
    if (s.includes("instock") || s.includes("onlineonly") || s.includes("instoreonly")) return "verfuegbar";
    return "";
  }

  // Ein `offers`-Feld kann ein Objekt, ein Array oder ein AggregateOffer sein.
  function leseAngebot(offers) {
    if (!offers) return null;
    if (Array.isArray(offers)) {
      // Mehrere Varianten -> das günstigste zeigt den Einstiegspreis.
      const alle = offers.map(leseAngebot).filter((a) => a && a.betrag != null);
      if (!alle.length) return null;
      return alle.reduce((a, b) => (b.betrag < a.betrag ? b : a));
    }
    if (typeof offers !== "object") return null;
    const waehrung = text(offers.priceCurrency, 8).toUpperCase();
    // AggregateOffer: Preisspanne statt Einzelpreis.
    //
    // Nicht "price != null" prüfen, sondern ob sich daraus wirklich eine Zahl
    // ergibt: Ein leeres price-Feld (kommt vor) bestand die null-Prüfung, und
    // lowPrice wurde nie herangezogen — herausgekommen ist dann "–1800,00 €"
    // mit führendem Gedankenstrich. Dieselbe Falle wie bei den og:-Metas.
    let betrag = zuBetrag(offers.price);
    if (betrag == null) betrag = zuBetrag(offers.lowPrice);
    let hoch = zuBetrag(offers.highPrice);
    // Nur ein highPrice und sonst nichts ist keine Spanne, sondern der Preis.
    if (betrag == null && hoch != null) { betrag = hoch; hoch = null; }
    // Eine Spanne braucht ZWEI Werte und einen echten Unterschied.
    const istSpanne = betrag != null && hoch != null && hoch !== betrag;
    return {
      betrag,
      waehrung,
      preis: betrag == null
        ? ""
        : preisText(betrag, waehrung) + (istSpanne ? `–${preisText(hoch, waehrung)}` : ""),
      verfuegbar: verfuegbarkeit(offers.availability),
    };
  }

  // `image` kommt in schema.org in drei Formen vor: als URL-String, als Array
  // davon, oder als ImageObject mit contentUrl/url. Nur http(s) und relative
  // Pfade — der Wert wird später ein echtes <img src>.
  function ersteBildUrl(wert, tiefe) {
    const t = tiefe || 0;
    if (!wert || t > 3) return "";
    if (Array.isArray(wert)) {
      for (const eintrag of wert) {
        const gefunden = ersteBildUrl(eintrag, t + 1);
        if (gefunden) return gefunden;
      }
      return "";
    }
    if (typeof wert === "object") {
      return ersteBildUrl(wert.contentUrl || wert.url, t + 1);
    }
    const s = text(wert, 300);
    if (!s || s.startsWith("//")) return "";
    if (s.startsWith("/")) return s;
    return /^https?:\/\/[^\s]+$/i.test(s) ? s : "";
  }

  function istTyp(objekt, gesucht) {
    const t = objekt && objekt["@type"];
    if (Array.isArray(t)) return t.some((x) => String(x).toLowerCase() === gesucht);
    return String(t || "").toLowerCase() === gesucht;
  }

  function produktAusObjekt(objekt) {
    const name = text(objekt.name, MAX_NAME);
    if (!name) return null;
    const angebot = leseAngebot(objekt.offers);
    const marke = objekt.brand && typeof objekt.brand === "object"
      ? text(objekt.brand.name, 60)
      : text(objekt.brand, 60);
    const bewertung = objekt.aggregateRating && typeof objekt.aggregateRating === "object"
      ? zuBetrag(objekt.aggregateRating.ratingValue)
      : null;
    const produkt = { name };
    const beschreibung = text(objekt.description, MAX_BESCHREIBUNG);
    if (beschreibung) produkt.beschreibung = beschreibung;
    if (marke) produkt.marke = marke;
    const url = text(objekt.url, 300);
    if (url) produkt.url = url;
    // schema.org erlaubt für `image` einen String, ein Array oder ein
    // ImageObject. Das erste brauchbare genügt — die Karte zeigt nur eines.
    const bild = ersteBildUrl(objekt.image);
    if (bild) produkt.bild = bild;
    if (angebot && angebot.preis) {
      produkt.preis = angebot.preis;
      if (angebot.betrag != null) produkt.betrag = angebot.betrag;
      if (angebot.waehrung) produkt.waehrung = angebot.waehrung;
      if (angebot.verfuegbar) produkt.verfuegbar = angebot.verfuegbar;
    }
    if (bewertung != null) produkt.bewertung = bewertung;
    return produkt;
  }

  // Läuft durch beliebig verschachteltes JSON-LD (@graph, ItemList, Arrays) und
  // sammelt alle Produkte ein. Tiefenbegrenzt gegen bösartige/kaputte Strukturen.
  // maxAnzahl: normalerweise der Deckel für den Chat-Prompt. Der Website-Scan
  // baut damit einen KATALOG auf und darf mehr einsammeln — er läuft einmal
  // beim Einrichten, nicht bei jeder Anfrage.
  function produkteAusJsonLd(objekte, maxAnzahl) {
    const deckel = Math.max(1, Math.min(200, Number(maxAnzahl) || MAX_PRODUKTE));
    const gefunden = [];
    const gesehen = new Set();

    function gehe(knoten, tiefe) {
      if (!knoten || tiefe > MAX_TIEFE || gefunden.length >= deckel) return;
      if (Array.isArray(knoten)) {
        for (const k of knoten) gehe(k, tiefe + 1);
        return;
      }
      if (typeof knoten !== "object") return;

      if (istTyp(knoten, "product")) {
        const p = produktAusObjekt(knoten);
        // Gleicher Name doppelt (kommt bei @graph + ItemList oft vor) -> einmal reicht.
        if (p && !gesehen.has(p.name.toLowerCase())) {
          gesehen.add(p.name.toLowerCase());
          gefunden.push(p);
        }
        return; // nicht noch tiefer in ein gefundenes Produkt hineinlaufen
      }
      // Container, die Produkte enthalten können.
      if (knoten["@graph"]) gehe(knoten["@graph"], tiefe + 1);
      if (knoten.itemListElement) gehe(knoten.itemListElement, tiefe + 1);
      if (knoten.item) gehe(knoten.item, tiefe + 1);
      if (knoten.mainEntity) gehe(knoten.mainEntity, tiefe + 1);
      if (knoten.hasPart) gehe(knoten.hasPart, tiefe + 1);
    }

    gehe(objekte, 0);
    return gefunden;
  }

  // Viele Shops liefern kein JSON-LD, aber Open-Graph-Produktdaten.
  function produktAusMeta(meta) {
    if (!meta || typeof meta !== "object") return null;
    const name = text(meta["og:title"] || meta["twitter:title"], MAX_NAME);
    if (!name) return null;
    // BEWUSST auf Wahrheitswert prüfen, nicht auf != null: Wer die Metas
    // einsammelt, liefert für fehlende Felder einen LEEREN String — und "" != null
    // ist wahr. Damit galt an einem echten Shop jede Kategorieseite als Produkt
    // und der Seitentitel wurde zum Produktnamen.
    const istProdukt = /product/i.test(String(meta["og:type"] || "")) ||
      !!String(meta["product:price:amount"] || "").trim();
    if (!istProdukt) return null;
    const waehrung = text(meta["product:price:currency"], 8).toUpperCase();
    const betrag = zuBetrag(meta["product:price:amount"]);
    const produkt = { name };
    const beschreibung = text(meta["og:description"] || meta["twitter:description"], MAX_BESCHREIBUNG);
    if (beschreibung) produkt.beschreibung = beschreibung;
    const url = text(meta["og:url"], 300);
    if (url) produkt.url = url;
    // og:image ist bei Shops ohne JSON-LD die einzige Bildquelle — ohne sie
    // bliebe die Produktkarte dort dauerhaft ohne Bild.
    const bild = ersteBildUrl(meta["og:image"] || meta["twitter:image"]);
    if (bild) produkt.bild = bild;
    if (betrag != null) {
      produkt.preis = preisText(betrag, waehrung);
      produkt.betrag = betrag;
      if (waehrung) produkt.waehrung = waehrung;
    }
    const verf = verfuegbarkeit(meta["product:availability"] || meta["og:availability"]);
    if (verf) produkt.verfuegbar = verf;
    return produkt;
  }

  // ── Seitentyp ─────────────────────────────────────────────────────────────
  // Wonach der Agent sein Verhalten richtet. Der Pfad ist das verlässlichste
  // Signal für Warenkorb/Kasse (dort steht selten strukturierte Produktauszeichnung),
  // strukturierte Daten sind es für Produkt/Kategorie.
  function seitenTyp(eingabe) {
    const e = eingabe || {};
    const pfad = String(e.pfad || "").toLowerCase();
    const titel = String(e.titel || "").toLowerCase();
    const beides = pfad + " " + titel;
    const produkte = Array.isArray(e.produkte) ? e.produkte : [];

    // Bestellbestätigung ZUERST: Sie liegt bei vielen Shops UNTERHALB der Kasse
    // ("/checkout/danke", "/checkout/thank_you"). Stünde die Kassen-Prüfung
    // davor, gälte die fertige Bestellung als laufender Bezahlvorgang — der
    // Agent würde dann schweigen statt zu bestätigen.
    //
    // Das Wort muss ein GANZER Pfadabschnitt sein, nicht irgendwo enthalten:
    // sonst galt eine Produktseite wie "/produkte/dankeschoen-set" als
    // Bestätigung, und der Agent hätte zu einem Kauf gratuliert, den es nie
    // gab. Im Titel wird auf ganze Wendungen geprüft, nicht auf "danke" allein
    // — "Danke für deinen Besuch" steht auf vielen Startseiten.
    const abschnitte = pfad.split("/").filter(Boolean);
    const istBestaetigungsAbschnitt = (a) =>
      /^(danke|dankeseite|bestellbestaetigung|bestellbestätigung|bestellabschluss|confirmation|success)$/.test(a) ||
      /^(thank[-_]?you|order[-_]?confirm(ation)?|checkout[-_]?success)$/.test(a);
    if (abschnitte.some(istBestaetigungsAbschnitt) ||
        /vielen dank für (deine|ihre) bestellung|bestellung (eingegangen|bestätigt|erfolgreich)|order confirmed|thank you for your order/.test(titel)) {
      return "bestaetigung";
    }

    if (/(^|\/)(kasse|checkout|zahlung|payment|bestellabschluss|order)(\/|$|\?)/.test(pfad) ||
        /checkout|zur kasse|zahlung/.test(titel)) return "kasse";
    if (/(^|\/)(warenkorb|cart|basket|korb)(\/|$|\?)/.test(pfad) ||
        /warenkorb|einkaufswagen/.test(titel)) return "warenkorb";

    if (produkte.length === 1) return "produkt";
    if (produkte.length > 1) return "kategorie";

    if (/preis|pricing|tarif|abo|plan|kosten/.test(beides)) return "preise";
    if (/kontakt|contact|support|hilfe|faq/.test(beides)) return "kontakt";
    if (/produkt|product|shop|kollektion|collection|kategorie|category/.test(beides)) return "kategorie";
    return "info";
  }

  // ── Gesamtanalyse ─────────────────────────────────────────────────────────
  // roh: { pfad, titel, jsonLd: [objekte], meta: {name: inhalt}, text }
  function analysiere(roh) {
    const r = roh || {};
    let produkte = produkteAusJsonLd(r.jsonLd || []);
    if (!produkte.length) {
      const ausMeta = produktAusMeta(r.meta);
      if (ausMeta) produkte = [ausMeta];
    }
    produkte = produkte.slice(0, MAX_PRODUKTE);

    const pfad = text(r.pfad, 200);
    const titel = text(r.titel, 200);
    const typ = seitenTyp({ pfad, titel, produkte });

    const analyse = { pfad, titel, typ, produkte, inhalt: text(r.text, 1500) };
    // Auf einer Produktseite ist EIN Produkt das Thema — das hebt der Prompt hervor.
    if (typ === "produkt" && produkte.length === 1) analyse.hauptprodukt = produkte[0];
    return analyse;
  }

  // Kompakter Textblock für den System-Prompt. Bewusst hier und nicht in chat.js,
  // damit das Format an einer Stelle lebt und getestet werden kann.
  function zusammenfassung(analyse) {
    const a = analyse || {};
    const zeilen = [];
    const typName = {
      produkt: "eine Produktseite", kategorie: "eine Übersicht mehrerer Produkte",
      warenkorb: "der Warenkorb", kasse: "die Kasse (Bezahlvorgang)",
      bestaetigung: "eine Bestellbestätigung", preise: "eine Preisseite",
      kontakt: "eine Kontakt-/Hilfeseite", info: "eine Infoseite",
    }[a.typ] || "eine Seite";
    zeilen.push(`Der Besucher ist gerade auf "${a.titel || a.pfad || "?"}" (${a.pfad || "/"}). Das ist ${typName}.`);

    // Link und Bild gehören mit in den Prompt. Ohne sie erkennt der Agent zwar
    // das Produkt, kann es aber nicht als Karte zeigen — er hat schlicht keine
    // Bild-URL zum Mitgeben. Genau daran scheiterte es zuerst: das Bild wurde
    // sauber aus dem JSON-LD gelesen und dann hier weggelassen.
    for (const p of (a.produkte || [])) {
      const teile = [p.name];
      if (p.preis) teile.push(p.preis);
      if (p.verfuegbar) teile.push(p.verfuegbar);
      if (p.marke) teile.push("Marke: " + p.marke);
      let zeile = "- " + teile.join(" · ") + (p.beschreibung ? ` — ${p.beschreibung}` : "");
      if (p.url) zeile += `\n  Link: ${p.url}`;
      if (p.bild) zeile += `\n  Bild: ${p.bild}`;
      zeilen.push(zeile);
    }
    if ((a.produkte || []).some((p) => p.bild || p.url)) {
      zeilen.push("Link und Bild kannst du bei einem Produktvorschlag direkt übernehmen.");
    }
    return zeilen.join("\n");
  }

  return {
    analysiere, zusammenfassung,
    // einzeln exportiert, damit sie gezielt getestet werden koennen
    produkteAusJsonLd, produktAusMeta, seitenTyp, zuBetrag, preisText, verfuegbarkeit, ersteBildUrl,
  };
});
