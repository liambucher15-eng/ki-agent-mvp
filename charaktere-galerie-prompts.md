# Bild-Prompts — Charakter-Galerie (start.html #charaktere)

> Für Bild-Generatoren (Higgsfield / Nano Banana Pro, Midjourney, Freepik AI, …).
> Englisch = beste Ergebnisse (siehe auch `onboarding-bild-prompts.md`).
>
> **Zweite Fassung.** Die erste nutzte 20 verschiedene Kunsthandwerks-Materialien
> (Ton, Marmor, Karton, Buntglas …) — zu unruhig für eine Galerie, die als EINE
> Firma wirken soll. Diese Fassung hält eine feste Formel durch und variiert nur
> Finish, Farbe und Haltung. Ausserdem: Diese Prompts sind unabhängig von der
> Live-Generierung im Onboarding (`netlify/functions/lib/baueCharakterPrompt.js`,
> die für den Chat einen einheitlichen Cartoon-Stil plus Magenta-Hintergrund für
> vier Ausdrücke erzwingt). Hier reicht ein Bild pro Figur, kein Freistellen nötig.

## Die Formel (steckt in jedem der 40 Prompts)

Branchen-Gegenstand **+** zwei schlichte schwarze Punktaugen und ein Lächeln
**+** dünne schwarze Draht-Arme und -Beine **+** ein kleines Utensil in der Hand
**+** immer auf reinem Weiss, zentriert, quadratisch.

Jede der 20 Figuren gibt es in **zwei Techniken**:

- **3D-Icon** — weich schattiertes Maskottchen wie ein kleines Sammelfigürchen,
  mattes oder glänzendes Material, sanfter Studio-Schatten.
- **Flach-Vektor** — dieselbe Figur als 2D-Illustration statt Icon: sauberer
  dunkler Umriss, weiches Zwei-Ton-Cel-Shading (Grundfarbe + ein Schattenton,
  kein Glanz/Verlauf wie bei der 3D-Fassung), ausdrucksstärkeres Gesicht mit
  Augenbrauen und Wangenrot. *(Zweite Fassung: die erste war zu reduziert —
  kaum mehr als zwei Punkte und ein Strich.)*

Und einen **Ton**, verteilt nach Zielgruppe:

- **Verspielt** (14×) — Arme und Beine, leichte Gehpose, ein Utensil.
- **Zurückhaltend** (6×) — nur Arme, keine sichtbaren Beine, ruhige Haltung,
  gedecktere Farben, oft ganz ohne Utensil. Für Betriebe mit seriöser
  Zielgruppe (Treuhand, Anwalt, Architektur, Immobilien, Umzug,
  Physiotherapie) — genau der Fall, den du genannt hast.

**Gliederung:** Die 20 Figuren sind den acht Bereichen der Startseite
(`start.html`, Sektion `#branchen`) zugeordnet, je zwei bis drei. Die Bereiche
sind nach dem ANLIEGEN geschnitten, nicht nach dem Gewerbe: Zahnarzt und
Coiffeur sind verschiedene Welten, aber der Agent tut dasselbe — Termin.
So lässt sich prüfen, ob etwas fehlt: Jede Kachel braucht mindestens zwei
Figuren, sonst steht ein einzelner Betrieb für einen ganzen Bereich.

**Format:** Quadratisch (1:1), Figur zentriert und formatfüllend, **immer reines
Weiss**, kein Hintergrundmuster, keine weiteren Requisiten.

**Ablage:** fertige Datei unter `public/bilder/charaktere/<name>.webp`.
ACHTUNG: Die Liste wurde neu geordnet, die src-Pfade in `start.html` zeigen
teils noch auf gestrichene Figuren — beim Ablegen der Bilder mitziehen.

---

---

# Restaurants

## 1 — Café · Verspielt
Fast deckungsgleich mit deinem ersten Beispielbild — der direkte Massstab für
alle anderen 19.

**3D-Icon**
```
A cute 3D icon mascot of a paper coffee cup with a lid and two small steam wisps rising above it, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny butter cookie. Matte soft clay-like plastic finish, warm terracotta-brown cup with a cream lid. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a paper coffee cup with a lid and two small steam wisps rising above it, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny butter cookie, rendered with the same clean linework and a touch of surface texture. Colour palette: warm terracotta-brown cup body, cream lid, white steam wisps, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 2 — Bäckerei · Verspielt
Dasselbe Matt-Finish wie der Kaffeebecher, damit beide Food-Figuren erkennbar
zusammengehören.

**3D-Icon**
```
A cute 3D icon mascot of a plump baguette standing upright, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny rolling pin. Matte soft clay-like plastic finish in golden-brown with fine surface scoring lines. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a plump baguette standing upright, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny rolling pin, rendered with the same clean linework and a touch of surface texture. Colour palette: golden-brown body with three thin cream scoring lines, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 3 — Restaurant · Verspielt
Glänzende Keramik statt Matt — ein bisschen edler als die beiden Nachbarn,
passend zum Gastgeber-Gefühl.

