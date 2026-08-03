-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Milestone 9 — Clerk als Login statt Supabase Auth (EINMALIG)
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- VORAUSSETZUNG: In Supabase Authentication -> Sign In / Providers ->
-- Third Party Auth -> Clerk mit der Clerk-Domain eingetragen (siehe
-- CLERK-SETUP.md Schritt 3). Ohne das liefert auth.jwt() nichts.
--
-- Was diese Migration ändert und warum:
--  Bisher verglichen die Policies "besitzer" (Spaltentyp uuid) mit
--  Supabases eigenem auth.uid(). Seit dem Umstieg auf Clerk schreibt das
--  Frontend die Clerk-User-ID (Text wie "user_2abc...") in besitzer —
--  das ist KEIN gültiges uuid, jedes Speichern schlägt fehl. Ausserdem
--  liefert auth.uid() bei einem Fremd-Provider nichts Sinnvolles mehr;
--  die Clerk-User-ID steht stattdessen im Claim "sub" des JWT.
--  1) firmen.besitzer: uuid -> text, Policies auf auth.jwt()->>'sub'.
--  2) gespraeche/kontaktanfragen: Besitzer-Check (Join über firmen)
--     ebenfalls auf auth.jwt()->>'sub' umgestellt.
--  3) storage.objects (Bucket "charaktere"): Ordner-Präfix-Check
--     ebenfalls auf auth.jwt()->>'sub' umgestellt.
-- ═══════════════════════════════════════════════════════════════

-- 1) ERST ALLE Policies weg, die "firmen.besitzer" referenzieren — auch die von
-- gespraeche/kontaktanfragen (Join-Subquery zählt für Postgres als Abhängigkeit).
-- Erst danach lässt sich der Spaltentyp ändern.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where tablename = 'firmen'
  loop
    execute format('drop policy %I on firmen', p.policyname);
  end loop;
end $$;
drop policy if exists "gespraeche lesen (Besitzer)" on gespraeche;
drop policy if exists "kontaktanfragen lesen (Besitzer)"  on kontaktanfragen;
drop policy if exists "kontaktanfragen aendern (Besitzer)" on kontaktanfragen;

alter table firmen alter column besitzer type text using besitzer::text;

-- 2) firmen: neue Policies auf Basis der Clerk-User-ID
create policy "firmen lesen (nur Besitzer)" on firmen
  for select using (besitzer = auth.jwt() ->> 'sub');
create policy "firmen anlegen" on firmen
  for insert with check (besitzer = auth.jwt() ->> 'sub');
create policy "firmen aendern" on firmen
  for update using (besitzer = auth.jwt() ->> 'sub') with check (besitzer = auth.jwt() ->> 'sub');
-- Hinweis: das Column-Level-REVOKE auf "plan" aus migration-m5.sql bleibt von
-- diesen DROP/CREATE-Policies unberührt (Grants sind unabhängig von Policies).

-- 3) gespraeche: Besitzer-Check über den Join auf firmen.besitzer
create policy "gespraeche lesen (Besitzer)" on gespraeche for select using (
  exists (select 1 from firmen f where f.id = gespraeche.firma_id and f.besitzer = auth.jwt() ->> 'sub')
);

-- 4) kontaktanfragen: Besitzer-Check über den Join auf firmen.besitzer
create policy "kontaktanfragen lesen (Besitzer)" on kontaktanfragen for select using (
  exists (select 1 from firmen f where f.id = kontaktanfragen.firma_id and f.besitzer = auth.jwt() ->> 'sub')
);
create policy "kontaktanfragen aendern (Besitzer)" on kontaktanfragen for update using (
  exists (select 1 from firmen f where f.id = kontaktanfragen.firma_id and f.besitzer = auth.jwt() ->> 'sub')
);

-- 5) storage.objects (Bucket "charaktere"): Ordner-Präfix = eigene Clerk-User-ID
drop policy if exists "charaktere lesen"     on storage.objects;
drop policy if exists "charaktere hochladen" on storage.objects;
drop policy if exists "charaktere ersetzen"  on storage.objects;
create policy "charaktere lesen" on storage.objects for select to authenticated
  using (bucket_id = 'charaktere');
create policy "charaktere hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'charaktere' and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');
create policy "charaktere ersetzen" on storage.objects for update to authenticated
  using (bucket_id = 'charaktere' and (storage.foldername(name))[1] = auth.jwt() ->> 'sub')
  with check (bucket_id = 'charaktere' and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');

-- ═══════════════════════════════════════════════════════════════
-- KONTROLLE (danach ausführen — erwartet: besitzer-Spalte vom Typ text,
-- alle sechs Policies mit auth.jwt() ->> 'sub' statt auth.uid())
-- ═══════════════════════════════════════════════════════════════
-- select column_name, data_type from information_schema.columns
--   where table_name = 'firmen' and column_name = 'besitzer';
-- select tablename, policyname, cmd, qual, with_check from pg_policies
--   where tablename in ('firmen','gespraeche','kontaktanfragen')
--   or (tablename = 'objects' and policyname like 'charaktere%');
