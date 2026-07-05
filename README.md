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
   **Update-Vertrag:** Kunden betten die Datei einmal ein — `widget.js` bleibt für
   immer rückwärtskompatibel (Details im Datei-Kopf); Breaking Changes bekämen
   eine neue Datei. Plus-Firmen zeigen statt des Orbs eine eigene Figur, die beim
   Chatten die Zustände (denken/sprechen/verlegen) mitmacht.
3. **Chat** (`public/index.html`, geteilte Logik in `public/lib/chat-ui.js`) — die
   Chat-Oberfläche; der Agent reagiert als Charakter (idle/denken/sprechen/verlegen).
4. **Dashboard** (`public/dashboard.html`) — Wissen pflegen: Quellen (Scan/Dokument/
   Notiz, je mit Stand) bearbeiten, löschen, ergänzen; Webseite **neu scannen** mit
   Alt/Neu-Vergleich vor der Übernahme. Wissen liegt als `wissensquellen[]` in den
   Firmen-Daten (`lib/baueSystemPrompt.js` baut daraus den Prompt-Block). Dazu:
   **Posteingang** (vom Agenten aufgenommene Kontaktanfragen) und **Gespräche**
   (was Besucher gefragt haben) — beides nur für den Besitzer sichtbar (RLS).

## Vom Chatbot zum Agenten (Fähigkeiten)
Ein Agent kann nicht nur antworten, sondern **handeln**. Fähigkeiten stehen
datengetrieben in `daten.faehigkeiten` (z.B. `["kontakt"]`); `lib/faehigkeiten.js`
macht daraus Claude-Tools, und `chat.js` führt sie in einem Tool-Loop aus.
Erste Fähigkeit: **`kontakt_hinterlassen`** — der Agent nimmt Kontaktdaten auf
(Lead-Capture) und legt sie in `kontaktanfragen` ab. Neue Fähigkeit = ein Eintrag
im Katalog + ein Handler, kein firmenspezifischer Code.

## Lokal starten
1. **Voraussetzungen:** Node.js + Netlify CLI (`npm install -g netlify-cli`)
2. `npm install`
3. `.env.example` → `.env` kopieren und ausfüllen:
   - `ANTHROPIC_API_KEY` (console.anthropic.com)
   - `SUPABASE_URL` + `SUPABASE_ANON_KEY` (Supabase → Project Settings → API)
   - `SUPABASE_SERVICE_KEY` (service_role — GEHEIM, nur serverseitig!)
   - `GEMINI_API_KEY` (aistudio.google.com — Charakter-Generierung, Milestone 6)
4. **Supabase einrichten:** `schema.sql` einmal im Supabase-SQL-Editor ausführen
   (legt `firmen`, `scan_jobs`, `rate_limits` + Storage-Bucket `charaktere` an)
   und **Anonymous sign-ins** aktivieren (Authentication → Providers).
   Bestehende Projekte: stattdessen `migration-m0.sql` + `migration-m1.sql`.
5. `netlify dev` starten (Frontend + Functions zusammen, meist http://localhost:8888).
6. Onboarding testen: `/onboarding-aura.html`. Chat einer Seed-Firma:
   `/?firma=salbei` (oder `?firma=nordlicht`). Widget-Demo: `/test-einbetten.html`.
7. Tests: `npm test` (Node-Testrunner, `test/*.test.js`).

## Abo / Bezahlung (Stripe, Milestone 5)
Der Plus-Plan (eigene Figur) wird über Stripe verkauft. Der **Plan ist Server-
Wahrheit**: nur der Stripe-Webhook setzt `firmen.plan` (Column-REVOKE in
`migration-m5.sql`), und `firma.js` liefert die Figur-Bilder nur bei `plan=plus`.
Einrichtung:
1. Stripe-Konto → ein wiederkehrendes Produkt/Preis anlegen (`price_...`).
2. `STRIPE_SECRET_KEY` + `STRIPE_PREIS_ID` als Netlify-Env setzen.
3. Webhook-Endpoint auf `https://DEINE-DOMAIN/.netlify/functions/stripe-webhook`
   zeigen lassen; Events `checkout.session.completed`,
   `customer.subscription.deleted`, `customer.subscription.updated` abonnieren;
   den Signing-Secret als `STRIPE_WEBHOOK_SECRET` setzen.
4. `migration-m5.sql` ausführen (sperrt `plan` für Kunden, legt `stripe_kunde` an).

Ohne diese Werte bleibt alles nutzbar — der Upgrade-Button meldet nur, dass die
Bezahlung noch nicht eingerichtet ist (Checkout gibt `501`).

## Deploy (Netlify)
- Netlify-Konto erstellen, Repo verbinden.
- Umgebungsvariablen im Netlify-Dashboard setzen (NICHT die `.env` hochladen):
  `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
  und (für Bezahlung) `STRIPE_SECRET_KEY`, `STRIPE_PREIS_ID`, `STRIPE_WEBHOOK_SECRET`.
- **Migrationen** in Reihenfolge im Supabase-SQL-Editor ausführen: `schema.sql`
  (oder `migration-m0` → `m1` → `m4` → `m5` bei bestehendem Projekt).
- `SUPABASE_URL`/`SUPABASE_ANON_KEY` zusätzlich in `public/lib/supabase-config.js`
  eintragen (die liest das Frontend).
- Der Scan läuft als **Background-Function** (`scan-background.js`) — prüfen, dass
  der Netlify-Plan Background-Functions unterstützt.
- Nach dem Deploy: Widget-Demo unter `https://DEINE-DOMAIN/test-einbetten.html`.

## Wichtige Dateien
**Backend (`netlify/functions/`)**
- `chat.js` — Chat-Proxy: lädt Firma serverseitig, baut Prompt, ruft Claude
- `scan-background.js` / `scan-status.js` — Webseiten-Scan (Job + Polling)
- `charakter-background.js` — echte Charakter-Generierung + Einzelbild-Edit
  (Gemini, Milestone 6; nutzt dasselbe Job/Polling-Muster wie der Scan)
- `lib/gemini.js` / `lib/bilderSpeicher.js` — Gemini-Image-Client + Server-Upload
  der generierten Bilder in den Storage-Bucket
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
- **Missbrauchsschutz:** Rate-Limit pro IP (Supabase-RPC `rate_hit`) auf ALLEN
  öffentlichen Functions, Input-Limits, Origin-Prüfung, SSRF-Filter im Scan.
- **Besitzer-Schutz:** Ein Agent gehört seinem Ersteller (anonyme Auth →
  `besitzer = auth.uid()`); nur der Besitzer darf ihn lesen/überschreiben (RLS).
- **Lese-Isolation (Milestone 0):** Besucher/Widget sehen Firmendaten NUR über
  die gefilterte `/firma`-Function (keine E-Mail, kein internes Wissen); der
  Server liest mit dem Service-Key. `scan_jobs` ist komplett Server-exklusiv.
- **Kleine Daten (Milestone 1):** Charakterbilder liegen im Storage-Bucket
  `charaktere` (URLs), die `firmen.daten`-Zeile ist auf 200 KB begrenzt;
  `plan` ist eine eigene Spalte (Stripe-vorbereitet).

## Anpassen
- **Fakten/Charakter einer Seed-Firma:** `data/<firma>.json`
- **Ton/Verhalten für ALLE Firmen:** `lib/baueSystemPrompt.js`
- **Modell (eine Stelle für alle Functions):** `lib/claude.js`
