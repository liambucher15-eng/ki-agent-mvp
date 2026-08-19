// Chroma-Key-Freistellen: die feste, in Maskottchen kaum vorkommende
// Hintergrundfarbe (siehe baueCharakterPrompt.js) wird nach der Generierung
// durch echte Transparenz ersetzt. Reines Node/zlib, keine Bibliothek.
//
// FÄLLT NIE MEHR AUS. Die Vorgängerfassung prüfte nur 4 einzelne Eckpixel und
// verlangte, dass sich alle vier exakt einig sind — und brach sonst mit einem
// Fehler ab, den charakter-background.js dann auffing und das Bild MIT
// sichtbarem Magenta-Hintergrund auslieferte. Zwei ganz gewöhnliche Fälle
// lösten das aus, keiner davon ein wirklich kaputtes Bild:
//   1. ein sanfter Verlauf/Schatten im Hintergrund — die Ecken sind alle
//      Hintergrund, nur nicht exakt gleich
//   2. die Figur reicht zufällig bis in eine der vier Ecken hinein — dann ist
//      genau dieser eine Messpunkt kein Hintergrund, obwohl der Rest sauber ist
//
// Jetzt zwei Änderungen, die beides beheben:
//   A) Die Hintergrundfarbe wird aus JEDEM Pixel am Bildrand geschätzt (Mehrheits-
//      farbe), nicht aus 4 Einzelpunkten. Eine kontaminierte Ecke geht in der
//      Menge der übrigen Randpixel unter, statt den ganzen Job zu kippen.
//   B) Freigestellt wird per Flood-Fill vom Rand aus: ein Pixel wird nur dann
//      Hintergrund, wenn er über eine Kette von Nachbarn mit jeweils kleinem
//      Farbsprung mit dem Rand verbunden ist. Das folgt einem Verlauf ganz von
//      selbst (jeder einzelne Schritt bleibt klein, auch wenn die Gesamtstrecke
//      über die alte starre Schwelle hinausgeht) UND kann nie ein Loch mitten in
//      die Figur reissen, weil Figurpixel nie über einen kleinen Sprung mit dem
//      Rand verbunden sind.
//   Findet sich trotzdem KEIN erkennbarer Hintergrund (z.B. ein wirklich buntes
//   Bild ohne einheitliche Fläche), liefert die Funktion das Bild unverändert
//   zurück — kein Fehler, kein Absturz, einfach ein Bild ohne Freistellung.

const { dekodierePng, kodierePng } = require("./pngAlpha");

const RAND = 2; // Randbreite in Pixeln, aus der die Startpunkte kommen
// Zwei Werte aus derselben Idee wie vorher (Farben gelten als "gleich" bis zu
// dieser Distanz), jetzt aber an zwei verschiedenen Stellen genutzt: als
// Schrittweite beim Fluten UND als untere Kante des weichen Randverlaufs.
const SCHRITT_SCHWELLE = 45;
const WEICHZONE = 35; // zwischen SCHRITT_SCHWELLE und SCHRITT_SCHWELLE+WEICHZONE: weicher Übergang
// Sicherheitsnetz gegen die Flut: selbst über viele kleine Schritte darf ein
// Pixel nie weiter als das von der ursprünglich geschätzten Hintergrundfarbe
// wegdriften. Verhindert, dass sich ein sehr langer, sehr sanfter Verlauf
// unbemerkt bis in eine ähnlich getönte Stelle der Figur hineinfrisst.
const SICHERHEITS_DECKE = 150;
// Der häufigste Farbton am Rand muss mindestens diesen Anteil aller Randpixel
// stellen, sonst gilt: kein einheitlicher Hintergrund erkennbar. Das ersetzt
// die alte Vier-Ecken-Prüfung — mit derselben Absicht (lieber nichts tun als
// falsch raten), aber ausgewertet über den ganzen Rand statt über 4 Punkte.
const MIN_ANTEIL = 0.25;

function distanz(r, g, b, r2, g2, b2) {
  const dr = r - r2, dg = g - g2, db = b - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Alle Pixelkoordinaten in einem RAND-breiten Ring um das ganze Bild.
function sammleRandpixel(width, height, rand) {
  const punkte = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < rand || x >= width - rand || y < rand || y >= height - rand) punkte.push(x + y * width);
    }
  }
  return punkte;
}

// Mehrheitsfarbe am Rand: Kanäle grob quantisiert (16 Stufen), häufigsten Eimer
// nehmen, daraus den echten Mittelwert der zugehörigen Pixel bilden. Ein
// einzelner kontaminierter Bereich (Figur berührt den Rand) verliert gegen die
// Mehrheit der echten Hintergrundpixel, statt den ganzen Job zu kippen.
function schaetzeHintergrundfarbe(pixel, randpixel) {
  const eimer = new Map();
  for (const idx of randpixel) {
    const i = idx * 4;
    const r = pixel[i], g = pixel[i + 1], b = pixel[i + 2];
    const schluessel = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let e = eimer.get(schluessel);
    if (!e) { e = { anzahl: 0, r: 0, g: 0, b: 0 }; eimer.set(schluessel, e); }
    e.anzahl++; e.r += r; e.g += g; e.b += b;
  }
  let bester = null;
  for (const e of eimer.values()) if (!bester || e.anzahl > bester.anzahl) bester = e;
  if (!bester || bester.anzahl / randpixel.length < MIN_ANTEIL) return null;
  return {
    r: Math.round(bester.r / bester.anzahl),
    g: Math.round(bester.g / bester.anzahl),
    b: Math.round(bester.b / bester.anzahl),
  };
}

