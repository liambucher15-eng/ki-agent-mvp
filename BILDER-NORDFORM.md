# Bild-Prompts für die Nordform-Demo

Drei Bilder pro Stück, 21 insgesamt. Erzeugen mit Higgsfield, danach als `.webp`
unter `public/bilder/produkte/` ablegen.

**Fassung 3.** Was an Fassung 2 falsch war, gemessen am erzeugten Eichentisch:

| Fehler im Prompt | Was er anrichtete | Jetzt |
|---|---|---|
| `hard falloff into shadow`, `one long soft shadow` | Ein schwerer Schlagschatten quer durchs Bild, das Möbel wirkte schwer und düster | Weiches Oberlicht, **nur** ein zarter Kontaktschatten unter den Füssen |
| `warm greige #E8E6E2` | Der Grund kippte ins Graue und wirkte schmutzig | `#F2F1EF`, also cremefarben — die Grundfarbe der Seite |
| Für alle sieben derselbe Dreiviertel-Blick | Sieben fast identische Bilder | **Jedes Stück hat einen eigenen Kameraeinsatz** |

Der dritte Punkt ist der wichtigste. Auf Liams Referenz stehen vier Möbel
nebeneinander, und keines ist aus derselben Richtung fotografiert: eines flach von
der Seite, eines von schräg oben, eines auf Augenhöhe, eines von unten. Genau das
macht eine Reihe spannend statt ordentlich.

Die Prompts sind auf Englisch — die Vokabeln, auf die es ankommt
(`scrim`, `raking light`, `tonal`, `negative space`), sitzen dort präzise.

---

## Die drei Plätze

Stand: alle drei Plätze sind gebaut (`demo-nordform-produkt.html`), und zwar
anders gruppiert als ursprünglich geplant. Produkt und Makro sitzen **oben
nebeneinander** als zwei Quadrate; das Editorial-Bild mit Modell sitzt
**darunter** im breiten Band und ist deshalb breit statt quadratisch.

| Platz | Format | Rezept | Vorbild |
|---|---|---|---|
| **1. Produkt** oben links | 1:1 | Hell, fast schattenlos, **je Stück ein anderer Winkel** | Liams Vierer-Reihe |
| **2. Makro** oben rechts | 1:1 | Nahaufnahme derselben Serie (Kante, Fuge, Zinkung) | Estetica Vision |
| **3. Editorial** im breiten Band darunter | 16:9 | Modell in Ton-in-Ton am Möbel, weisses Studio | forma.dom |

---

## Grundrezept 1 — Produktbild (1:1)

```
high fashion furniture campaign image, editorial, not product photography,
the object evenly bathed in broad soft light coming from above and slightly in front,
light source entirely outside the frame,
almost shadowless: only a faint soft contact shadow directly beneath the feet,
NO long cast shadow, NO dark corners, NO dramatic falloff, airy and light throughout,
seamless backdrop in warm cream #F2F1EF, floor and wall merging with no horizon line,
the backdrop slightly brighter than the object so the silhouette reads cleanly,
strictly tonal, cream and sand and honey only, no colour contrast,
bold asymmetric composition, the object placed off-centre with confident empty space around it,
shot on Hasselblad medium format, 80mm lens, f/8, fine natural film grain,
quiet, expensive, restrained, gallery-like,

NEGATIVE: no lighting equipment, no softbox, no scrim, no light stand, no tripod,
no studio hardware of any kind visible, no reflections of lights, no lens flare,
no props, no plants, no styling objects, no text, no watermark, no people
```

