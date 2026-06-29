# Bucket 5 — Chat-Widgets · Micro-Interactions · Empty States

**Vibe:** Das eingebettete Widget ist das Produkt-Aushängeschild auf fremden Seiten.
Muss: klein & unauffällig im Bubble-Zustand, angenehm beim Öffnen, schnell ladend.

---

## Referenz-Widgets live anschauen

| Produkt | Widget-Stil | Live-Demo |
|---------|------------|-----------|
| **Intercom** | Runder Bubble, blaue Icon, slide-in Panel | https://intercom.com (eigene Site) |
| **Crisp** | Kleines Chat-Fenster, Avatar oben | https://crisp.chat |
| **Tidio** | Bubble + Pop-up-Begrüssung | https://tidio.com |
| **Drift** | Runder Bubble, sofort Name sichtbar | https://drift.com |
| **Freshchat** | Hellblau, runder Bubble | https://freshworks.com/live-chat-software/ |
| **HubSpot Live Chat** | Sehr schlicht, anpassbar | https://www.hubspot.com/products/crm/live-chat |

**Tipp:** Auf jeder dieser Seiten ist ein Live-Widget — direkt im Browser testen,
wie es sich beim Hovern, Öffnen, Schreiben anfühlt.

---

## Widget-Anatomie (unser Plan)

```
[Geschlossen]
┌─────────────────┐
│  💬  [Avatar]   │  ← runder Bubble, position: fixed bottom-right
└─────────────────┘     24px border-radius, box-shadow

[Geöffnet — 360×520px]
┌──────────────────────┐
│ [Avatar] Name    [×] │  ← Header, Firmenfarbe
├──────────────────────┤
│                      │
│   [Bot-Bubble]       │  ← Chatverlauf
│         [User-Bubble]│
│                      │
├──────────────────────┤
│ [Input ──────] [→]   │  ← Footer, weiss
└──────────────────────┘
```

---

## Micro-Interactions

### Typing-Indicator ("tippt…")
```css
/* Drei Punkte nacheinander pulsieren */
@keyframes typing {
  0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
  30%            { opacity: 1;   transform: translateY(-4px); }
}
```
Jeder Punkt mit `animation-delay: 0s / 0.2s / 0.4s`.

### Bubble-Öffnen-Animation
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
```
Dauer: `200ms ease-out` — spürbar, nicht träge.

### Avatar-Reaktions-Timing (bereits in `index.html`)
- `denken` → sofort beim Absenden
- `sprechen` → sobald Antwort angekommen, `3000ms`
- `verlegen` → bei "weiss nicht"-Antworten, `2500ms`
- Auto-Revert zu `idle` via `setTimeout`

---

## Empty States

Ideen für leere Zustände im Onboarding:

| Screen | Empty State Text | Illustration |
|--------|-----------------|-------------|
| Keine Firma erstellt | "Dein erster Agent wartet — leg jetzt los" | Kleiner Charakter mit Fragezeichen |
| Charakter noch nicht generiert | "Dein Charakter nimmt bald Form an…" | Platzhalter-SVG pulsiert |
| Kein Wissen eingetragen | "Je mehr du hier einträgst, desto klüger wird dein Agent" | Buch-Illustration |
| Embed noch nicht aktiv | "Dein Widget ist startklar — nur noch deployen" | Rakete oder Stecker-Icon |

---

## Ressourcen

- **Popmotion** (JS-Animationen): https://popmotion.io
- **Auto-Animate** (einfache Übergangs-Animationen): https://auto-animate.formkit.com
- **Motion One** (leichtgewichtig): https://motion.dev
- **CSS Loaders** (Spinner-Referenz): https://css-loaders.com
- **Lottie Files** (vorgefertigte Animationen): https://lottiefiles.com/featured
