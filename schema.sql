-- Supabase-Schema für den KI-Agenten.
-- EINMALIG ausführen: Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- Enthält zwei Tabellen:
--   1) scan_jobs  — Zwischenspeicher für den Background-Webseiten-Scan
--   2) firmen     — die gespeicherten Agenten (wird beim Onboarding-Abschluss geschrieben)

-- ────────────────────────────────────────────────────────────────
-- 1) scan_jobs — Job-Speicher für den Background-Scan
-- ────────────────────────────────────────────────────────────────
create table if not exists scan_jobs (
  id        text primary key,           -- die jobId (UUID vom Browser erzeugt)
  status    text not null default 'running',  -- running | done | error
  ergebnis  jsonb,                       -- das fertige Scan-Ergebnis (bei done)
  fehler    text,                        -- Fehlertext (bei error)
  erstellt  timestamptz not null default now()
);

alter table scan_jobs enable row level security;

-- Jobs sind kurzlebig und nicht sensibel (nur Scans öffentlicher Webseiten),
-- die id ist eine nicht erratbare UUID -> offene Policies sind hier vertretbar.
drop policy if exists "scan_jobs lesen"   on scan_jobs;
drop policy if exists "scan_jobs anlegen" on scan_jobs;
drop policy if exists "scan_jobs aendern" on scan_jobs;
create policy "scan_jobs lesen"   on scan_jobs for select using (true);
create policy "scan_jobs anlegen" on scan_jobs for insert with check (true);
create policy "scan_jobs aendern" on scan_jobs for update using (true);

-- ────────────────────────────────────────────────────────────────
-- 2) firmen — gespeicherte Agenten (Onboarding-Abschluss + Widget lesen)
-- ────────────────────────────────────────────────────────────────
create table if not exists firmen (
  id        text primary key,           -- Firmen-/Agenten-Kennung (Slug)
  name      text,
  besitzer  uuid,                        -- später: auth.uid() des Erstellers
  daten     jsonb not null,              -- komplettes Firmen-Objekt (persona, fakten, faq, wissen, charakter)
  erstellt  timestamptz not null default now()
);

alter table firmen enable row level security;

-- Öffentlich lesbar, damit das Chat-Widget für alle Besucher funktioniert.
drop policy if exists "firmen lesen" on firmen;
create policy "firmen lesen" on firmen for select using (true);

-- ACHTUNG (nur zum Testen offen!): aktuell darf jeder schreiben.
-- VOR echten Kunden ersetzen durch: with check (auth.uid() = besitzer)
-- und beim Speichern besitzer = auth.uid() setzen (siehe Audit-Punkt F4).
drop policy if exists "firmen anlegen" on firmen;
drop policy if exists "firmen aendern" on firmen;
create policy "firmen anlegen" on firmen for insert with check (true);
create policy "firmen aendern" on firmen for update using (true);
