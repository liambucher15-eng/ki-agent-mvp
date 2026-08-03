# Archiv

Frühere Versionen und Prototypen — **nicht mehr aktiv**, nur als Prozessbeleg aufbewahrt.
Die lebende Version des Onboardings ist `public/onboarding-aura.html`.

- `onboarding.html` — erstes Onboarding-Gerüst (abgelöst)
- `onboarding-neu.html` — zweite Iteration (abgelöst)
- `willkommen.html` — Landing-/Willkommens-Prototyp
- `orb-prototyp.html` — Prototyp der leuchtenden Agent-Kugel (Orb)
- `charakter.html` + `charakter-generieren.js` — eigenständiger Charakter-Ersteller
  (SVG-Platzhalter). Legte Bilder unter `localStorage["charakter:<firmaId>"]` ab
  und war damit eine **zweite Charakterquelle** neben der Datenbank: Der Test-Chat
  überschrieb mit diesen lokalen Bildern die echten Bilder der Firma. Der
  Charakter lebt heute ausschliesslich in der `firmen`-Zeile (`daten.charakter`),
  erstellt im Onboarding, gepflegt im Dashboard.
