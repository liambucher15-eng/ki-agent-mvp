// Chroma-Key-Freistellen: die feste, in Maskottchen kaum vorkommende
// Hintergrundfarbe (siehe baueCharakterPrompt.js) wird nach der Generierung
// durch echte Transparenz ersetzt. Reines Node/zlib, keine Bibliothek.

const { dekodierePng, kodierePng } = require("./pngAlpha");

// Der Prompt verlangt Magenta, aber Bildmodelle nehmen Farbnamen nie exakt beim
// Hex-Wert — gemessen kam z.B. (219,41,133) statt (255,0,255) heraus. Darum wird
// die tatsächliche Hintergrundfarbe aus den vier Bildecken abgelesen, statt eine
// feste Zielfarbe anzunehmen. Die Ecken müssen sich in einer zentrierten
// Komposition einig sein — sonst ist vermutlich keine flache Fläche da, und wir
// brechen lieber ab, statt die Figur selbst kaputt freizustellen.
const SCHWELLE = 45;
// Zwischen SCHWELLE und SCHWELLE+WEICHZONE weich ausblenden, sonst sieht man
// am Rand der Figur einen harten, treppigen Übergang statt einer glatten Kante.
const WEICHZONE = 35;
const ECKEN_EINIGKEIT = 30; // max. erlaubte Distanz der vier Eckfarben zueinander

function distanz(r, g, b, r2, g2, b2) {
  const dr = r - r2, dg = g - g2, db = b - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function leseEckfarbe(pixel, width, height, x, y) {
  const i = (y * width + x) * 4;
  return { r: pixel[i], g: pixel[i + 1], b: pixel[i + 2] };
}

// Bild (Base64-PNG) -> Bild (Base64-PNG) mit echtem Alphakanal. Wirft, wenn die
// vier Ecken keine einheitliche Fläche zeigen (dann lieber unverändert lassen,
// als etwas Falsches wegzuschneiden — der Aufrufer fängt das ab).
function freistellen(bildBase64) {
  const { width, height, pixel } = dekodierePng(bildBase64);
  const rand = 2; // ganz am Rand, nicht mitten in einer Rundung der Figur
  const ecken = [
    leseEckfarbe(pixel, width, height, rand, rand),
    leseEckfarbe(pixel, width, height, width - 1 - rand, rand),
    leseEckfarbe(pixel, width, height, rand, height - 1 - rand),
    leseEckfarbe(pixel, width, height, width - 1 - rand, height - 1 - rand),
  ];
  for (let i = 1; i < ecken.length; i++) {
    if (distanz(ecken[0].r, ecken[0].g, ecken[0].b, ecken[i].r, ecken[i].g, ecken[i].b) > ECKEN_EINIGKEIT) {
      throw new Error("Kein einheitlicher Hintergrund erkennbar, Freistellen übersprungen.");
    }
  }
  const ziel = {
    r: Math.round(ecken.reduce((s, e) => s + e.r, 0) / 4),
    g: Math.round(ecken.reduce((s, e) => s + e.g, 0) / 4),
    b: Math.round(ecken.reduce((s, e) => s + e.b, 0) / 4),
  };

  for (let i = 0; i < pixel.length; i += 4) {
    const d = distanz(pixel[i], pixel[i + 1], pixel[i + 2], ziel.r, ziel.g, ziel.b);
    let alpha;
    if (d <= SCHWELLE) alpha = 0;
    else if (d >= SCHWELLE + WEICHZONE) alpha = 255;
    else alpha = Math.round(((d - SCHWELLE) / WEICHZONE) * 255);
    pixel[i + 3] = alpha;
  }
  return kodierePng({ width, height, pixel });
}

module.exports = { freistellen };