// Flood-Fill vom Rand: startet bei jedem Randpixel nahe der geschätzten
// Hintergrundfarbe und breitet sich über Nachbarn aus, solange der Sprung zum
// jeweils VORHERIGEN Pixel klein bleibt (folgt Verläufen) UND die Gesamtdistanz
// zur geschätzten Farbe die Sicherheitsdecke nicht übersteigt (Bremse gegen
// lange Ketten kleiner Schritte). Gibt zurück, welche Pixel "Hintergrund" sind.
function flutHintergrund(pixel, width, height, randpixel, ziel) {
  const erreicht = new Uint8Array(width * height);
  const schlange = [];
  for (const idx of randpixel) {
    if (erreicht[idx]) continue;
    const i = idx * 4;
    if (distanz(pixel[i], pixel[i + 1], pixel[i + 2], ziel.r, ziel.g, ziel.b) <= SCHRITT_SCHWELLE) {
      erreicht[idx] = 1;
      schlange.push(idx);
    }
  }
  let kopf = 0;
  while (kopf < schlange.length) {
    const idx = schlange[kopf++];
    const x = idx % width, y = (idx / width) | 0;
    const i = idx * 4;
    const rc = pixel[i], gc = pixel[i + 1], bc = pixel[i + 2];
    const nachbarn = [];
    if (x > 0) nachbarn.push(idx - 1);
    if (x < width - 1) nachbarn.push(idx + 1);
    if (y > 0) nachbarn.push(idx - width);
    if (y < height - 1) nachbarn.push(idx + width);
    for (const n of nachbarn) {
      if (erreicht[n]) continue;
      const ni = n * 4;
      if (distanz(pixel[ni], pixel[ni + 1], pixel[ni + 2], rc, gc, bc) > SCHRITT_SCHWELLE) continue;
      if (distanz(pixel[ni], pixel[ni + 1], pixel[ni + 2], ziel.r, ziel.g, ziel.b) > SICHERHEITS_DECKE) continue;
      erreicht[n] = 1;
      schlange.push(n);
    }
  }
  return erreicht;
}

// Bild (Base64-PNG) -> Bild (Base64-PNG) mit echtem Alphakanal. Wirft NUR noch
// bei wirklich kaputten Bilddaten (siehe pngAlpha.js) — für "kein einheitlicher
// Hintergrund erkennbar" gibt es jetzt keinen Fehlerpfad mehr, siehe oben.
function freistellen(bildBase64) {
  const { width, height, pixel } = dekodierePng(bildBase64);
  const randpixel = sammleRandpixel(width, height, RAND);
  const ziel = schaetzeHintergrundfarbe(pixel, randpixel);
  if (!ziel) return kodierePng({ width, height, pixel }); // kein erkennbarer Hintergrund -> unverändert

  const erreicht = flutHintergrund(pixel, width, height, randpixel, ziel);
  for (let idx = 0; idx < width * height; idx++) {
    const i = idx * 4;
    if (erreicht[idx]) { pixel[i + 3] = 0; continue; }

    // Weicher Rand: liegt ein bereits freigestellter Nachbar an, sanft in
    // Richtung Figur ausblenden statt hart abzuschneiden — sonst sähe man an
    // der Kontur eine treppige Stufe statt eines glatten Übergangs.
    const x = idx % width, y = (idx / width) | 0;
    const nachbarn = [];
    if (x > 0) nachbarn.push(idx - 1);
    if (x < width - 1) nachbarn.push(idx + 1);
    if (y > 0) nachbarn.push(idx - width);
    if (y < height - 1) nachbarn.push(idx + width);
    let naeheste = Infinity;
    for (const n of nachbarn) {
      if (!erreicht[n]) continue;
      const ni = n * 4;
      const d = distanz(pixel[i], pixel[i + 1], pixel[i + 2], pixel[ni], pixel[ni + 1], pixel[ni + 2]);
      if (d < naeheste) naeheste = d;
    }
    if (naeheste === Infinity) continue; // kein freigestellter Nachbar -> eindeutig Figur, unverändert
    if (naeheste <= SCHRITT_SCHWELLE) pixel[i + 3] = 0;
    else if (naeheste >= SCHRITT_SCHWELLE + WEICHZONE) pixel[i + 3] = 255;
    else pixel[i + 3] = Math.round(((naeheste - SCHRITT_SCHWELLE) / WEICHZONE) * 255);
  }
  return kodierePng({ width, height, pixel });
}

module.exports = { freistellen };
