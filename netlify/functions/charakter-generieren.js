// Charakter-Generierung — STUB.
// Nimmt Text-Beschreibung ODER ein hochgeladenes Bild und liefert 4 Ausdruck-Bilder
// (idle / denken / sprechen / verlegen).
//
// JETZT: Platzhalter — bei Text 4 generierte SVGs, bei Upload das hochgeladene Bild.
// SPÄTER: Hier wird die echte Bild-API (Higgsfield) angeschlossen. Die Schnittstelle
// (Eingabe + Rückgabe { bilder }) bleibt dann GLEICH — nur die Erzeugung wird ersetzt.

const { ladeFirma } = require("./lib/firmen");
const { baueCharakterPrompt } = require("./lib/baueCharakterPrompt");
const { holeIp, originErlaubt, rateOk } = require("./lib/schutz");

const ZUSTAENDE = ["idle", "denken", "sprechen", "verlegen"];

// Input-Limits. WICHTIG: Sobald hier die echte Bild-API (Higgsfield) angeschlossen
// wird, ist das ein KOSTEN-Endpunkt — die Schutzschicht muss vorher schon stehen.
const MAX_BESCHREIBUNG = 500;
const MAX_BASE64 = 6_700_000; // ~5 MB Rohdaten (wie dokument-lesen.js)

function escapeXml(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// Ein einfacher Platzhalter pro Zustand (damit man die 4 Bilder sieht und das
// Zustands-System testen kann). Wird durch echte Generierung ersetzt.
function platzhalterSvg(farbe, akzent, zustand, beschreibung) {
  const f = farbe || "#3f7d5a";
  const a = akzent || "#a8d5b9";
  const augenCy = zustand === "denken" ? 70 : 78;        // denken: Blick nach oben
  const augenDx = zustand === "verlegen" ? 6 : 0;        // verlegen: Blick zur Seite
  const mund =
    zustand === "sprechen"
      ? '<ellipse cx="80" cy="100" rx="12" ry="10" fill="#1b2a22"/>'
      : '<ellipse cx="80" cy="100" rx="11" ry="5" fill="#1b2a22"/>';
  const wangen =
    zustand === "verlegen"
      ? '<circle cx="52" cy="92" r="9" fill="#ff8a8a" opacity="0.8"/><circle cx="108" cy="92" r="9" fill="#ff8a8a" opacity="0.8"/>'
      : "";
  const label = escapeXml((beschreibung || "Maskottchen").slice(0, 22));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">` +
    `<rect width="160" height="160" fill="#ffffff"/>` +
    `<ellipse cx="80" cy="88" rx="58" ry="55" fill="${f}"/>` +
    `<ellipse cx="80" cy="104" rx="34" ry="28" fill="${a}" opacity="0.5"/>` +
    wangen +
    `<circle cx="${62 + augenDx}" cy="${augenCy}" r="8" fill="#1b2a22"/>` +
    `<circle cx="${98 + augenDx}" cy="${augenCy}" r="8" fill="#1b2a22"/>` +
    mund +
    `<text x="80" y="150" font-family="sans-serif" font-size="11" fill="#888" text-anchor="middle">${zustand} · ${label}</text>` +
    `</svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

exports.handler = async (event) => {
  const json = (statusCode, obj) => ({
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  });

  if (event.httpMethod !== "POST") return json(405, { error: "Nur POST erlaubt" });
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });

  // Rate-Limit: 10 Generierungen pro Minute und IP
  if (!(await rateOk("char:" + holeIp(event), 10, 60))) {
    return json(429, { error: "Zu viele Anfragen. Bitte einen Moment warten." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Ungültiges JSON" });
  }
  const { firmaId, modus, beschreibung, bild, farbe: farbeIn, akzent: akzentIn } = body;

  // Input-Limits prüfen (Beschreibung + Bild-Größe)
  if (beschreibung != null && (typeof beschreibung !== "string" || beschreibung.length > MAX_BESCHREIBUNG)) {
    return json(413, { error: "Beschreibung zu lang (max. " + MAX_BESCHREIBUNG + " Zeichen)." });
  }
  if (bild != null && (typeof bild !== "string" || bild.length > MAX_BASE64)) {
    return json(413, { error: "Bild zu groß (max. ca. 5 MB)." });
  }

  // Farben direkt nehmen (Onboarding/Entwurf) ODER aus einer bekannten Firma holen (Seed).
  let farbe = farbeIn;
  let akzent = akzentIn;
  if ((!farbe || !akzent) && firmaId) {
    const firma = ladeFirma(firmaId);
    if (firma && firma.charakter) {
      farbe = farbe || firma.charakter.farbe;
      akzent = akzent || firma.charakter.akzent;
    }
  }
  farbe = farbe || "#3f7d5a";
  akzent = akzent || "#a8d5b9";

  // Prompts schon jetzt bauen — die echte Bild-API nutzt sie später unverändert.
  const { stil, prompts } = baueCharakterPrompt({ beschreibung, farbe });

  const bilder = {};
  if (modus === "upload" && bild) {
    // STUB: hochgeladenes Bild für alle Zustände (echte Ausdruck-Varianten kommen mit der Bild-API).
    for (const z of ZUSTAENDE) bilder[z] = bild;
  } else {
    // STUB: 4 Platzhalter-SVGs, pro Zustand leicht anders.
    for (const z of ZUSTAENDE) bilder[z] = platzhalterSvg(farbe, akzent, z, beschreibung);
  }

  // stub:true sagt dem Frontend, dass das noch Platzhalter sind.
  return json(200, { bilder, prompts, stil, stub: true });
};
