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
// Eingeschlossene Hintergrundflaechen: das Loch im O, der Zwischenraum
// zwischen zwei Klaviertasten, die beiden Bauche einer 8.
//
// Solche Flaechen sind vom Bildrand aus NICHT erreichbar, die Flut kommt dort
// also nie an — sie blieben als farbiger Fleck mitten in der Figur stehen.
// Deshalb zusaetzlich ein direkter Farbvergleich, unabhaengig von der Lage.
//
// Die Schwelle ist BEWUSST enger als SCHRITT_SCHWELLE: Ein Pixel mitten in der
// Figur wird nur dann zum Loch erklaert, wenn es der Hintergrundfarbe sehr nahe
// kommt. Dass die Figur selbst kein Magenta enthaelt, verlangt der Prompt
// ausdruecklich (baueCharakterPrompt.js) — trotzdem soll hier niemand ein
// Loch in eine Figur reissen, die zufaellig einen roetlichen Ton hat.
const LOCH_SCHWELLE = 38;

// ----------------------------------------------------------------------
// RUECKFALL FUER WEICHE BILDER (3D-Renders)
//
// Das Fluten oben braucht eine harte Kante als Barriere. Genau die liefert die
// Stilvorgabe in baueCharakterPrompt.js ("flacher Cartoon-Stil, klare
// Konturen") — sie ist keine Geschmacksfrage, sondern Voraussetzung.
//
// Ein 3D-Render hat weiche Uebergaenge und keine solche Barriere: Die Flut
// wandert Schritt fuer Schritt in die Figur hinein. Gemessen an einer
// Brotfigur im Claymorphism-Stil blieben 0,1 bis 1,2 Prozent deckende Flaeche
// uebrig (nur Augen, Mund, Gliedmassen) statt der rund 22 Prozent, die ein
// flaches Bild erreicht.
//
// Deshalb: Sieht das Ergebnis der Flut unplausibel aus, wird ein zweites
// Verfahren versucht — Abstand in der CHROMINANZ statt in RGB. Dazu wird
// jede Farbe auf ihre eigene Summe normiert. Ein Lichtverlauf aendert die
// Helligkeit, nicht den Farbton; nach der Normierung ist er also weg. Genau
// daran scheitert das Fluten, und genau das ueberspringt dieser Weg.
//
// Der flache Fall bleibt unberuehrt: Liefert die Flut ein plausibles Ergebnis,
// wird hier gar nichts gerechnet.
const PLAUSIBEL_MIN = 0.04;   // unter 4 % deckend: die Figur wurde weggefressen
const PLAUSIBEL_MAX = 0.75;   // ueber 75 % deckend: es wurde kaum etwas entfernt
const CHROMA_SCHWELLE = 0.085; // an Magenta UND Gruen gemessen
// Unter dieser Gesamthelligkeit (r+g+b) ist der Farbton nicht mehr aussagekraeftig:
// Bei sehr dunklen Pixeln steht in der Normierung eine kleine Zahl im Nenner, und
// schon ein Rauschwert kippt das Ergebnis. Ein Chroma-Key ist dagegen IMMER
// kraeftig (gemessen: Summe 300 bis 450). Dunkle Pixel gehoeren also zur Figur.
//
// Ohne diese Regel zerfrass das Verfahren genau die duennen schwarzen Arme und
// Beine, die diesen Maskottchen-Stil ausmachen.
const DUNKEL_GRENZE = 190;
// ----------------------------------------------------------------------

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

  // Gegenprobe ueber die SAETTIGUNG.
  //
  // Die Mehrheit am Rand kann kippen: Laeuft die Figur unten aus dem Bild, ist
  // sie am Rand haeufiger als der Hintergrund — und wird prompt fuer ihn
  // gehalten. Das Ergebnis waere exakt vertauscht: Figur weg, Hintergrund
  // stehen geblieben. Kein Teilfehler, sondern ein unbrauchbares Bild.
  //
  // Ein Chroma-Key ist per Konstruktion KRAEFTIG (der Prompt verlangt
  // "kraeftiges Magenta"), eine Maskottchen-Farbe selten. Gibt es am Rand einen
  // zweiten haeufigen Ton, der deutlich gesaettigter ist, gewinnt der.
  //
  // Bewusst eng gefasst: Der andere Kandidat muss mindestens ein Fuenftel des
  // Randes stellen UND anderthalbmal so gesaettigt sein. Bei einem gewoehnlichen
  // Bild gibt es nur einen Kandidaten, dann passiert hier gar nichts.
  const saettigung = (e) => {
    const r = e.r / e.anzahl, g = e.g / e.anzahl, b2 = e.b / e.anzahl;
    return Math.max(r, g, b2) - Math.min(r, g, b2);
  };
  for (const e of eimer.values()) {
    if (e === bester) continue;
    if (e.anzahl / randpixel.length < 0.20) continue;
    if (saettigung(e) > saettigung(bester) * 1.5) bester = e;
  }
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