**3D-Icon**
```
A cute 3D icon mascot of a round serving dome (cloche) tilted slightly open with a small steam wisp escaping, two simple round black dot eyes and a small curved smile peeking from the rim, thin black wire-line arms and legs in a light walking pose, holding a tiny fork and knife. Glossy ceramic finish in warm cream white with a small brass knob on top. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a round serving dome (cloche) tilted slightly open with a small steam wisp escaping, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile peeking from the rim, thin dark-outlined arms and legs in a light walking pose, holding a tiny fork and knife, rendered with the same clean linework and a touch of surface texture. Colour palette: cream-white dome, small warm-gold knob on top, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

---

# Arztpraxen

## 4 — Zahnarztpraxis · Verspielt
Der naheliegende Zahn-Charakter, klinisch sauber durch glänzendes
Porzellan-Weiss.

**3D-Icon**
```
A cute 3D icon mascot of a smiling molar tooth, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny toothbrush. Glossy porcelain finish in pure white with a small soft mint-green bowtie accent. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a smiling molar tooth, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny toothbrush, rendered with the same clean linework and a touch of surface texture. Colour palette: pure white tooth shape, small mint-green bowtie accent, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 5 — Physiotherapie · Zurückhaltend
Kein Utensil nötig, kein Requisit — Ruhe als Ausdrucksmittel, wie bei einer
Therapiestunde.

**3D-Icon**
```
A refined 3D icon mascot of a looped resistance stretch band, two simple round black dot eyes and a small closed smile, thin black wire-line arms only in a calm resting pose (no visible legs, resting gently on its own soft shadow), no props. Matte soft rubber finish in muted sage green. Soft, even studio lighting, subtle ambient-occlusion shading, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A refined 2D vector character illustration of a looped resistance stretch band, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two calm round dot eyes with a small curved brow line above each and a small closed smile, thin dark-outlined arms only in a composed resting pose (no visible legs), no props. Colour palette: muted sage-green flat shape, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 6 — Tierarztpraxis · Verspielt
Pastellblau hält es kinderfreundlich, ohne bei Tieren fehl am Platz zu
wirken.

**3D-Icon**
```
A cute 3D icon mascot of a stethoscope looped into a friendly rounded shape, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny bone. Glossy plastic finish in soft pastel blue with a brushed-silver chest piece. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a stethoscope looped into a friendly rounded shape, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny bone, rendered with the same clean linework and a touch of surface texture. Colour palette: soft pastel-blue body, small light-grey chest-piece shape, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

---

# Coiffeure

## 7 — Coiffeursalon · Verspielt
Ein Alltagsgegenstand aus dem Salon, glänzend und mit einem Hauch Gold für
den Salon-Glanz.

**3D-Icon**
```
A cute 3D icon mascot of a hand-held hairdryer, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny comb. Glossy plastic finish in soft blush pink with a thin gold trim ring. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a hand-held hairdryer, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny comb, rendered with the same clean linework and a touch of surface texture. Colour palette: soft blush-pink body, thin warm-gold trim ring, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 8 — Kosmetikstudio · Verspielt
Die Coiffeur-Ecke braucht eine zweite Figur, sonst steht der Salon allein
für Kosmetik, Massage und Nagelstudio mit.

**3D-Icon**
```
A cute 3D icon mascot of a rounded cosmetic cream jar with a lid, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny makeup brush. Matte soft clay-like plastic finish, soft blush-pink jar body with a warm cream lid. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a rounded cosmetic cream jar with a lid, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny makeup brush, rendered with the same clean linework and a touch of surface texture. Colour palette: soft blush-pink jar body with a warm cream lid, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

---

# Handwerker

## 9 — Malerbetrieb · Verspielt
Handwerk war die grösste Lücke der alten Liste: zwei Fahrzeug-Werkstätten,
aber kein einziger Bau-Beruf.

