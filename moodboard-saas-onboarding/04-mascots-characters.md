# Bucket 4 — Maskottchen · Avatare · Charakter-Momente

**Vibe:** Nicht realistisch, eher illustriert / blob-artig / geometrisch — freundlich, ansprechend,
einzigartig je Firma. Unser System: SVG-Platzhalter + generierte Higgsfield-Bilder pro Zustand.

---

## Referenz-Produkte mit Maskottchen/Avataren

| Produkt | Charakter | Was anschauen |
|---------|-----------|--------------|
| **Intercom** (Fin) | Illustrierter KI-Bot-Avatar | Widget-Icon, Avatar im Chat |
| **Tidio** (Lyro) | Freundlicher Bot-Avatar | Avatar-Emotionen, Bubble-Design |
| **HubSpot** | Sprocket-Charakter | Animationen, Onboarding-Moment |
| **Mailchimp** | Freddie (Affe) | Komplexes Maskottchen, viele Zustände |
| **Duolingo** | Duo (Eule) | State-Reaktionen: happy/sad/proud |
| **Headspace** | Blob-Charaktere | Einfache Blob-Formen, Zustands-Momente |
| **Notion** | Kleines Gesicht im Logo | Minimal, erkennbar |
| **Linear** | Kein Maskottchen | Gegenbeispiel: rein Typografie-basiert |

---

## Charakter-Bibliotheken & Generatoren

| Tool | Typ | Link |
|------|-----|------|
| **Boring Avatars** | SVG-Avatare aus Text, 5 Stile | https://boringavatars.com |
| **Avataaars** | Lego-artige Avatare, sehr bekannt | https://avataaars.com |
| **Open Peeps** | Handgezeichnete Illustrationen | https://openpeeps.com |
| **Humaaans** | Mix-Match-Figuren | https://www.humaaans.com |
| **Blush.design** | Illustrationen & Charaktere | https://blush.design |
| **Storyset** | Szenen mit Charakteren, animierbar | https://storyset.com |
| **unDraw** | Flache Illustrationen (keine Chars) | https://undraw.co |

---

## Charakter-Zustände — Unser System

Wir haben 4 States (bereits implementiert in `index.html`):

| Zustand | Auslöser | SVG-Animation | Bild-Datei |
|---------|---------|---------------|-----------|
| `idle` | Standard | Atmen (scale 1→1.04) | `idle.png` |
| `denken` | User sendet Nachricht | Wackeln + Augen hoch | `denken.png` |
| `sprechen` | Antwort kommt | Mund auf/zu | `sprechen.png` |
| `verlegen` | "Ich weiss nicht" | Wangen rot, Augen weg | `verlegen.png` |
| `freuen` | Begrüssung | Kleiner Hüpfer | → `idle.png` (kein eigener State) |

**Higgsfield-Workflow (bereits genutzt für Salbei):**
1. Basis-Bild generieren (Charakter-Konzept)
2. Bild-zu-Bild: 4x dieselbe Figur, andere Expression → Konsistenz
3. 8 Credits gesamt (2 pro State)
4. URLs landen in `data/<firma>.json` → `charakter.bilder.*`

---

## Design-Prinzipien für unsere Charaktere

1. **Nicht-menschlich, aber empathisch** — Blob, Tier, geometrische Form → weniger uncanny valley
2. **Grosse Augen** → Ausdrucksstärke, Sympathie
3. **Einfache Formen** → skaliert gut von 40px bis 200px
4. **Firmenfarbe = Körperfarbe** → `--farbe` aus Firmen-Config direkt auf Charakter
5. **Max. 4 Farben** im SVG/Bild → bleibt sauber

---

## Inspiration: Blob-Stil (unser SVG-Platzhalter nutzt diesen Stil)

```
Kreis-Körper + Oval-Bauch (Akzentfarbe) + Punkt-Augen + Oval-Mund
→ Einfach, aber mit Persönlichkeit
```

Mehr Blob-Inspiration:
- https://www.shapedivider.app (für Background-Blobs)
- https://blobmaker.app (zufällige Blob-Formen als SVG)
- https://getwaves.io (Wave-SVG für Hintergründe)
