-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Verbrauch — Antworten je Firma und Monat zählen (EINMALIG)
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- Wozu das gebraucht wird:
--  Jede Antwort des Agenten kostet einen Claude-Aufruf. Bisher gab es KEINE
--  Grenze je Firma — nur ein Rate-Limit pro IP-Adresse (chat.js), und das
--  bremst einen einzelnen Angreifer, nicht eine Firma mit sehr viel Verkehr.
--  Ein einziger Kunde, der versehentlich viral geht, konnte damit mehr kosten
--  als er zahlt.
--
-- Warum hier NICHT blockiert wird (anders als bei probe_frage_zaehlen):
--  Der Zähler zählt nur und gibt den Stand zurück. Was bei Überschreitung
--  passiert, entscheidet chat.js — und zwar gestuft: erst gar nichts, dann
--  knappere Antworten, erst ganz zuletzt Nachrichtenaufnahme. Eine harte
--  Sperre in SQL könnte das nicht; sie kennt nur ja oder nein.
--  Der Besucher der Kundenseite hat nichts falsch gemacht und darf nie vor
--  einem kaputten Agenten sitzen.
--
-- Der Monatswechsel passiert im Zähler selbst: Liegt der gespeicherte Stand
-- in einem früheren Monat, wird auf 0 zurückgesetzt. Kein Cron-Job nötig,
-- der vergessen werden oder ausfallen könnte.
-- ═══════════════════════════════════════════════════════════════

alter table firmen add column if not exists antworten       integer not null default 0;
alter table firmen add column if not exists antworten_stand date;

-- Zählt eine Antwort für eine Firma und gibt den NEUEN Monatsstand zurück.
-- Gibt -1 zurück, wenn es die Firma nicht gibt — der Aufrufer muss nur auf
-- < 0 prüfen und zählt dann eben nicht mit (statt den Chat abzubrechen).
--
-- security definer, weil firmen seit Milestone 0 nur dem Besitzer gehört und
-- der Chat serverseitig für FREMDE Besucher läuft. Ausführen darf sie unten
-- trotzdem nur der Service-Key.
create or replace function antwort_zaehlen(firma_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  neu integer;
  monatsanfang date := date_trunc('month', now())::date;
begin
  update firmen
     set antworten = case
           -- Neuer Monat (oder noch nie gezählt): bei 1 anfangen.
           when antworten_stand is null or antworten_stand < monatsanfang then 1
           else antworten + 1
         end,
         antworten_stand = monatsanfang
   where id = firma_id
  returning antworten into neu;

  return coalesce(neu, -1);
end;
$$;

-- Nur den Stand lesen, ohne hochzuzählen — fürs Dashboard.
-- Gibt 0 zurück, wenn der gespeicherte Stand aus einem früheren Monat ist:
-- Dann ist der Zähler faktisch zurückgesetzt, auch wenn die Spalte noch die
-- alte Zahl trägt (geschrieben wird sie erst bei der nächsten Antwort).
--
-- WICHTIG — die Besitzprüfung steht IN der Function, nicht daneben:
--  security definer umgeht Row Level Security. Ohne die Zeile "and besitzer =
--  auth.jwt() ->> 'sub'" könnte jeder angemeldete Nutzer den Verbrauch JEDER
--  fremden Firma abfragen, indem er einfach eine andere ID mitschickt. Die
--  Bedingung ist dieselbe wie in der Lese-Policy der Tabelle (Migration m9,
--  Clerk-User-ID als Text).
--  Der Service-Key hat kein JWT und käme damit nicht durch — er braucht diese
--  Function aber auch nicht, er liest die Spalte direkt.
create or replace function antworten_stand_lesen(firma_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  wert integer;
  stand date;
  monatsanfang date := date_trunc('month', now())::date;
begin
  select antworten, antworten_stand into wert, stand
    from firmen
   where id = firma_id
     and besitzer = auth.jwt() ->> 'sub';
  if wert is null then return -1; end if;   -- gibt es nicht ODER gehört mir nicht
  if stand is null or stand < monatsanfang then return 0; end if;
  return wert;
end;
$$;

-- Niemand ausser dem Server darf zählen: Der öffentliche anon-Key käme sonst
-- an eine security-definer-Function, die firmen schreibt.
revoke all on function antwort_zaehlen(text) from public;
revoke all on function antwort_zaehlen(text) from anon;
revoke all on function antwort_zaehlen(text) from authenticated;
grant execute on function antwort_zaehlen(text) to service_role;

-- Lesen darf auch der angemeldete Besitzer — das Dashboard zeigt den Stand.
-- Die Function gibt nur eine Zahl zurück, keine fremden Daten; und wer die
-- firma_id kennt, sieht ohnehin nur seinen eigenen Verbrauch.
revoke all on function antworten_stand_lesen(text) from public;
revoke all on function antworten_stand_lesen(text) from anon;
grant execute on function antworten_stand_lesen(text) to authenticated;
grant execute on function antworten_stand_lesen(text) to service_role;

-- Prüfen (erwartet: beide Spalten vorhanden, beide Functions existieren):
--   select column_name from information_schema.columns
--    where table_name = 'firmen' and column_name in ('antworten','antworten_stand');
--   select proname from pg_proc
--    where proname in ('antwort_zaehlen','antworten_stand_lesen');