**3D-Icon**
```
A cute 3D icon mascot of a paint bucket with a slight drip of colour running down one side, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny paint roller. Matte soft clay-like plastic finish, cool slate-blue bucket with a bright white paint drip. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a paint bucket with a slight drip of colour running down one side, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny paint roller, rendered with the same clean linework and a touch of surface texture. Colour palette: cool slate-blue bucket with a bright white paint drip, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 10 — Elektriker · Verspielt
Zusammen mit Maler und Garage decken drei verschiedene Handwerke die Kachel
ab, statt zweimal dasselbe zu zeigen.

**3D-Icon**
```
A cute 3D icon mascot of a chunky wall power socket with two round holes forming a face plate, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny screwdriver. Matte soft clay-like plastic finish, warm off-white socket body with a soft grey frame. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a chunky wall power socket with two round holes forming a face plate, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny screwdriver, rendered with the same clean linework and a touch of surface texture. Colour palette: warm off-white socket body with a soft grey frame, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 11 — Autogarage · Verspielt
Zwei Finishes in einer Figur — mattes Gummi aussen, glänzender
Chromfelgen-Kern.

**3D-Icon**
```
A cute 3D icon mascot of a car tire with a chrome rim, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny oil can. Matte black rubber tire with a glossy chrome rim. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a car tire with a chrome rim, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny oil can, rendered with the same clean linework and a touch of surface texture. Colour palette: matte charcoal-black tire, light-grey rim shape, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

---

# Treuhänder

## 12 — Treuhandbüro · Zurückhaltend
Keine Beine, ruhige Haltung, gedecktes Navy — seriöse Zielgruppe, dieselbe
Formel.

**3D-Icon**
```
A refined 3D icon mascot of a closed ledger folder standing upright, two simple round black dot eyes and a small closed smile, thin black wire-line arms only in a calm resting pose (no visible legs, resting gently on its own soft shadow), holding a tiny pen held against its side. Matte finish in deep navy blue with a thin warm-gold spine trim. Soft, even studio lighting, subtle ambient-occlusion shading, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A refined 2D vector character illustration of a closed ledger folder standing upright, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two calm round dot eyes with a small curved brow line above each and a small closed smile, thin dark-outlined arms only in a composed resting pose (no visible legs), holding a tiny pen held against its side, rendered with the same clean linework and a touch of surface texture. Colour palette: deep navy-blue body, thin warm-gold spine trim, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 13 — Anwaltskanzlei · Zurückhaltend
Warmes Holz statt kaltem Grau — würdevoll, ohne unnahbar zu wirken.

**3D-Icon**
```
A refined 3D icon mascot of a judge's gavel standing upright, two simple round black dot eyes and a small closed smile, thin black wire-line arms only in a calm resting pose (no visible legs, resting gently on its own soft shadow), no props. Matte finish in deep walnut wood with a brushed brass band. Soft, even studio lighting, subtle ambient-occlusion shading, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A refined 2D vector character illustration of a judge's gavel standing upright, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two calm round dot eyes with a small curved brow line above each and a small closed smile, thin dark-outlined arms only in a composed resting pose (no visible legs), no props. Colour palette: deep walnut-brown body, thin warm-gold band, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 14 — Architekturbüro · Zurückhaltend
Ergänzt Treuhand und Anwalt um den planenden Beruf. Zurückhaltender Ton wie
die beiden anderen in dieser Kachel.

**3D-Icon**
```
A refined 3D icon mascot of a rolled-up architectural blueprint tied with a thin band, two simple round black dot eyes and a small closed smile, thin black wire-line arms only in a calm resting pose (no visible legs, resting gently on its own soft shadow), holding a tiny folding ruler. Matte finish in muted teal-blue with a warm sand-coloured tie band. Soft, even studio lighting, subtle ambient-occlusion shading, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A refined 2D vector character illustration of a rolled-up architectural blueprint tied with a thin band, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two calm round dot eyes with a small curved brow line above each and a small closed smile, thin dark-outlined arms only in a composed resting pose (no visible legs), holding a tiny folding ruler, rendered with the same clean linework and a touch of surface texture. Colour palette: muted teal-blue body, warm sand-coloured tie band, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

---

# Läden

## 15 — Blumenladen · Verspielt
Die Giesskanne trägt buchstäblich das, was sie giesst.

**3D-Icon**
```
A cute 3D icon mascot of a small watering can, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny flower. Glossy plastic finish in soft sage green with a cream-coloured handle. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a small watering can, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny flower, rendered with the same clean linework and a touch of surface texture. Colour palette: soft sage-green body, cream-coloured handle, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 16 — Buchhandlung · Verspielt
Leserbrille statt Zylinder oder Feder — ein Requisit, das jeder sofort
liest.

**3D-Icon**
```
A cute 3D icon mascot of an open book standing upright, face between the open pages, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny pair of reading glasses. Matte finish, cream-coloured pages with a warm burgundy cover. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of an open book standing upright, face between the open pages, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny pair of reading glasses, rendered with the same clean linework and a touch of surface texture. Colour palette: cream-coloured page shapes, warm burgundy cover edge, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

