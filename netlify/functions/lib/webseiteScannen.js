// Kern-Logik des Webseiten-Scans (ohne HTTP-Rahmen), damit sie sowohl von der
// Background-Function als auch von Tests genutzt werden kann.
//
// WICHTIG: Läuft in der Background-Function -> KEIN 10-Sekunden-Limit. Deshalb
// hier GROSSZÜGIGE Budgets (viele Unterseiten, viel Text, langer Claude-Timeout),
// damit der Scan wirklich vollständig ist. Der API-Schlüssel bleibt auf dem Server.

function normalisiere(url) {
  url = String(url).trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

// Eine Ressource holen — SSRF-geschützt (siehe sichererFetch: nur http/https,
// keine privaten/internen IPs, Redirects werden einzeln geprüft).
const { sichererFetch } = require("./sichererFetch");
const { rufeClaude } = require("./claude");
async function hole(url, timeout = 8000) {
  const res = await sichererFetch(url, { timeout });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.text();
}

function htmlZuText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

// Seiten-Budgets (Milestone 7): mehr Seiten, mehr Text — aber pro Seite
// gedeckelt, damit EINE Riesenseite nicht das ganze Budget frisst.
const MAX_UNTERSEITEN = 11; // + Hauptseite = 12 Seiten
const MAX_TEXT_PRO_SEITE = 6000;
const MAX_TEXT_GESAMT = 48000;

const ASSET_ENDUNG = /\.(jpg|jpeg|png|gif|svg|webp|avif|pdf|zip|mp4|css|js|mjs|json|rss|atom|ico|woff2?|ttf|otf|eot)$/i;
const WICHTIG = /(ueber|über|about|kontakt|contact|leistung|angebot|service|produkt|menu|speisekarte|preise|pricing|team|faq|standort|geschichte|story|werte|shop)/i;

function sortiereWichtige(liste) {
  return [...liste.filter((l) => WICHTIG.test(l)), ...liste.filter((l) => !WICHTIG.test(l))];
}

// Interne Unterseiten aus den Links der Hauptseite — wichtige zuerst.
function findeUnterseiten(html, basisUrl, max = MAX_UNTERSEITEN) {
  const host = new URL(basisUrl).hostname;
  const alle = new Set();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], basisUrl);
      if (u.hostname !== host) continue;
      if (ASSET_ENDUNG.test(u.pathname) || /\.xml$/i.test(u.pathname) || /\.txt$/i.test(u.pathname)) continue;
      const sauber = (u.origin + u.pathname).replace(/\/$/, "");
      if (sauber !== basisUrl.replace(/\/$/, "")) alle.add(sauber);
    } catch {}
  }
  return sortiereWichtige([...alle]).slice(0, max);
}

// <loc>-Einträge aus einem Sitemap-XML ziehen (funktioniert für urlset UND sitemapindex).
function parseSitemapLocs(xml) {
  const locs = [];
  for (const m of String(xml).matchAll(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi)) locs.push(m[1]);
  return locs;
}

// Sitemap-Seiten finden: robots.txt ("Sitemap:"-Zeilen) -> sonst /sitemap.xml.
// Sitemap-INDEXE (Sitemaps, die auf weitere Sitemaps zeigen) werden eine Ebene
// tief verfolgt. Fehler sind unkritisch — dann zählen nur die Link-Funde.
async function findeSitemapSeiten(basisUrl, holeFn) {
  const holen = holeFn || ((u) => hole(u, 6000));
  const basis = new URL(basisUrl);
  let sitemapUrls = [];
  try {
    const robots = await holen(basis.origin + "/robots.txt");
    for (const m of String(robots).matchAll(/^\s*sitemap:\s*(\S+)/gim)) sitemapUrls.push(m[1]);
  } catch {}
  if (!sitemapUrls.length) sitemapUrls = [basis.origin + "/sitemap.xml"];

  const seiten = new Set();
  for (const smUrl of sitemapUrls.slice(0, 2)) {
    let xml;
    try { xml = await holen(smUrl); } catch { continue; }
    let locs = parseSitemapLocs(xml);
    // Sitemap-Index? Dann die ersten Kind-Sitemaps nachladen.
    if (/<sitemapindex/i.test(xml)) {
      const kinder = locs.slice(0, 3);
      locs = [];
      for (const kind of kinder) {
        try { locs.push(...parseSitemapLocs(await holen(kind))); } catch {}
      }
    }
    for (const loc of locs) {
      try {
        const u = new URL(loc);
        if (u.hostname !== basis.hostname) continue;
        if (ASSET_ENDUNG.test(u.pathname) || /\.xml$/i.test(u.pathname)) continue;
        seiten.add((u.origin + u.pathname).replace(/\/$/, ""));
      } catch {}
    }
    if (seiten.size) break; // erste brauchbare Sitemap reicht
  }
  seiten.delete(basisUrl.replace(/\/$/, ""));
  return sortiereWichtige([...seiten]);
}

