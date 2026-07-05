// Serverseitiger Bild-Upload in den Supabase-Storage-Bucket "charaktere".
// Der Browser lädt eigene Uploads selbst hoch (store.js, Pfad = Nutzer-ID wegen
// Storage-Policy); GENERIERTE Bilder lädt der Server hier mit dem Service-Key
// hoch — unter "generiert/…", wo kein Kunde schreiben kann (Policy erlaubt
// Kunden nur den eigenen UID-Ordner).

const URL_BASIS = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET = "charaktere";

function konfiguriert() {
  return !!URL_BASIS && !!KEY;
}

// Lädt ein Bild (Base64 ohne data:-Präfix) hoch und gibt die öffentliche URL zurück.
async function speichereBild(pfad, bildBase64, mimeType) {
  if (!konfiguriert()) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_KEY fehlen (.env)");
  const res = await fetch(URL_BASIS + "/storage/v1/object/" + BUCKET + "/" + pfad, {
    method: "POST",
    headers: {
      authorization: "Bearer " + KEY,
      apikey: KEY,
      "content-type": mimeType || "image/png",
      "x-upsert": "true",
    },
    body: Buffer.from(bildBase64, "base64"),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Bild-Upload fehlgeschlagen (" + res.status + "): " + t.slice(0, 200));
  }
  return oeffentlicheUrl(pfad);
}

function oeffentlicheUrl(pfad) {
  return URL_BASIS + "/storage/v1/object/public/" + BUCKET + "/" + pfad;
}

// Prüft, ob eine URL auf UNSEREN öffentlichen Bucket zeigt (gegen SSRF: der
// Edit-Endpunkt lädt nur Bilder herunter, die wir selbst hochgeladen haben).
function istEigeneBildUrl(url) {
  return (
    !!URL_BASIS &&
    typeof url === "string" &&
    url.startsWith(URL_BASIS + "/storage/v1/object/public/" + BUCKET + "/")
  );
}

module.exports = { speichereBild, oeffentlicheUrl, istEigeneBildUrl, konfiguriert, BUCKET };
