# Bild-Prompts für die Oberfläche

15 Bilder fehlen noch: **6** für die Vorteile-Sektion, **8** für die
Charakter-Galerie, **1** für die Wortmarke im Charakter-Designer.

Zu jedem Bild stehen **zwei Ansätze**. Nimm pro Gruppe *einen* und zieh ihn
durch — gemischt sieht eine Reihe zufällig aus, nicht vielfältig.

Die Prompts sind auf Englisch, wie in `BILDER-NORDFORM.md`: Die Vokabeln, auf
die es ankommt (`three-quarter view`, `rim light`, `negative space`), sitzen
dort präziser.

---

## Der Unterschied zwischen den beiden Gruppen

Das ist die wichtigste Entscheidung im ganzen Dokument, und sie geht in zwei
**entgegengesetzte** Richtungen:

| | Vorteile (6) | Galerie (8) |
|---|---|---|
| Figur | **immer dieselbe** — eure Marke | **acht verschiedene** |
| Zweck | zeigen, was der Agent kann | zeigen, wie unterschiedlich Figuren ausfallen |
| Fehler wäre | acht verschiedene Figuren → keine Marke | achtmal dieselbe → die Sektion sagt nichts |

Bei den Vorteilen ist Wiedererkennung alles. Bei der Galerie ist Verschiedenheit
alles — sie ist der einzige echte Beleg für „dein eigener Charakter".

---

## Die Grundfigur (nur für die Vorteile)

Diese Zeile steht **unverändert** in allen sechs Vorteil-Prompts. Sie ist der
Grund, warum die sechs Bilder wie eine Familie aussehen:

```
THE CHARACTER (identical in every image): a friendly mascot shaped like a
rounded square, deep violet (#6d6de4), matte finish. Two simple black dot eyes,
a small calm smile, no nose. Thin dark limbs with simple rounded hands and feet.
Same proportions and same head-to-body ratio every time.
```

Wenn du ein bestehendes Bild der Figur hast, häng es als Referenz an — dann
brauchst du diese Beschreibung nicht wörtlich, und die Figur trifft besser.

---

# Teil 1 · Die sechs Vorteile

**Format:** 16:9 quer, 1400 × 788 px reicht auch für Retina.
**Ablage:** `public/bilder/vorteile/`
**Grundfläche:** cremeweiss `#F6F5FB` — dieselbe Farbe wie die Sektion, damit
das Bild nicht als Kasten auf der Seite klebt.

Die Figur **zeigt** in jedem Bild etwas: sie hält, deutet, greift. Nie nur
Porträt — ein Maskottchen, das nichts tut, illustriert auch nichts.

---

## 01 · Dein eigener Mitarbeiter

**Idee:** Dieselbe Figur in mehreren Zuständen nebeneinander. Das ist der
Beweis für „fünf Zustände" — als Einzelbild wäre die Aussage nicht zu sehen.

**Ansatz A — 3D-Render, wie deine Vorlagen**
```
Three identical 3D-rendered mascot characters standing in a row on a soft
cream surface, seen slightly from the front-left. [GRUNDFIGUR]. From left to
right their expressions differ: the first waits calmly with hands at its sides,
the second tilts its head and listens, the third speaks with a small speech
bubble floating beside it. Soft studio light from above, gentle contact shadows
under the feet, no cast shadows across the floor. Background: flat cream #F6F5FB,
empty, generous negative space above the characters. Format 16:9.
NEGATIVE: no text, no lettering, no logos, no lighting equipment, no visible
softbox, no gradient background, no additional characters.
```

**Ansatz B — flache Illustration, wie euer Maskottchen heute**
```
Flat vector illustration, clean outlines, no gradients. Three identical mascot
characters in a row. [GRUNDFIGUR]. Their expressions differ: waiting, listening
with a tilted head, speaking with a small speech bubble. All three sit on a
single thin horizontal ground line. Background: solid cream #F6F5FB. Wide empty
space above the figures. Format 16:9.
NEGATIVE: no text, no shading, no 3D, no drop shadows, no photographic texture.
```

---

## 02 · Er lernt deine Seite

**Idee:** Ein Webseiten-Rechteck links, die Figur rechts, dazwischen fliesst
etwas hinüber. Die Bewegungsrichtung ist die ganze Aussage.

**Ansatz A — 3D**
```
A simplified 3D webpage panel floating on the left, shown at a slight angle:
plain grey placeholder blocks for text and one image block, no readable words.
On the right, the mascot character holds a magnifying glass up to the panel.
[GRUNDFIGUR]. Between them, a stream of small pale geometric shapes flows from
the panel toward the character. Soft light from above, cream surface #F6F5FB,
gentle contact shadow. Format 16:9.
NEGATIVE: no readable text, no real website screenshot, no brand logos, no
lighting equipment, no busy background.
```

**Ansatz B — flach**
```
Flat vector illustration, clean outlines, no gradients. Left: a simple webpage
rectangle with grey placeholder bars instead of text. Right: the mascot
character holding a magnifying glass toward it. [GRUNDFIGUR]. A row of small
dots curves from the page to the character, showing direction of flow.
Background: solid cream #F6F5FB. Format 16:9.
NEGATIVE: no readable text, no shading, no 3D, no photographic texture.
```

