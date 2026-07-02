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

// Interne Unterseiten finden — wichtige zuerst, dann auffüllen
function findeUnterseiten(html, basisUrl, max = 5) {
  const host = new URL(basisUrl).hostname;
  const wichtig = /(ueber|über|about|kontakt|contact|leistung|angebot|service|produkt|menu|speisekarte|preise|pricing|team|faq|standort|geschichte|story|werte|shop)/i;
  const alle = new Set();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], basisUrl);
      if (u.hostname !== host) continue;
      if (/\.(jpg|jpeg|png|gif|svg|webp|avif|pdf|zip|mp4|css|js|mjs|json|xml|rss|atom|txt|ico|woff2?|ttf|otf|eot)$/i.test(u.pathname)) continue;
      const sauber = (u.origin + u.pathname).replace(/\/$/, "");
      if (sauber !== basisUrl.replace(/\/$/, "")) alle.add(sauber);
    } catch {}
  }
  const liste = [...alle];
  return [...liste.filter((l) => wichtig.test(l)), ...liste.filter((l) => !wichtig.test(l))].slice(0, max);
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
    `"weiteres":"alle weiteren wichtigen Infos ausführlich: Angebote und Leistungen im Detail, Produkte, Preise, Team, Geschichte, Besonderheiten"}\n\n` +
    `WEBSEITEN-TEXT:\n${text}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000); // Background-Function: viel Luft, aber nicht endlos
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2800,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } finally { clearTimeout(t); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "API-Fehler");

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

  let hauptHtml;
  try { hauptHtml = await hole(url); }
  catch (e) { throw new Error("Webseite nicht erreichbar: " + e.message); }

  const unterseiten = findeUnterseiten(hauptHtml, url);
  const [css, ...unterResultate] = await Promise.all([
    sammleCss(hauptHtml, url),
    ...unterseiten.map((u) => hole(u).catch(() => null)),
  ]);

  const farben = ermittleFarben(hauptHtml, css);

  const texte = [htmlZuText(hauptHtml)];
  for (const html of unterResultate) if (html) texte.push(htmlZuText(html));
  const gesamtText = texte.join("\n\n").slice(0, 16000);

  if (gesamtText.length < 40) {
    throw new Error("Auf der Webseite war kaum lesbarer Text (evtl. reine Bild-/JS-Seite).");
  }

  const extrakt = await claudeExtrakt(url, gesamtText);

  const faq = Array.isArray(extrakt.faq)
    ? extrakt.faq.filter((f) => f && (f.frage || f.antwort)).slice(0, 6)
    : [];

  const wissen = [
    extrakt.angebot && ("Angebot: " + extrakt.angebot),
    extrakt.weiteres && ("Weiteres:\n" + extrakt.weiteres),
  ].filter(Boolean).join("\n\n");

  return {
    name: extrakt.name || "",
    angebot: extrakt.angebot || "",
    oeffnungszeiten: extrakt.oeffnungszeiten || "",
    adresse: extrakt.adresse || "",
    kontakt: extrakt.kontakt || "",
    faq,
    weiteres: extrakt.weiteres || "",
    wissen,
    farbe1: farben.farbe1,
    farbe2: farben.farbe2,
    gescannt: [url, ...unterseiten],
  };
}

module.exports = {
  scanneWebseite,
  // einzelne Helfer exportiert für Unit-Tests
  normalisiere, htmlZuText, findeUnterseiten, parseFarbe, istNeutral, ermittleFarben,
};
