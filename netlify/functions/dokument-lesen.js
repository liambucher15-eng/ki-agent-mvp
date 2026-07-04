// Liest ein hochgeladenes Dokument (Bild oder PDF) mit Claude aus.
// Beispiel: ein Foto/PDF einer Menükarte -> strukturierter Text (Gerichte + Preise),
// der ins Wissen des Agenten übernommen wird.
// Text-Dateien (.txt/.md) werden NICHT hier verarbeitet — die liest das Frontend direkt.
// Der API-Schlüssel bleibt hier auf dem Server.

const { json, holeIp, originErlaubt, rateOk } = require("./lib/schutz");
const { rufeClaude } = require("./lib/claude");

// ~6,7 Mio. Base64-Zeichen ≈ 5 MB Rohdaten -> Obergrenze fürs Hochladen.
const MAX_BASE64 = 6_700_000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Nur POST erlaubt" });
  if (!originErlaubt(event)) return json(403, { error: "Origin nicht erlaubt" });
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "ANTHROPIC_API_KEY fehlt (.env)" });

  // Rate-Limit: 10 Dokumente pro Minute und IP
  if (!(await rateOk("dok:" + holeIp(event), 10, 60))) {
    return json(429, { error: "Zu viele Uploads. Bitte einen Moment warten." });
  }

  let dateiname, mediaType, daten;
  try { ({ dateiname, mediaType, daten } = JSON.parse(event.body || "{}")); }
  catch { return json(400, { error: "Ungültiges JSON" }); }
  if (!mediaType || !daten) return json(400, { error: "mediaType oder daten fehlt" });
  if (typeof daten !== "string" || daten.length > MAX_BASE64) {
    return json(413, { error: "Datei zu groß (max. ca. 5 MB)." });
  }

  // Content-Block je nach Dateityp bauen
  let block;
  if (mediaType.startsWith("image/")) {
    block = { type: "image", source: { type: "base64", media_type: mediaType, data: daten } };
  } else if (mediaType === "application/pdf") {
    block = { type: "document", source: { type: "base64", media_type: "application/pdf", data: daten } };
  } else {
    return json(415, { error: "Nur Bilder oder PDF werden hier verarbeitet." });
  }

  const anweisung =
    `Das ist ein Dokument der Firma (z.B. Menükarte, Preisliste, Broschüre) — Dateiname: ${dateiname || "unbekannt"}. ` +
    `Lies den GESAMTEN Inhalt vollständig aus und gib ihn als klar strukturierten, gut lesbaren Text zurück ` +
    `(z.B. alle Gerichte/Produkte mit Preisen, nach Kategorien geordnet). ` +
    `Gib NUR den Inhalt aus — keine Einleitung, kein Kommentar. Schreibe auf Deutsch.`;

  try {
    // Haiku kann Bilder UND PDF lesen
    const { ok, data } = await rufeClaude({
      messages: [{ role: "user", content: [block, { type: "text", text: anweisung }] }],
      maxTokens: 2500,
      temperature: 0.1,
      timeout: 22000,
    });
    if (!ok) return json(502, { error: data.error?.message || "API-Fehler" });
    const text = data.content?.[0]?.text?.trim() || "";
    return json(200, { text });
  } catch (e) {
    return json(502, { error: e.name === "AbortError" ? "Zeitüberschreitung beim Lesen" : e.message });
  }
};