---

## 03 · Er weiss, wo der Besucher gerade steht

**Idee:** Die Figur steht **neben** einer geöffneten Produktseite und deutet
auf genau ein Element darauf. Das „genau dieses eine" muss sichtbar sein.

**Ansatz A — 3D**
```
A 3D tablet standing upright on a cream surface, showing a simplified product
page: one large product photo area, a short price line, and a dark button. No
readable words, only grey placeholder bars. The mascot character stands beside
the tablet, leaning in, one hand pointing directly at the price line.
[GRUNDFIGUR]. A soft glow marks the element being pointed at. Soft top light,
cream background #F6F5FB, gentle contact shadow. Format 16:9.
NEGATIVE: no readable text, no real brand, no lighting equipment, no clutter.
```

**Ansatz B — flach**
```
Flat vector illustration, clean outlines. A simple tablet outline showing a
product page reduced to shapes: one image square, two grey bars, one dark
button. The mascot character stands beside it and points at one specific bar,
which is highlighted in violet. [GRUNDFIGUR]. Background: solid cream #F6F5FB.
Format 16:9.
NEGATIVE: no readable text, no shading, no 3D, no drop shadows.
```

---

## 04 · Er führt zum Angebot

**Idee:** Aus dem Gespräch tauchen Produktkarten auf. Die Karten müssen als
Karten erkennbar sein — Bild oben, Preiszeile, Knopf.

**Ansatz A — 3D**
```
The mascot character on the left, one arm raised in a presenting gesture.
[GRUNDFIGUR]. To its right, three simplified 3D product cards float in a
staggered row, each with a grey image area at the top, a short price bar and a
small dark button. No readable words. The nearest card is slightly larger and
in focus, the two behind fall softly out of focus. Soft top light, cream
surface #F6F5FB, gentle contact shadows. Format 16:9.
NEGATIVE: no readable text, no real products, no brand logos, no lighting
equipment.
```

**Ansatz B — flach**
```
Flat vector illustration, clean outlines. The mascot character on the left with
one arm raised, presenting. [GRUNDFIGUR]. Three simple product cards fan out to
its right, each drawn as a rounded rectangle with an image square, a grey price
bar and a small dark button. A speech bubble behind the character connects it to
the cards. Background: solid cream #F6F5FB. Format 16:9.
NEGATIVE: no readable text, no shading, no 3D, no photographic texture.
```

---

## 05 · Voll anpassungsfähig

**Idee:** Dieselbe Figur in mehreren Ausführungen — andere Farbe, andere Form.
Das zeigt Einstellbarkeit besser als jedes Schieberegler-Symbol.

**Ansatz A — 3D**
```
Four variants of the same 3D mascot character standing in a row on a cream
surface. Same silhouette and same proportions in all four, but each in a
different colour: deep violet, warm terracotta, forest green, deep navy. One of
them is slightly rounder, one slightly more angular. Beside the row, a small
floating panel with three simple slider shapes, no readable labels. Soft top
light, cream background #F6F5FB, gentle contact shadows. Format 16:9.
NEGATIVE: no readable text, no lighting equipment, no busy background, no more
than four characters.
```

**Ansatz B — flach**
```
Flat vector illustration, clean outlines, no gradients. Four variants of the
same mascot character in a row: identical silhouette, four different colours
(deep violet, terracotta, forest green, navy). To the side, three simple slider
shapes without labels. Background: solid cream #F6F5FB. Format 16:9.
NEGATIVE: no readable text, no shading, no 3D, no drop shadows.
```

---

## 06 · Ehrlichkeit

**Idee:** Die Figur hält ein **leeres** Blatt hoch und zuckt freundlich mit den
Schultern. Die Leere ist der Inhalt — sie sagt „das steht hier nicht".

**Ansatz A — 3D**
```
The mascot character standing on a cream surface, holding up a single blank
sheet of paper with both hands, shoulders slightly raised in a friendly shrug,
head tilted. [GRUNDFIGUR]. The sheet is completely empty — no lines, no text,
no marks. Its expression is calm and open, not apologetic or sad. Soft top
light, cream background #F6F5FB, gentle contact shadow, generous empty space
around the figure. Format 16:9.
NEGATIVE: no text, no question marks, no exclamation marks, no sad expression,
no red colours, no error symbols, no lighting equipment.
```

**Ansatz B — flach**
```
Flat vector illustration, clean outlines. The mascot character holds up one
completely blank sheet of paper with both hands, shoulders slightly raised in a
friendly shrug. [GRUNDFIGUR]. Calm, open expression — not sad, not apologetic.
Background: solid cream #F6F5FB, plenty of empty space. Format 16:9.
NEGATIVE: no text, no question marks, no error symbols, no red, no shading,
no 3D.
```

> **Warum kein Fragezeichen und kein Rot:** „Ich weiss es nicht" ist auf dieser
> Seite die *gute* Antwort, nicht ein Fehler. Ein rotes Ausrufezeichen würde
> genau das Gegenteil erzählen.