// Farbe auf ihre eigene Summe normieren: uebrig bleibt der Farbton ohne
// Helligkeit. Zwei Pixel derselben Wandfarbe, einer im Licht und einer im
// Schatten, liefern hier fast denselben Wert.
function chrominanz(r, g, b) {
  const s = r + g + b || 1;
  return [r / s, g / s, b / s];
}

// Zweites Verfahren, siehe Erklaerung bei den Konstanten oben. Setzt Alpha
// direkt anhand des Farbtons, ohne zu fluten — deshalb braucht es keine
// Kante und stoert sich nicht an einem Lichtverlauf.
//
// Ausserdem wird der Farbstich entfernt, den der Hintergrund auf die Figur
// wirft ("Color Spill"): Steht die Figur vor Gruen, faerbt das reflektierte
// Licht sie gruenlich. Der im Hintergrund staerkste Kanal wird deshalb auf
// das Mittel der beiden anderen begrenzt — aber nur dort, wo er wirklich
// heraussticht, damit eine absichtlich gruene Figur gruen bleibt.
function freistellenNachFarbton(width, height, pixel, ziel) {
  const zielChroma = chrominanz(ziel.r, ziel.g, ziel.b);
  // Welcher Kanal traegt den Hintergrund? Nur der verursacht Spill.
  const kanal = zielChroma.indexOf(Math.max(...zielChroma));
  let deckend = 0;

  // Abstand je Pixel einmal ausrechnen.
  const abstand = new Float32Array(width * height);
  for (let idx = 0; idx < width * height; idx++) {
    const i = idx * 4;
    const c = chrominanz(pixel[i], pixel[i + 1], pixel[i + 2]);
    abstand[idx] = Math.sqrt(
      (c[0] - zielChroma[0]) ** 2 + (c[1] - zielChroma[1]) ** 2 + (c[2] - zielChroma[2]) ** 2);
  }

  // Vom Rand her ausbreiten statt jedes Pixel einzeln zu beurteilen.
  //
  // Ohne diesen Schritt blieb unten ein rosa Schleier stehen: Dort ist der
  // Hintergrund am hellsten und sein Farbton am unsichersten, also lag er
  // knapp ueber der Schwelle. Umgekehrt koennte eine hintergrundaehnliche
  // Stelle MITTEN in der Figur sonst ein Loch bekommen.
  //
  // Der Unterschied zum Fluten oben: Dort entscheidet der Sprung zum Nachbarn
  // (braucht eine harte Kante), hier der Farbton zum Hintergrund (braucht
  // keine). Deshalb kommt dieses Verfahren mit weichen 3D-Uebergaengen zurecht.
  const hintergrund = new Uint8Array(width * height);
  const stapel = [];
  const grosszuegig = CHROMA_SCHWELLE * 1.8;
  for (let x = 0; x < width; x++) { stapel.push(x, (height - 1) * width + x); }
  for (let y = 0; y < height; y++) { stapel.push(y * width, y * width + width - 1); }
  while (stapel.length) {
    const idx = stapel.pop();
    if (hintergrund[idx] || abstand[idx] >= grosszuegig) continue;
    const hi = idx * 4;
    if (pixel[hi] + pixel[hi + 1] + pixel[hi + 2] < DUNKEL_GRENZE) continue; // zu dunkel fuer Hintergrund
    hintergrund[idx] = 1;
    const x = idx % width, y = (idx / width) | 0;
    if (x > 0) stapel.push(idx - 1);
    if (x < width - 1) stapel.push(idx + 1);
    if (y > 0) stapel.push(idx - width);
    if (y < height - 1) stapel.push(idx + width);
  }

  for (let idx = 0; idx < width * height; idx++) {
    const i = idx * 4;
    const d = abstand[idx];

    // Dunkles gehoert zur Figur, egal was der Farbton sagt.
    if (pixel[i] + pixel[i + 1] + pixel[i + 2] < DUNKEL_GRENZE) { pixel[i + 3] = 255; deckend++; continue; }
    if (hintergrund[idx]) { pixel[i + 3] = 0; continue; }
    if (d < CHROMA_SCHWELLE) { pixel[i + 3] = 0; continue; }

    // Weicher Rand wie beim Fluten: knapp ausserhalb der Schwelle sanft
    // ausblenden, sonst saehe die Kontur treppig aus.
    const weich = CHROMA_SCHWELLE * 1.6;
    pixel[i + 3] = d >= weich ? 255 : Math.round(((d - CHROMA_SCHWELLE) / (weich - CHROMA_SCHWELLE)) * 255);

    // Spill: den Hintergrundkanal auf das Mittel der anderen beiden kappen.
    const andere = [0, 1, 2].filter((k) => k !== kanal);
    const mittel = (pixel[i + andere[0]] + pixel[i + andere[1]]) / 2;
    if (pixel[i + kanal] > mittel) pixel[i + kanal] = Math.round(mittel + (pixel[i + kanal] - mittel) * 0.35);

    if (pixel[i + 3] > 215) deckend++;
  }
  return deckend / (width * height);
}

