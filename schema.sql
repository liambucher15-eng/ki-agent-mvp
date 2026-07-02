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

-- ────────────────────────────────────────────────────────────────
-- 3) rate_limits — Rate-Limiting für die öffentlichen Functions (Milestone 1)
-- ────────────────────────────────────────────────────────────────
create table if not exists rate_limits (
  schluessel    text primary key,        -- z.B. "chat:<ip>"
  anzahl        int not null default 0,
  fenster_ende  timestamptz not null
);

-- Tabelle bleibt komplett gesperrt (RLS an, keine Policies). Nur die Funktion
-- unten (SECURITY DEFINER) darf schreiben -> niemand kann die Zähler manipulieren.
alter table rate_limits enable row level security;

-- Atomar: zählt einen Treffer und sagt, ob er noch im Limit liegt.
-- Gibt true zurück, wenn erlaubt; false, wenn das Limit im Zeitfenster erreicht ist.
create or replace function rate_hit(p_key text, p_limit int, p_fenster int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    timestamptz := now();
  v_anzahl int;
begin
  insert into rate_limits (schluessel, anzahl, fenster_ende)
    values (p_key, 1, v_now + make_interval(secs => p_fenster))
  on conflict (schluessel) do update set
    anzahl = case when rate_limits.fenster_ende < v_now then 1 else rate_limits.anzahl + 1 end,
    fenster_ende = case when rate_limits.fenster_ende < v_now then v_now + make_interval(secs => p_fenster) else rate_limits.fenster_ende end
  returning anzahl into v_anzahl;
  return v_anzahl <= p_limit;
end;
$$;

-- Der öffentliche anon-Key darf die Funktion aufrufen (aber nicht die Tabelle).
grant execute on function rate_hit(text, int, int) to anon;