---

# Teil 2 · Die acht Galerie-Figuren

**Format:** quadratisch 1:1, 600 × 600 px genügt (Kachel ist max. 271 px breit).
**Ablage:** `public/bilder/charaktere/`
**Grundfläche:** hell oder freigestellt, Figur mittig, rundherum Luft.

Hier gilt das Gegenteil von Teil 1: **Jede Figur muss anders sein.** Andere
Grundform, andere Farbe, andere Haltung. Wenn zwei davon Geschwister sein
könnten, ist die Sektion gescheitert.

**Ansatz A — Figur mit Werkzeug** (leichter zu treffen, sofort verständlich)
Jede Figur hält einen kleinen Gegenstand ihrer Branche.

**Ansatz B — Figur ohne Werkzeug** (eleganter, schwerer zu treffen)
Die Branche steckt in Form und Farbe, nicht in einer Requisite. Ein Zahnarzt-
Agent ist klinisch weiss und glatt, ein Blumenladen-Agent weich und geschwungen.

Gemeinsamer Rahmen für **beide** Ansätze:
```
Friendly mascot character, flat stylised cartoon style, clean outlines,
centred, facing the viewer, calm friendly resting expression. Square format.
Background: single flat very light surface, generous margin around the figure.
NEGATIVE: no text, no lettering, no logos, no human faces, no photorealism.
```

| Datei | Ansatz A — mit Werkzeug | Ansatz B — nur Form und Farbe |
|---|---|---|
| `restaurant.webp` | warm terracotta, rounded belly, holds a small plate with a cloche | warm terracotta, soft rounded body like a bread loaf, cosy and full |
| `zahnarztpraxis.webp` | clean mint-white, smooth, holds a tiny dental mirror | clean mint-white, perfectly smooth and symmetrical, calm and clinical |
| `velowerkstatt.webp` | steel blue, sturdy, holds a small wrench | steel blue, compact and mechanical, two round wheel-like feet |
| `coiffeursalon.webp` | soft rose, slender, holds small scissors | soft rose, slender with a wavy crest on its head |
| `treuhandbuero.webp` | deep navy, upright and rectangular, holds a slim folder | deep navy, strictly rectangular, precise straight edges, upright |
| `fitnessstudio.webp` | energetic orange, athletic stance, holds a small dumbbell | energetic orange, wide stance, strong compact shoulders, leaning forward |
| `blumenladen.webp` | fresh green, holds a single small flower | fresh green, soft organic silhouette with a leaf-shaped head |
| `autogarage.webp` | graphite grey, broad and solid, holds a small oil can | graphite grey, broad and low, heavy solid stance |

Jede Zeile hinter den gemeinsamen Rahmen hängen. Beispiel:

```
Friendly mascot character, flat stylised cartoon style, clean outlines, centred,
facing the viewer, calm friendly resting expression. Square format. Background:
single flat very light surface, generous margin around the figure.
The character: warm terracotta, soft rounded body like a bread loaf, cosy and
full.
NEGATIVE: no text, no lettering, no logos, no human faces, no photorealism.
```

> **Wenn du die Beschriftung änderst:** Die Branchennamen stehen im Klartext in
> `start.html` unter jeder Kachel. Nimmst du andere Branchen, dort mit anpassen —
> sonst steht „Zahnarztpraxis" unter einem Blumenladen-Agenten.

---

# Teil 3 · Die Wortmarke

`public/bilder/maskottchen.png` — das Bild zwischen **AU** und **RA** über dem
Charakter-Designer.

**Format:** PNG mit **transparentem** Hintergrund, quadratisch, mindestens
1024 × 1024 px, unter 300 KB. Rundherum ~5 % Luft. Muss auf Weiss funktionieren,
also nichts Weisses am Rand.

**Ansatz A — die Figur als Kopf**
```
Head-only version of the mascot character, front view, centred.
[GRUNDFIGUR — head only]. Simple, bold, readable at very small size. No body,
no limbs. Fully transparent background.
NEGATIVE: no text, no white background, no drop shadow, no fine details that
disappear when small.
```

**Ansatz B — die ganze Figur, sehr klein gedacht**
```
Full mascot character, front view, standing, centred, reduced to its simplest
readable form. [GRUNDFIGUR]. Designed to stay recognisable at 32 pixels: bold
silhouette, only two or three shapes, no small details. Fully transparent
background.
NEGATIVE: no text, no white background, no drop shadow, no thin lines.
```

> **Prüf es bei 32 px**, bevor du es ablegst. Was dort zu Brei wird, ist als
> Wortmarke unbrauchbar, egal wie gut es gross aussieht.

---

## Nach dem Erzeugen

1. Als `.webp` speichern (Wortmarke: `.png`, wegen der Transparenz).
2. Unter dem exakten Dateinamen aus den Tabellen ablegen.
3. Nichts am Code ändern — die Platzhalter verschwinden von selbst, sobald die
   Datei da ist (`onerror="this.remove()"` an jedem `<img>`).