---

# Immobilien

## 17 — Immobilienbüro · Zurückhaltend
Das Haus als Figur ist der naheliegendste Griff — warmes Beige hält es
einladend statt kühl.

**3D-Icon**
```
A refined 3D icon mascot of a simple gable-roofed house shape, two simple round black dot eyes and a small closed smile, thin black wire-line arms only in a calm resting pose (no visible legs, resting gently on its own soft shadow), holding a tiny key. Matte finish in warm clay-beige with a thin brushed-brass roofline accent. Soft, even studio lighting, subtle ambient-occlusion shading, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A refined 2D vector character illustration of a simple gable-roofed house shape, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two calm round dot eyes with a small curved brow line above each and a small closed smile, thin dark-outlined arms only in a composed resting pose (no visible legs), holding a tiny key, rendered with the same clean linework and a touch of surface texture. Colour palette: warm clay-beige body, thin warm-gold roofline accent, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 18 — Umzugsfirma · Zurückhaltend
Immobilien ist mehr als Makeln: Umzug und Reinigung gehören zur selben
Frage, wer wann in die Wohnung kommt.

**3D-Icon**
```
A refined 3D icon mascot of a sturdy cardboard moving box with the flaps slightly open, two simple round black dot eyes and a small closed smile, thin black wire-line arms only in a calm resting pose (no visible legs, resting gently on its own soft shadow), holding a tiny roll of packing tape. Matte finish in warm kraft-brown cardboard with a soft beige tape strip. Soft, even studio lighting, subtle ambient-occlusion shading, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A refined 2D vector character illustration of a sturdy cardboard moving box with the flaps slightly open, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two calm round dot eyes with a small curved brow line above each and a small closed smile, thin dark-outlined arms only in a composed resting pose (no visible legs), holding a tiny roll of packing tape, rendered with the same clean linework and a touch of surface texture. Colour palette: warm kraft-brown body, soft beige tape strip, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

---

# Studios & Schulen

## 19 — Fitnessstudio · Verspielt
Gummi statt Kunststoff — fühlt sich nach echtem Trainingsgerät an.

**3D-Icon**
```
A cute 3D icon mascot of a dumbbell, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny water bottle. Matte soft rubber finish in black with red grip-band accents. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a dumbbell, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny water bottle, rendered with the same clean linework and a touch of surface texture. Colour palette: matte black body, two small red grip-band accents, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

## 20 — Fahrschule · Verspielt
Fitness stand allein für alles, was Anmeldung und Kursplan braucht. Die
Fahrschule zeigt, dass damit auch Schulen gemeint sind.

**3D-Icon**
```
A cute 3D icon mascot of a friendly car steering wheel seen from the front, two simple round black dot eyes and a small curved smile, thin black wire-line arms and legs in a light walking pose, holding a tiny set of car keys. Matte soft clay-like plastic finish, deep navy-blue wheel rim with a warm grey centre hub. Soft, even studio lighting, soft rounded ambient-occlusion shadows, a soft contact shadow beneath. Square 1:1 format, character centered and filling the frame, plain seamless white background, no other props or text.
```
**Flach-Vektor**
```
A charming 2D vector character illustration of a friendly car steering wheel seen from the front, clean bold dark-outlined linework with soft two-tone cel-shading for gentle depth (one base colour plus a single subtle darker shadow tone on the shaded side — no photographic gradients, no gloss, no ambient occlusion), two round dot eyes with a small curved brow line above each, rosy cheek blushes, and a warm curved smile, thin dark-outlined arms and legs in a light walking pose, holding a tiny set of car keys, rendered with the same clean linework and a touch of surface texture. Colour palette: deep navy-blue wheel rim with a warm grey centre hub, with one soft shadow tone for depth. Square 1:1 format, character centered and filling the frame, plain solid white background, no other props or text.
```

---

## Nicht mehr in der Liste

Aus der ersten Fassung gestrichen, weil sie einen Bereich doppelt besetzten
oder in keine der acht Kacheln fallen: Velowerkstatt, Weinhandlung, Fotostudio, Gärtnerei, Bank, Hotel / Pension.

Die Prompts dazu stehen in der Git-Historie, falls einer davon zurücksoll.
