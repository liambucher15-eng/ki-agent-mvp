# KI-Agent MVP

Ein Website-Chat-Agent als Web-SaaS: Eine Firma richtet über ein Onboarding
ihren eigenen Agenten ein (die KI liest dazu die Webseite aus), bindet ihn mit
**einer Zeile Code** auf ihrer Seite ein — und Besucher chatten mit einem Agenten,
der die Firma kennt.

**Datengetrieben (Kernidee):** Wissen + Persönlichkeit jeder Firma stehen NICHT im
Code, sondern als Daten (Seed-Firmen in `data/<firma>.json`, echte Firmen in der
Supabase-Tabelle `firmen`). Der gleiche Code baut daraus den System-Prompt
(`netlify/functions/lib/baueSystemPrompt.js`). Neue Firma = neue Daten, kein neuer Code.

## Die drei Teile
1. **Onboarding** (`public/onboarding-aura.html`) — Firma gibt ihre URL ein, die KI
   scannt die Seite (Text + Farben), füllt alles vor, die Firma prüft/ergänzt und
   speichert. Ergebnis: ein Eintrag in der `firmen`-Tabelle.
2. **Widget** (`public/widget.js` + `widget-frame.html`) — das Einbett-Script für
   fremde Seiten: `<script src=".../widget.js" data-firma="<id>"></script>`.
3. **Chat** (`public/index.html`, geteilte Logik in `public/lib/chat-ui.js`) — die
   Chat-Oberfläche; der Agent reagiert als Charakter (idle/denken/sprechen/verlegen).

## Lokal starten
1. **Voraussetzungen:** Node.js + Netlify CLI (`npm install -g netlify-cli`)
2. `npm install` (Abhängigkeiten fürs Backend, z.B. `@netlify/blobs`)
3. `.env.example` → `.env` kopieren und ausfüllen:
   - `ANTHROPIC_API_KEY` (console.anthropic.com)
   - `SUPABASE_URL` + `SUPABASE_ANON_KEY` (Supabase → Project Settings → API)
4. **Supabase einrichten:** `schema.sql` einmal im Supabase-SQL-Editor ausführen
   (legt `firmen`, `scan_jobs`, `rate_limits` an) und **Anonymous sign-ins**
   aktivieren (Authentication → Providers).
5. `netlify dev` starten (Frontend + Functions zusammen, meist http://localhost:8888).
6. Onboarding testen: `/onboarding-aura.html`. Chat einer Seed-Firma:
   `/?firma=salbei` (oder `?firma=nordlicht`).

## Deploy (Netlify)
- Netlify-Konto erstellen, Repo verbinden.
- `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` im Netlify-Dashboard als
  Umgebungsvariablen setzen (NICHT die `.env` hochladen).
- Der Scan läuft als **Background-Function** (`scan-background.js`) — prüfen, dass
  der Netlify-Plan Background-Functions unterstützt.

## Wichtige Dateien
**Backend (`netlify/functions/`)**
- `chat.js` — Chat-Proxy: lädt Firma serverseitig, baut Prompt, ruft Claude
- `scan-background.js` / `scan-status.js` — Webseiten-Scan (Job + Polling)
- `dokument-lesen.js` — liest hochgeladene Menükarten/PDFs via Claude Vision
- `firma.js` — öffentliche Firmen-Präsentation fürs Chatfenster
- `lib/webseiteScannen.js` — Scan-Logik (Fetch + Farben + Claude-Extraktion)
- `lib/sichererFetch.js` — SSRF-Schutz für den Scan
- `lib/schutz.js` — Rate-Limit, Origin-Prüfung, Input-Limits
- `lib/firmaLaden.js` — Firma serverseitig laden (Seed-JSON oder Supabase)
- `lib/baueSystemPrompt.js` — baut aus Firmen-Daten den System-Prompt

**Frontend (`public/`)** — Onboarding, Widget, Chat, `lib/store.js` (Supabase/localStorage),
`lib/auth.js` (anonyme Auth), `lib/chat-ui.js` (geteilte Chat-Logik).

**Daten:** `data/<firma>.json` (Seed-Firmen), `schema.sql` (DB-Schema).

## Sicherheit (Stand)
- **Missbrauchsschutz:** Rate-Limit pro IP (Supabase-RPC `rate_hit`), Input-Limits,
  Origin-Prüfung, SSRF-Filter im Scan.
- **Besitzer-Schutz:** Ein Agent gehört seinem Ersteller (anonyme Auth →
  `besitzer = auth.uid()`); nur der Besitzer darf ihn überschreiben (RLS). Lesen
  ist öffentlich, damit das Widget für alle funktioniert.

## Anpassen
- **Fakten/Charakter einer Seed-Firma:** `data/<firma>.json`
- **Ton/Verhalten für ALLE Firmen:** `lib/baueSystemPrompt.js`
- **Modell:** `claude-haiku-4-5-20251001` (günstig/schnell)
