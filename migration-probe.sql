-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Probefahrt — drei Gratis-Fragen auf der eigenen Seite (EINMALIG)
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- Wozu das gebraucht wird:
--  public/probe.html lässt jeden Besucher seine eigene Webseite scannen und
--  dem Agenten danach DREI Fragen stellen. Jede dieser Fragen kostet einen
--  Claude-Aufruf. Ein Zähler im Browser wäre in zwei Sekunden umgangen — der
--  Zähler muss auf dem Server sitzen, und zwar so, dass auch drei gleichzeitig
--  abgeschickte Anfragen zusammen nur drei Fragen ergeben.
--
-- Was diese Migration anlegt:
--  1) scan_jobs.probe   — markiert einen Job als Probefahrt. Nur solche Jobs
--                         dürfen überhaupt als Gesprächsgrundlage dienen; ein
--                         Onboarding-Scan bleibt für den Chat unerreichbar.
--  2) scan_jobs.fragen  — wie viele Fragen dieser Job schon verbraucht hat.
--  3) probe_frage_zaehlen() — zählt hoch UND prüft die Grenze in EINER
--                         UPDATE-Anweisung. Ein Read-Modify-Write aus der
--                         Function heraus wäre nicht atomar: Drei parallele
--                         Anfragen läsen alle dieselbe 0 und kämen alle durch.
-- ═══════════════════════════════════════════════════════════════

alter table scan_jobs add column if not exists probe  boolean not null default false;
alter table scan_jobs add column if not exists fragen integer not null default 0;

-- Zählt eine Frage für einen Probefahrt-Job und gibt den neuen Stand zurück.
-- Gibt -1 zurück, wenn die Frage NICHT gewährt wird — also wenn der Job nicht
-- existiert, keine Probefahrt ist, noch nicht fertig gescannt wurde oder das
-- Kontingent bereits aufgebraucht ist. Der Aufrufer muss nur auf < 0 prüfen.
--
-- security definer, weil scan_jobs seit Milestone 0 keine Policies mehr hat und
-- ausschliesslich dem Server gehört. Die Function läuft deshalb mit den Rechten
-- ihres Eigentümers; ausführen darf sie unten trotzdem nur der Service-Key.
create or replace function probe_frage_zaehlen(job_id text, grenze integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  neu integer;
begin
  update scan_jobs
     set fragen = fragen + 1
   where id = job_id
     and probe = true
     and status = 'done'
     and fragen < grenze
  returning fragen into neu;

  return coalesce(neu, -1);
end;
$$;

-- Niemand ausser dem Server darf mitzählen: Der öffentliche anon-Key käme sonst
-- an eine security-definer-Function, die scan_jobs schreibt.
revoke all on function probe_frage_zaehlen(text, integer) from public;
revoke all on function probe_frage_zaehlen(text, integer) from anon;
revoke all on function probe_frage_zaehlen(text, integer) from authenticated;
grant execute on function probe_frage_zaehlen(text, integer) to service_role;

-- Prüfen (erwartet: probe/fragen vorhanden, Function existiert):
--   select column_name from information_schema.columns
--    where table_name = 'scan_jobs' and column_name in ('probe','fragen');
--   select proname from pg_proc where proname = 'probe_frage_zaehlen';