// Bild (Base64-PNG) -> Bild (Base64-PNG) mit echtem Alphakanal. Wirft NUR noch
// bei wirklich kaputten Bilddaten (siehe pngAlpha.js) — für "kein einheitlicher
// Hintergrund erkennbar" gibt es jetzt keinen Fehlerpfad mehr, siehe oben.
function freistellen(bildBase64) {
  const { width, height, pixel } = dekodierePng(bildBase64);
  const randpixel = sammleRandpixel(width, height, RAND);
  const ziel = schaetzeHintergrundfarbe(pixel, randpixel);
  if (!ziel) return kodierePng({ width, height, pixel }); // kein erkennbarer Hintergrund -> unverändert

  // Der Originalzustand wird gebraucht, falls das Fluten daneben liegt und das
  // zweite Verfahren auf unveraenderten Farben rechnen muss.
  const unberuehrt = Buffer.from(pixel);

  const erreicht = flutHintergrund(pixel, width, height, randpixel, ziel);

  // Loecher nachtragen, BEVOR die weichen Kanten gerechnet werden — so bekommen
  // sie denselben sauberen Uebergang wie die Aussenkante.
  for (let idx = 0; idx < width * height; idx++) {
    if (erreicht[idx]) continue;
    const i = idx * 4;
    if (distanz(pixel[i], pixel[i + 1], pixel[i + 2], ziel.r, ziel.g, ziel.b) <= LOCH_SCHWELLE) {
      erreicht[idx] = 1;
    }
  }

  let deckend = 0;
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
    if (naeheste === Infinity) { deckend++; continue; } // kein freigestellter Nachbar -> eindeutig Figur
    if (naeheste <= SCHRITT_SCHWELLE) pixel[i + 3] = 0;
    else if (naeheste >= SCHRITT_SCHWELLE + WEICHZONE) { pixel[i + 3] = 255; deckend++; }
    else {
      pixel[i + 3] = Math.round(((naeheste - SCHRITT_SCHWELLE) / WEICHZONE) * 255);
      if (pixel[i + 3] > 215) deckend++;
    }
  }

  // Plausibel? Dann ist alles gut und wir sind fertig — der flache Fall
  // laeuft hier durch, ohne dass unten irgendetwas gerechnet wird.
  const anteil = deckend / (width * height);
  if (anteil >= PLAUSIBEL_MIN && anteil <= PLAUSIBEL_MAX) {
    return kodierePng({ width, height, pixel });
  }

  // Sonst: zweites Verfahren auf den unberuehrten Farben. Nur uebernehmen, wenn
  // es tatsaechlich besser ist — sonst bliebe ein schlechtes Ergebnis gegen
  // ein noch schlechteres getauscht.
  const zweit = Buffer.from(unberuehrt);
  const zweitAnteil = freistellenNachFarbton(width, height, zweit, ziel);
  if (zweitAnteil >= PLAUSIBEL_MIN && zweitAnteil <= PLAUSIBEL_MAX) {
    return kodierePng({ width, height, pixel: zweit });
  }
  return kodierePng({ width, height, pixel });
}

module.exports = { freistellen };