// --- Strukturierte Daten (JSON-LD + og-Meta) ---
// Viele Firmenseiten tragen Adresse/Öffnungszeiten/Telefon maschinenlesbar in
// <script type="application/ld+json"> — präziser als jede Text-Extraktion.
function extrahiereJsonLd(html) {
  const objekte = [];
  for (const m of String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const geparst = JSON.parse(m[1].trim());
      const liste = Array.isArray(geparst) ? geparst : [geparst];
      for (const o of liste) {
        if (o && typeof o === "object") {
          objekte.push(o);
          if (Array.isArray(o["@graph"])) objekte.push(...o["@graph"].filter((g) => g && typeof g === "object"));
        }
      }
    } catch {}
  }
  return objekte;
}

function formatiereAdresse(a) {
  if (!a) return "";
  if (typeof a === "string") return a.trim();
  return [a.streetAddress, [a.postalCode, a.addressLocality].filter(Boolean).join(" "), a.addressCountry]
    .filter(Boolean).map(String).map((s) => s.trim()).filter(Boolean).join(", ");
}

function formatiereOeffnung(o) {
  if (!o) return "";
  const liste = Array.isArray(o) ? o : [o];
  const teile = [];
  for (const e of liste) {
    if (typeof e === "string") { teile.push(e); continue; }
    if (e && typeof e === "object" && e.opens && e.closes) {
      const tage = (Array.isArray(e.dayOfWeek) ? e.dayOfWeek : [e.dayOfWeek])
        .filter(Boolean)
        .map((t) => String(t).replace(/.*\//, "")) // "https://schema.org/Monday" -> "Monday"
        .join(", ");
      teile.push((tage ? tage + " " : "") + e.opens + "–" + e.closes);
    }
  }
  return teile.join("; ");
}

// Sucht in allen JSON-LD-Objekten aller Seiten nach Firma/Geschäft und sammelt
// die verlässlichen Kontakt-Fakten ein (erstes brauchbares Vorkommen gewinnt).
function strukturierteDaten(htmls) {
  const erg = { name: "", adresse: "", kontakt: "", oeffnungszeiten: "" };
  const istFirma = (t) => {
    const typen = (Array.isArray(t) ? t : [t]).filter(Boolean).map(String);
    return typen.some((x) => /Organization|Business|Store|Restaurant|Cafe|Hotel|Dentist|Physician|Attorney|Shop/i.test(x));
  };
  for (const html of htmls) {
    if (!html) continue;
    for (const o of extrahiereJsonLd(html)) {
      if (!istFirma(o["@type"])) continue;
      if (!erg.name && typeof o.name === "string") erg.name = o.name.trim();
      if (!erg.adresse) erg.adresse = formatiereAdresse(o.address);
      if (!erg.kontakt) {
        const k = [o.telephone, o.email].filter((v) => typeof v === "string" && v.trim()).join(" · ");
        if (k) erg.kontakt = k;
      }
      if (!erg.oeffnungszeiten)
        erg.oeffnungszeiten = formatiereOeffnung(o.openingHours || o.openingHoursSpecification);
    }
  }
  return erg;
}

// og:-Meta der Hauptseite (Beschreibung ist oft eine gute Angebots-Zusammenfassung).
function ogMeta(html) {
  const lies = (prop) => {
    const m = String(html).match(new RegExp('<meta[^>]*property=["\']og:' + prop + '["\'][^>]*>', "i"));
    return m ? ((m[0].match(/content=["']([^"']*)["']/i) || [])[1] || "").trim() : "";
  };
  return { titel: lies("title"), beschreibung: lies("description"), name: lies("site_name") };
}

// --- Farben ---
function normHex(h) {
  h = h.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return "#" + h;
}
function rgbZuHex(r, g, b) {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}
function parseFarbe(str) {
  if (!str) return null;
  str = String(str).trim().toLowerCase();
  let m = str.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/);
  if (m) return normHex(m[0]);
  m = str.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return rgbZuHex(+m[1], +m[2], +m[3]);
  return null;
}
function istNeutral(hex) {
  try {
    const h = normHex(hex).slice(1);
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    return sat < 0.18 || max < 30 || min > 230;
  } catch { return true; }
}
// CSS-Variablen mit "sprechenden" Namen (--primary, --brand, --accent …)
function findeCustomProps(css) {
  const treffer = [];
  for (const m of css.matchAll(/--([\w-]*(?:primary|brand|accent|main|theme|color|primario)[\w-]*)\s*:\s*([^;{}]+)[;}]/gi)) {
    const farbe = parseFarbe(m[2]);
    if (farbe && !istNeutral(farbe)) treffer.push({ name: m[1].toLowerCase(), farbe });
  }
  return treffer;
}
function ermittleFarben(html, css) {
  const alles = html + "\n" + css;

  // 1) CSS-Variablen (stärkstes Signal für Markenfarben)
  const props = findeCustomProps(css);
  const primProp = props.find((p) => /(primary|brand|main|theme|primario)/.test(p.name));
  const akzProp = props.find((p) => /accent/.test(p.name) && (!primProp || p.farbe !== primProp.farbe));

  // 2) theme-color
  const themeTag = html.match(/<meta[^>]*name=["']theme-color["'][^>]*>/i);
  const theme = themeTag ? parseFarbe((themeTag[0].match(/content=["']([^"']+)["']/i) || [])[1]) : null;

  // 3) Häufigkeit (hex + rgb) über HTML + CSS
  const z = {};
  for (const m of alles.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) { const h = normHex(m[0]); if (!istNeutral(h)) z[h] = (z[h] || 0) + 1; }
  for (const m of alles.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/g)) { const h = rgbZuHex(+m[1], +m[2], +m[3]); if (!istNeutral(h)) z[h] = (z[h] || 0) + 1; }
  const haeufig = Object.entries(z).sort((a, b) => b[1] - a[1]).map(([h]) => h);

  const farbe1 = primProp?.farbe || (theme && !istNeutral(theme) ? theme : haeufig[0]) || null;
  const farbe2 = akzProp?.farbe || haeufig.find((h) => h !== farbe1) || null;
  return { farbe1, farbe2 };
}

// CSS-Quellen sammeln: inline <style> + verlinkte Stylesheets (bis 3)
async function sammleCss(html, basisUrl) {
  let css = "";
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) css += m[1] + "\n";
  const links = [];
  for (const m of html.matchAll(/<link[^>]+>/gi)) {
    if (!/rel=["']stylesheet["']/i.test(m[0])) continue;
    const href = (m[0].match(/href=["']([^"']+)["']/i) || [])[1];
    if (href) { try { links.push(new URL(href, basisUrl).href); } catch {} }
  }
  const geholt = await Promise.allSettled(links.slice(0, 3).map((u) => hole(u, 6000)));
  for (const r of geholt) if (r.status === "fulfilled") css += r.value + "\n";
  return css.slice(0, 400000); // sehr große CSS kappen (Farb-Regex bleibt schnell)
}

async function claudeExtrakt(url, text) {
  const system =
    "Du bist ein gründlicher Analyst. Du liest den Text einer Firmen-Webseite und extrahierst ALLE " +
    "Informationen, die ein Kundenservice-Agent über die Firma wissen muss — so vollständig wie möglich. " +
    "Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown, ohne Erklärung. " +
    "Erfinde nichts — nutze nur Infos aus dem Text. Schreibe auf Deutsch.";
  const prompt =
    `Webseite: ${url}\n\n` +
    `Lies den gesamten Text und extrahiere die Infos über die Firma, GEGLIEDERT nach Kategorien. ` +
    `Sei gründlich. Wenn eine Kategorie nicht vorkommt ODER der Text keine verwertbaren Firmen-Infos ` +
    `enthält (z.B. nur technische Metadaten, Manifest-/Konfigurationsdaten oder unlesbare Zeichen), ` +
    `gib für diese Kategorie einen leeren String "" zurück. Schreib NIEMALS über den Text selbst oder ` +
    `darüber, dass/warum keine Infos extrahierbar sind — im Zweifel einfach "".\n\n` +
    `Gib genau dieses JSON zurück:\n` +
    `{"name":"Firmenname",` +
    `"angebot":"1-2 Sätze, was die Firma anbietet",` +
    `"oeffnungszeiten":"Öffnungszeiten, falls vorhanden",` +
    `"adresse":"Adresse oder Standort, falls vorhanden",` +
    `"kontakt":"Telefon und/oder E-Mail, falls vorhanden",` +
    `"faq":[{"frage":"...","antwort":"..."}] — die wichtigsten Fragen samt Antworten, die auf der Seite ` +
    `erkennbar sind (z.B. aus einem FAQ-Bereich), maximal 6 Paare. Leeres Array [], wenn keine erkennbar.,` +
    `"leistungen":["Leistung/Produkt: kurze Beschreibung", ...] — ALLE erkennbaren Leistungen/Produkte ` +
    `einzeln, je ein Eintrag mit 1 Satz Beschreibung, maximal 15. Leeres Array [], wenn keine erkennbar.,` +
    `"preise":"konkrete Preise, Preisspannen oder Tarife, falls genannt",` +
    `"team":"Personen/Team mit Rollen, falls genannt",` +
    `"besonderheiten":"was die Firma besonders macht: USPs, Auszeichnungen, Werte, Geschichte",` +
    `"weiteres":"alle weiteren wichtigen Infos ausführlich, die oben nicht abgedeckt sind"}\n\n` +
    `WEBSEITEN-TEXT:\n${text}`;

  // Bis zu 2 Versuche: ein transienter API-Aussetzer (429/500/Netz) soll den
  // ganzen Scan NICHT scheitern lassen — genau das führte sonst zu "konnte die
  // Seite nicht lesen", obwohl die Seite gut lesbar ist.
  let ok, data;
  for (let versuch = 0; versuch < 2; versuch++) {
    ({ ok, data } = await rufeClaude({
      system,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4000,
      temperature: 0.2,
      timeout: 60000, // Background-Function: viel Luft, aber nicht endlos
    }));
    if (ok) break;
    if (versuch === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!ok) throw new Error(data.error?.message || "API-Fehler");

  let txt = (data.content?.[0]?.text || "{}").replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
  if (a >= 0 && b > a) txt = txt.slice(a, b + 1);
  try { return JSON.parse(txt); } catch { return { name: "", angebot: "", weiteres: "" }; }
}

// Führt den gesamten Scan aus und gibt das fertige Ergebnis-Objekt zurück.
// Wirft bei harten Fehlern (Seite nicht erreichbar, kein Text, Claude-Fehler).
async function scanneWebseite(rohUrl) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt (.env)");
  const url = normalisiere(rohUrl);

  // Grosse Seiten (z.B. Wix ~1 MB) brauchen länger — grosszügiges Timeout und ein
  // zweiter Versuch, damit ein einmaliger Netz-/Timeout-Aussetzer den Scan nicht kippt.
  let hauptHtml;
  try { hauptHtml = await hole(url, 15000); }
  catch (e1) {
    try { hauptHtml = await hole(url, 15000); }
    catch (e2) { throw new Error("Webseite nicht erreichbar: " + e2.message); }
  }

  // Unterseiten aus ZWEI Quellen: Links der Hauptseite + Sitemap (findet auch
  // Seiten, die nicht im Menü verlinkt sind). Wichtige zuerst, dann auffüllen.
  const ausLinks = findeUnterseiten(hauptHtml, url, MAX_UNTERSEITEN);
  const ausSitemap = await findeSitemapSeiten(url).catch(() => []);
  const unterseiten = sortiereWichtige([...new Set([...ausLinks, ...ausSitemap])]).slice(0, MAX_UNTERSEITEN);

  const [css, ...unterResultate] = await Promise.all([
    sammleCss(hauptHtml, url),
    ...unterseiten.map((u) => hole(u).catch(() => null)),
  ]);

  const farben = ermittleFarben(hauptHtml, css);

  // Strukturierte Daten (JSON-LD) aus allen Seiten — präziser als Text-Extraktion.
  const strukturiert = strukturierteDaten([hauptHtml, ...unterResultate]);
  const og = ogMeta(hauptHtml);

  const texte = [htmlZuText(hauptHtml).slice(0, MAX_TEXT_PRO_SEITE)];
  if (og.beschreibung) texte[0] = "Seitenbeschreibung: " + og.beschreibung + "\n" + texte[0];
  for (const html of unterResultate) if (html) texte.push(htmlZuText(html).slice(0, MAX_TEXT_PRO_SEITE));
  const gesamtText = texte.join("\n\n").slice(0, MAX_TEXT_GESAMT);

  if (gesamtText.length < 40) {
    throw new Error("Auf der Webseite war kaum lesbarer Text (evtl. reine Bild-/JS-Seite).");
  }
  // Wenig Text trotz erreichbarer Seite = vermutlich JS-gerenderte Inhalte.
  // Kein Abbruch, aber eine ehrliche Diagnose für den Qualitätsbericht.
  const hinweis = gesamtText.length < 600
    ? "Die Seite liefert nur wenig lesbaren Text (vermutlich per JavaScript aufgebaut). Bitte ergänze die Infos unten von Hand oder lade ein Dokument hoch."
    : "";

  const extrakt = await claudeExtrakt(url, gesamtText);

  // Claudes JSON typsicher machen: nur erwartete Felder, jeweils als String/Array.
  // Schützt davor, dass unerwartete Strukturen (z.B. ein Objekt statt Text) in die
  // Firmen-Daten und damit in den System-Prompt gelangen.
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const faq = (Array.isArray(extrakt.faq) ? extrakt.faq : [])
    .map((f) => ({ frage: str(f && f.frage), antwort: str(f && f.antwort) }))
    .filter((f) => f.frage || f.antwort)
    .slice(0, 6);
  const leistungen = (Array.isArray(extrakt.leistungen) ? extrakt.leistungen : [])
    .map((l) => (typeof l === "string" ? l.trim()
      : l && typeof l === "object" ? [l.titel, l.beschreibung].filter(Boolean).map(String).join(": ") : ""))
    .filter(Boolean)
    .slice(0, 15);

  // Strukturierte Daten (JSON-LD) gewinnen gegen die LLM-Extraktion — sie sind
  // von der Firma selbst maschinenlesbar hinterlegt.
  const name = strukturiert.name || str(extrakt.name) || og.name;
  const angebot = str(extrakt.angebot) || og.beschreibung;
  const oeffnungszeiten = strukturiert.oeffnungszeiten || str(extrakt.oeffnungszeiten);
  const adresse = strukturiert.adresse || str(extrakt.adresse);
  const kontakt = strukturiert.kontakt || str(extrakt.kontakt);
  const preise = str(extrakt.preise);
  const team = str(extrakt.team);
  const besonderheiten = str(extrakt.besonderheiten);
  const weiteres = str(extrakt.weiteres);

  const wissen = [
    angebot && ("Angebot: " + angebot),
    leistungen.length && ("Leistungen:\n- " + leistungen.join("\n- ")),
    preise && ("Preise: " + preise),
    team && ("Team: " + team),
    besonderheiten && ("Besonderheiten: " + besonderheiten),
    weiteres && ("Weiteres:\n" + weiteres),
  ].filter(Boolean).join("\n\n");

  return {
    name, angebot, oeffnungszeiten, adresse, kontakt, faq,
    leistungen, preise, team, besonderheiten, weiteres, wissen, hinweis,
    farbe1: farben.farbe1,
    farbe2: farben.farbe2,
    gescannt: [url, ...unterseiten],
  };
}

module.exports = {
  scanneWebseite,
  // einzelne Helfer exportiert für Unit-Tests
  normalisiere, htmlZuText, findeUnterseiten, parseFarbe, istNeutral, ermittleFarben,
  parseSitemapLocs, findeSitemapSeiten, extrahiereJsonLd, strukturierteDaten, ogMeta,
};