**Die `NEGATIVE`-Zeile ist der eigentliche Fix.** Im letzten Durchgang stand
`large scrim light directly above` im Prompt — also ein *Gerät*. Das Modell hat
folgerichtig eines ins Bild gemalt. Jetzt steht dort die Wirkung („evenly bathed
in broad soft light"), die Quelle wird ausdrücklich nach draussen verwiesen, und
die Technik ist einzeln ausgeschlossen.

Das `#F2F1EF` ist nicht geraten: exakt `--papier` aus `lib/demo-nordform.css`,
also die Grundfarbe der Seite. Damit steht das Möbel auf demselben Cremeton, auf
dem es später sitzt, und die Bildkante verschwindet.

**Der Winkel kommt pro Stück dazu** — er steht unten bei jedem Produkt und ist
der Grund, warum die sieben Bilder nebeneinander funktionieren.

## Grundrezept 2 — Editorial mit Modell (16:9)

```
high fashion furniture campaign, editorial photography,
one model in tonal tailoring — oversized oatmeal wool suit, wide leg trousers, no pattern,
hair slicked back, no jewellery, calm neutral expression, caught mid-movement,
the model physically interacting with the furniture,
bright cream cyclorama studio, no set dressing whatsoever,
evenly bathed in broad soft light from above and slightly in front, light source entirely outside the frame,
high-key, gentle shadow pooling under the furniture only,
the furniture and the clothing in the same colour family, cream and sand and bone throughout,
shot on Hasselblad medium format, 80mm lens, f/8, fine natural film grain,
full figure in frame, composed and still, editorial not commercial,

NEGATIVE: no lighting equipment, no softbox, no scrim, no light stand, no tripod,
no studio hardware of any kind visible, no reflections of lights, no lens flare,
no text, no watermark, no logos, no jewellery, no patterns
```

## Grundrezept 3 — Makro (1:1)

```
extreme macro, the material fills the entire frame edge to edge, almost abstract,
soft directional light grazing across the surface from one side, revealing texture but never harsh,
light source entirely outside the frame,
shallow depth of field with the focus plane running diagonally through the frame,
photorealistic, enormous detail, tactile, bright and warm,
tonal, no colour cast,

NEGATIVE: no lighting equipment, no softbox, no light stand, no studio hardware,
no reflections of lights, no props, no text, no watermark
```

---

## Zur Formensprache: der Tisch war wirklich langweilig

Liam hat recht. `data/nordform.json` beschreibt den Nord als „europäische Eiche,
geölt, 200 × 95 cm" mit „geradem Gestell" — und genau das kam heraus: ein
korrekter, gerader Tisch ohne Haltung.

Was die Daten **nicht** festlegen und was deshalb frei ist: Plattenstärke,
Fasenwinkel, wie weit die Beine eingerückt sind, ob eine Schattenfuge unter der
Platte läuft. Das sind die Details, an denen man einen entworfenen Tisch von
einem Baumarkttisch unterscheidet. Sie stehen jetzt in den Prompts.

**Weiter gehen geht nur über die Daten.** Wenn die Stücke wirklich als Design
lesen sollen — verjüngte Beine am Nord, eine sichtbare Zinkung, eine
schwebende Platte — dann muss das in `nordform.json` mit hinein, sonst
beschreibt Jonna ein anderes Möbel als das Bild zeigt. Sag Bescheid, dann ziehe
ich Daten und Bilder gemeinsam nach.

---

## 1. Eichentisch Nord — 899 €
*Europäische Eiche, geölt, 200 × 95 cm, gerades Gestell.*

**1a Produkt (1:1)** — `[Grundrezept 1]` +
```
KAMERA: very low, almost at floor level, looking slightly up along the length of the table,
so the tabletop reads as one thin horizontal line against the empty cream field above

a solid European oak dining table, oiled matte finish, warm honey grain,
a strikingly thin tabletop, only 24 mm, with a deep chamfer cut into the underside
so the edge reads as a sharp line, a narrow shadow gap between top and frame,
square legs set well inboard from the corners so the top appears to float,
200 x 95 cm proportions, precise and architectural
```

**1b Editorial (16:9)** — `[Grundrezept 2]` +
```
the model standing behind a long solid oak dining table, both palms flat on the tabletop,
leaning her weight forward onto the surface, looking directly into the lens,
the oak the same warm sand tone as her suit
```

**1c Makro (1:1)** — `[Grundrezept 3]` +
```
the chamfered edge of an oiled oak tabletop running diagonally across the frame,
open grain and fine medullary rays, one faint natural knot,
matte oiled surface with almost no sheen, honey and cream tones
```

---

## 2. Esstisch Sund — 1290 €
*Amerikanischer Nussbaum, 220 × 100 cm, konische Beine.*

**2a Produkt (1:1)** — `[Grundrezept 1]` +
```
KAMERA: high angle looking down at roughly 45 degrees,
the rectangular tabletop reading as a strong dark geometric shape in the cream field,
the tapered legs splaying away beneath it

a solid American walnut dining table, deep chocolate grain with violet undertones,
slim round legs tapering to a fine point where they meet the floor,
the legs raked slightly outward, mid-century influence,
a slender apron set back beneath the top, 220 x 100 cm
```

**2b Editorial (16:9)** — `[Grundrezept 2]` +
```
the model seated sideways on the edge of a dark walnut dining table, one foot on the floor,
back straight, hands resting in her lap, turned to look past the camera,
the dark walnut the only deep tone in an otherwise bone-coloured frame
```

**2c Makro (1:1)** — `[Grundrezept 3]` +
```
the junction where a slim tapered walnut leg meets the underside of a table top,
the clean mortise line, dark grain flowing along the taper,
chocolate brown with violet undertones, soft light along the curve
```

---

## 3. Beistelltisch Vik — 329 €
*Eiche, 55 cm Durchmesser.*

**3a Produkt (1:1)** — `[Grundrezept 1]` +
```
KAMERA: straight-on side elevation, dead level with the tabletop, perfectly frontal,
the table reading as a flat graphic symbol, almost a drawing

a small round side table in solid oiled oak, 55 cm diameter, about 50 cm tall,
a very thin disc top with a rounded rim, three slim legs tapering to points,
the legs splaying outward at a precise angle, light honey oak, matte
```

**3b Editorial (16:9)** — `[Grundrezept 2]` +
```
the model crouching on one knee beside a small round oak side table,
one hand resting flat on its top, the other arm hanging loose,
her oversized oatmeal suit pooling on the studio floor around her
```

**3c Makro (1:1)** — `[Grundrezept 3]` +
```
the rounded rim of a small oiled oak table top seen almost edge-on,
the end grain of the solid wood visible along the curve, fine sanding marks,
warm honey tone, matte surface
```

---

## 4. Stuhl Lund — 249 €
*Eiche mit Filzsitz, stapelbar.*

**4a Produkt (1:1)** — `[Grundrezept 1]` +
```
KAMERA: from behind and slightly above, three-quarter,
so the curve of the backrest is the main subject and the seat falls away beneath it

a dining chair, solid oiled oak frame, pressed wool felt seat pad in sand grey,
a single continuous steam-bent backrest curving in one sweep from side to side,
slim round legs, the rear legs continuing up into the backrest in one piece,
stackable, no armrests, light honey oak
```

**4b Editorial (16:9)** — `[Grundrezept 2]` +
```
the model carrying a single oak and felt chair by its backrest, arm extended down at her side,
walking through the empty white studio, mid-stride, chair swinging slightly,
the sand grey felt exactly matching the oatmeal of her suit
```

**4c Makro (1:1)** — `[Grundrezept 3]` +
```
the seam where a pressed wool felt seat pad meets a solid oak chair frame,
the dense compressed fibre structure of the felt against the smooth oiled grain,
sand grey against honey oak, soft light along the join
```

---

## 5. Armlehnstuhl Åre — 389 €
*Eiche mit Lederbezug.*

**5a Produkt (1:1)** — `[Grundrezept 1]` +
```
KAMERA: low, looking slightly up from the front-left corner,
so the armrests read as two strong diagonals crossing the frame

a dining armchair, solid oiled oak frame, saddle leather seat and back in warm cognac,
the leather slung between the oak arms like a hammock rather than upholstered onto it,
visible saddle stitching along every edge, a single leather strap across the back,
slim tapered oak legs, softly worn leather
```

**5b Editorial (16:9)** — `[Grundrezept 2]` +
```
the model sitting deep in a cognac leather and oak armchair, one leg crossed over the other,
one forearm along the armrest, head turned to the light,
the cognac leather the single warm note against her bone-coloured suit
```

**5c Makro (1:1)** — `[Grundrezept 3]` +
```
saddle stitching where cognac leather is pulled taut over the oak frame of an armrest,
individual thread loops, the natural pebbled grain of the leather, a soft crease,
warm cognac and honey oak, light along the stitch line
```

---

## 6. Leuchte Sund — 179 €
*Nachttischlampe · Messing mit Opalglas, runder Standfuss.*

**Geändert: Tischlampe statt Deckenleuchte.** Liams zwei Referenzen zeigen
unterschiedliche Richtungen — eine warme Messing-Tischlampe mit rundem
Pilzschirm auf gedrechseltem Holzsockel, und eine kühle, gebürstet-stählerne
Schreibtischleuchte mit Schwanenhals. Übernommen wurde die erste: Silhouette
(Standfuss, sich verjüngender Hals, gerundeter Schirm) und die warme,
gegründete Haltung. Nicht übernommen: das lackierte Metall des Schirms und der
kalte Stahlton der zweiten Referenz — beides widerspricht der Firmenangabe
„Messing mit Opalglas". Der Schirm bleibt deshalb echtes, von innen leuchtendes
Opalglas statt lackiertem Blech; das hält Bild und Datenblatt deckungsgleich.

Auf der Produktseite entsprechend nachgezogen: `kurz`/`text`/`material` bei
`leuchte-sund` in `demo-nordform-produkt.html` sagen jetzt „Nachttischlampe …
kein Deckenanschluss", und die Kurzzeile auf der Landingpage stimmt überein.

> **NEGATIVE-Zeile beachten:** Wie zuvor ist hier die Leuchte selbst das
> Produkt. `no lighting equipment` NICHT übernehmen, sonst löscht es das Stück
> mit. Es bleibt bei `no softbox, no scrim, no light stand, no tripod, no
> studio hardware` — die Lampe gehört ausdrücklich ins Bild.

**6a Produkt (1:1)** — `[Grundrezept 1, NEGATIVE angepasst]` +
```
KAMERA: extreme low angle, near floor level, looking up at the lamp from just in front of its base,
the domed shade looming large against the cream field above, the base close and grounded in the foreground

a brass table lamp, a round weighted brass base sitting flat on the surface,
a slender brass stem tapering upward like an inverted cone, flaring out again into a thin brass collar,
a rounded opal glass dome shade sitting on the collar, glowing softly and warmly from within,
compact nightstand scale, no visible cord, no ceiling attachment of any kind
```

**6b Editorial (16:9)** — `[Grundrezept 2]` +
```
the model kneeling beside a low side table, one hand resting lightly on the glowing opal dome of the table lamp,
her face softly lit from below and to the side by its warm glow, the rest of the bright studio falling away,
the brass base catching a single warm highlight
```

**6c Makro (1:1)** — `[Grundrezept 3]` +
```
the collar where brushed brass meets opal glass on a table lamp shade,
fine circular brushing marks in the metal, the milky glass lit from inside,
a single warm specular line running along the brass edge
```

---

## 7. Teppich Fjord — 449 €
*Wolle, 200 × 300 cm.*

**7a Produkt (1:1)** — `[Grundrezept 1]` +
```
KAMERA: directly overhead, 90 degrees top-down, flat lay,
the rug filling the frame as a pure rectangle, edges parallel to the frame

a flat-woven wool rug in muted greige with a subtle tonal stripe along one edge,
one corner folded back on itself to reveal the weave and the reverse side,
short fringe on the short sides, 200 x 300 cm proportions
```

**7b Editorial (16:9)** — `[Grundrezept 2]` +
```
the model kneeling on a greige wool rug in an empty white studio, sitting back on her heels,
smoothing the rug flat with both hands, looking down at the weave,
the wool and her oatmeal suit indistinguishable in tone
```

**7c Makro (1:1)** — `[Grundrezept 3]` +
```
flat-woven wool at thread level, the over-under structure of the weave filling the frame,
individual undyed fibres with natural colour variation between strands,
muted greige, soft daylight across the surface
```

---

## Reihenfolge und Prüfung

**Prüfe jedes Bild zuerst auf sichtbare Technik.** Der häufigste Ausrutscher ist
eine leuchtende Fläche am oberen Bildrand — die Softbox, die das Modell
mitzeichnet, weil sie im Prompt benannt war. Sie ist auch dann falsch, wenn sie
schön aussieht: Eine Kampagne zeigt nie ihr eigenes Werkzeug.

**Erzeuge alle sieben Produktbilder zuerst**, nicht ein Stück komplett. Sie liegen
später nebeneinander im Sortiment-Raster. In einem Durchgang erzeugt, sitzen
Licht und Cremeton gleich; über Tage verteilt driftet das Modell.

**Nimm das erste gelungene Produktbild als Referenzbild** für die übrigen sechs.
Aber überschreibe den Winkel jedes Mal — sonst zieht die Referenz alle sieben in
dieselbe Perspektive zurück, und dann ist der ganze Punkt weg.

**Beim Modellbild: dieselbe Person für alle sieben.** Sonst wirkt es wie sieben
Kampagnen statt einer.

**Prüfe jedes Bild gegen `data/nordform.json`.** Der Agent antwortet aus den
Daten. Zeigt das Bild acht Stühle am Eichentisch, die Daten aber „sechs bequem,
acht wenn es eng sein darf", dann widerspricht die Seite dem Agenten — vor
Publikum.
