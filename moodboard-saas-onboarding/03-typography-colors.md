# Bucket 3 — Typografie · Farben · Spacing

**Vibe:** Lesbar, modern, kein overdone Design. System-Font oder ein sauberes Sans-Serif.
Passt zum Base44-Stil: pragmatisch, aber gepflegt.

---

## Schriften (kostenlos / Google Fonts)

| Font | Charakter | Eignet sich für | Link |
|------|-----------|----------------|------|
| **Inter** | Neutral, tech, lesbar | Headlines + Body (unser MVP nutzt schon system-ui ~ Inter) | https://rsms.me/inter/ |
| **Geist** (Vercel) | Modern, sauber, Mono-Variante | Headlines, Developer-Feeling | https://vercel.com/font |
| **Plus Jakarta Sans** | Freundlich, rund, lebendig | Onboarding-Headlines | https://fonts.google.com/specimen/Plus+Jakarta+Sans |
| **DM Sans** | Leicht, luftig, lesbar | Breesstext, kleinere Labels | https://fonts.google.com/specimen/DM+Sans |
| **Outfit** | Rund, einladend | Marketing-Section, Hero | https://fonts.google.com/specimen/Outfit |

**Empfehlung MVP:** `Plus Jakarta Sans` für Headlines + `Inter` / `system-ui` für Body → lädt schnell, sieht modern aus.

---

## Farbsysteme (Referenz-Paletten)

### Bereits in unserem MVP
```css
--farbe:  #3f7d5a;   /* Salbei-Grün — Primär */
--akzent: #a8d5b9;   /* Mint — Sekundär/Hover */
```

### Erweiterung für UI (neu)
```css
--hintergrund:    #fafaf9;  /* Warm-Weiss statt reines #fff */
--karte:          #ffffff;  /* Karten-Weiss mit Schatten */
--border:         #e5e7eb;  /* Grau-200 für Trennlinien */
--text-haupt:     #111827;  /* Fast-Schwarz */
--text-sekundaer: #6b7280;  /* Grau-500 für Labels */
--text-placeholder:#9ca3af; /* Grau-400 */
--fehler:         #ef4444;  /* Rot-500 */
--erfolg:         #22c55e;  /* Grün-500 */
```

### Alternativen für andere Firmen (Inspiration)
| Name | Primär | Akzent | Stil |
|------|--------|--------|------|
| Indigo SaaS | `#4f46e5` | `#c7d2fe` | Tech, seriös |
| Coral Warm | `#f97316` | `#fed7aa` | Energie, startup |
| Sky Blue | `#0ea5e9` | `#bae6fd` | Vertrauen, healthcare |
| Violet | `#7c3aed` | `#ddd6fe` | Kreativ, modern |

---

## Spacing & Radien (Tailwind-Referenz)

Unser MVP soll sich an **Tailwind-Conventions** anlehnen (auch ohne Tailwind zu nutzen):

| Wert | CSS | Verwendung |
|------|-----|-----------|
| `rounded-lg` | `border-radius: 8px` | Buttons, Inputs |
| `rounded-xl` | `border-radius: 12px` | Karten |
| `rounded-2xl` | `border-radius: 16px` | Modals |
| `p-4` | `padding: 1rem` | Karten-Padding |
| `gap-3` | `gap: 0.75rem` | Form-Felder-Abstand |
| `shadow-sm` | leichter Schatten | Karten subtil heben |

---

## Ressourcen

- **Radix Colors** (semantische Paletten): https://www.radix-ui.com/colors
- **Tailwind Palette**: https://tailwindcss.com/docs/customizing-colors
- **Coolors** (Palette Generator): https://coolors.co
- **Realtime Colors** (Live-Vorschau): https://www.realtimecolors.com
