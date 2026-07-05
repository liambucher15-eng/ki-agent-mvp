// Zentraler Gemini-Image-Client (Charakter-Generierung, Milestone 6).
// EINE Stelle für Modell, Endpoint, Timeout und Fehler-Mapping — wie lib/claude.js
// für Text. Kein SDK, reines fetch gegen die Generative-Language-REST-API.
//
// Zwei Fähigkeiten:
//   generiereBild({ prompt, referenzBild })  -> neues Bild (optional mit Referenz)
//   bearbeiteBild({ bild, mimeType, anweisung }) -> bestehendes Bild per Anweisung ändern
// Beide liefern { ok, status, bildBase64, mimeType, fehler }.
//
// GEMINI_API_KEY kommt aus der Umgebung (.env / Netlify-Env) — NIE ins Frontend.

const MODELL = "gemini-2.5-flash-image";
const URL_BASIS = "https://generativelanguage.googleapis.com/v1beta/models/";

function konfiguriert() {
  return !!process.env.GEMINI_API_KEY;
}

// Base64-String ("data:...;base64,XXX" oder roh) in { mimeType, daten } zerlegen.
function zerlegeBase64(bild, mimeTypeFallback) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(bild || "");
  if (m) return { mimeType: m[1], daten: m[2] };
  return { mimeType: mimeTypeFallback || "image/png", daten: bild || "" };
}

// Gemeinsamer Aufruf: Text-Teil + optionale Bild-Teile -> erstes Bild der Antwort.
async function rufeGemini(parts, timeout) {
  if (!konfiguriert()) {
    return { ok: false, status: 501, fehler: "GEMINI_API_KEY fehlt (.env / Netlify-Env)" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout || 60000);
  try {
    const res = await fetch(URL_BASIS + MODELL + ":generateContent", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const meldung =
        (data.error && data.error.message) || "Gemini-Fehler (" + res.status + ")";
      return { ok: false, status: res.status, fehler: meldung.slice(0, 300) };
    }
    // Erstes Bild aus der Antwort ziehen (parts können auch Text enthalten).
    const teile =
      (data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts) || [];
    for (const t of teile) {
      const inline = t.inlineData || t.inline_data;
      if (inline && inline.data) {
        return {
          ok: true,
          status: 200,
          bildBase64: inline.data,
          mimeType: inline.mimeType || inline.mime_type || "image/png",
        };
      }
    }
    return { ok: false, status: 502, fehler: "Gemini hat kein Bild geliefert." };
  } catch (e) {
    const fehler = e.name === "AbortError" ? "Zeitüberschreitung bei der Bild-Generierung." : e.message;
    return { ok: false, status: 504, fehler };
  } finally {
    clearTimeout(timer);
  }
}

// Neues Bild aus einem Prompt; optional mit Referenzbild (z.B. Logo/Foto der Firma).
async function generiereBild({ prompt, referenzBild, mimeType, timeout } = {}) {
  const parts = [{ text: prompt || "" }];
  if (referenzBild) {
    const { mimeType: mt, daten } = zerlegeBase64(referenzBild, mimeType);
    parts.push({ inlineData: { mimeType: mt, data: daten } });
  }
  return rufeGemini(parts, timeout);
}

// Bestehendes Bild per Textanweisung ändern (gleiche Figur, anderer Ausdruck /
// Kunden-Korrektur wie "mach die Mütze blau").
async function bearbeiteBild({ bild, mimeType, anweisung, timeout } = {}) {
  const { mimeType: mt, daten } = zerlegeBase64(bild, mimeType);
  const parts = [
    { inlineData: { mimeType: mt, data: daten } },
    { text: anweisung || "" },
  ];
  return rufeGemini(parts, timeout);
}

module.exports = { generiereBild, bearbeiteBild, konfiguriert, MODELL, zerlegeBase64 };
