# Bucket 2 — Onboarding-Wizards · Step-by-Step-Flows

**Vibe:** Schritt-für-Schritt, klare Progress-Anzeige, ein Fokus pro Screen.
Unser Wizard: 6 Schritte (Login → Firma → Charakter → Vorschau → Embed → Fertig).

---

## Referenz-Produkte (Onboarding live erleben)

| Produkt | Was anschauen | Link |
|---------|--------------|------|
| **Typeform** | Einer-Frage-pro-Screen, sanfte Übergänge | https://typeform.com |
| **Webflow** | Site-Wizard, klare Steps, gutes Feedback | https://webflow.com |
| **Framer** | Kurzes Onboarding, direkt zum "Aha-Moment" | https://framer.com |
| **Loom** | Video-Onboarding, Progress-Checkboxen | https://loom.com |
| **Superhuman** | Geführtes Setup, sehr personal | https://superhuman.com |
| **Notion** | Workspace-Setup-Wizard, Icons & Emojis | https://notion.so |
| **Slack** | Workspace-Einrichtung, Channel-Ersteller | https://slack.com |
| **Airtable** | Template-Auswahl als Schritt, große Karten | https://airtable.com |

---

## Screenshot-Galerie-Quellen

- **Pageflows — Onboarding**: https://pageflows.com/category/onboarding/
- **SaaSFrame — Onboarding**: https://saasframe.io/categories/onboarding
- **Mobbin — Flows**: https://mobbin.com/flows
- **UX Archive** (Mobile + Web Flows): https://uxarchive.com

---

## Wizard-Patterns für unser Onboarding

### Progress-Bar / Step-Indicator
```
● ─── ○ ─── ○ ─── ○ ─── ○ ─── ○
1     2     3     4     5     6
```
- Punkte oben (Linear-Stil) oder Zahlen-Chips
- Aktueller Schritt: gefüllt in `--farbe`, fertige Schritte: Häkchen ✓
- Minimale visuelle Ablenkung — Fokus auf den Inhalt

### Ein-Fokus-Prinzip
Jeder Screen = **eine Frage / eine Aktion**. Beispiel:
- Schritt 2 (Firma): Name + Kurzbeschreibung auf einem Screen → weiter
- Kein "Alles auf einer Seite"-Formular

### Freundliche Leere Zustände
- "Dein Agent heisst bald…" (Charakter-Step ohne Bild)
- Platzhalter-Avatar mit Pulse-Animation bis Bild geladen
- Fortschritts-Motivierung: "Du bist fast da 🎉"

### CTA-Button-Muster
- Gross, prominent, vollbreite (auf Mobile)
- "Weiter →" statt "Speichern"
- Deaktiviert bis Pflichtfeld ausgefüllt
- Spinner beim Laden (kein sofortiges Zurückspringen)
