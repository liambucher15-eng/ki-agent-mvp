# KI-Agent MVP

Ein einfacher Website-Agent: Chat-Oberflaeche (Frontend) + Proxy-Funktion (Backend),
die ein bestehendes LLM (Claude) aufruft.

**Datengetrieben (wichtig):** Wissen + Persoenlichkeit jeder Firma stehen NICHT im
Code, sondern als Daten in `data/<firma>.json`. Der Code baut daraus den System-Prompt
(`netlify/functions/lib/baueSystemPrompt.js`). So bekommt jede neue Firma einen eigenen
Agenten, ohne den Code zu kopieren — und der Schritt zur verkaufbaren SaaS-Version
(Firmen-Login statt JSON-Datei) ist ein Anbau, kein Neubau.

## So startest du es lokal

1. **Voraussetzungen:** Node.js + Netlify CLI
   ```
   npm install -g netlify-cli
   ```
2. **API-Schluessel (T1):** auf console.anthropic.com holen.
3. Datei `.env.example` zu `.env` kopieren und den Schluessel eintragen.
4. Im Projektordner starten:
   ```
   netlify dev
   ```
   Das startet Frontend **und** Funktion zusammen (meist http://localhost:8888).
5. Im Browser oeffnen, eine Frage eingeben (z.B. "Wann habt ihr offen?").
6. **Andere Firma testen:** `?firma=nordlicht` an die URL haengen
   (z.B. `http://localhost:8888/?firma=nordlicht`). Standard ist `salbei`.

## Spaeter: ins Internet stellen (Deploy)
- Netlify-Konto erstellen, Projekt verbinden.
- Den Schluessel im Netlify-Dashboard als Umgebungsvariable `ANTHROPIC_API_KEY` setzen
  (NICHT die `.env` hochladen).

## Dateien
- `public/index.html` — Chat-Oberflaeche (T4/T5/T6), schickt `firmaId` mit
- `netlify/functions/chat.js` — Proxy-Funktion (T2): laedt Firma, baut Prompt, ruft API
- `netlify/functions/lib/firmen.js` — Registry: welche Firmen gibt es? (spaeter: Datenbank)
- `netlify/functions/lib/baueSystemPrompt.js` — baut aus Firmen-Daten den System-Prompt
- `data/<firma>.json` — Wissen + Persoenlichkeit je Firma (hier die Infos pflegen)
- `netlify.toml` — sagt Netlify, wo Seite/Funktion liegen + dass `data/` mit hochgeht

## Neue Firma hinzufuegen
1. `data/meinefirma.json` anlegen (eine bestehende Datei als Vorlage kopieren).
2. In `netlify/functions/lib/firmen.js` zwei Zeilen ergaenzen
   (`require` + Eintrag im `firmen`-Objekt).
3. Mit `?firma=meinefirma` testen.

## Anpassen
- **Fakten & Charakter einer Firma:** `data/<firma>.json`
- **Verhalten/Ton fuer ALLE Firmen:** `baueSystemPrompt.js`
- **Modell:** `claude-haiku-4-5-20251001` (guenstig) -> `claude-sonnet-4-6` (besser)
- **Design:** kommt spaeter (T7) — Charakter-Avatar + Reaktionen
