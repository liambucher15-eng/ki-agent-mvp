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
    const einzeln = offers.price != null ? offers.price : offers.lowPrice;
    const betrag = zuBetrag(einzeln);
    const hoch = zuBetrag(offers.highPrice);
    return {
      betrag,
      waehrung,
      preis: preisText(betrag, waehrung) + (hoch != null && hoch !== betrag ? `–${preisText(hoch, waehrung)}` : ""),
      verfuegbar: verfuegbarkeit(offers.availability),
    };
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
  function produkteAusJsonLd(objekte) {
    const gefunden = [];
    const gesehen = new Set();

    function gehe(knoten, tiefe) {
      if (!knoten || tiefe > MAX_TIEFE || gefunden.length >= MAX_PRODUKTE) return;
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
    const istProdukt = /product/i.test(String(meta["og:type"] || "")) ||
      meta["product:price:amount"] != null;
    if (!istProdukt) return null;
    const waehrung = text(meta["product:price:currency"], 8).toUpperCase();
    const betrag = zuBetrag(meta["product:price:amount"]);
    const produkt = { name };
    const beschreibung = text(meta["og:description"] || meta["twitter:description"], MAX_BESCHREIBUNG);
    if (beschreibung) produkt.beschreibung = beschreibung;
    const url = text(meta["og:url"], 300);
    if (url) produkt.url = url;
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

    if (/(^|\/)(kasse|checkout|zahlung|payment|bestellabschluss|order)(\/|$|\?)/.test(pfad) ||
        /checkout|zur kasse|zahlung/.test(titel)) return "kasse";
    if (/(^|\/)(warenkorb|cart|basket|korb)(\/|$|\?)/.test(pfad) ||
        /warenkorb|einkaufswagen/.test(titel)) return "warenkorb";
    if (/danke|bestellbest|order-confirm|thank-you|thankyou/.test(beides)) return "bestaetigung";

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

    for (const p of (a.produkte || [])) {
      const teile = [p.name];
      if (p.preis) teile.push(p.preis);
      if (p.verfuegbar) teile.push(p.verfuegbar);
      if (p.marke) teile.push("Marke: " + p.marke);
      zeilen.push("- " + teile.join(" · ") + (p.beschreibung ? ` — ${p.beschreibung}` : ""));
    }
    return zeilen.join("\n");
  }

  return {
    analysiere, zusammenfassung,
    // einzeln exportiert, damit sie gezielt getestet werden koennen
    produkteAusJsonLd, produktAusMeta, seitenTyp, zuBetrag, preisText, verfuegbarkeit,
  };
});
