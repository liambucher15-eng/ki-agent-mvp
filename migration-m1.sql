-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Milestone 1 — Bilder in Storage + plan-Spalte
-- (EINMALIG ausführen: Supabase-Dashboard -> SQL Editor -> Run)
--
-- Was diese Migration ändert und warum:
--  1) Storage-Bucket "charaktere": Charakterbilder liegen künftig als
--     Dateien mit öffentlicher URL — nicht mehr als Base64 im daten-JSONB
--     (bis ~24 MB pro Firma; jeder Widget-Load hätte das mitgeladen).
--  2) firmen.plan als eigene Spalte: Vorbereitung fürs Abo (Stripe).
--     Der Server liest den Plan aus der Spalte; solange die Simulation
--     läuft, darf der Besitzer sie noch selbst setzen. Der auskommentierte
--     REVOKE-Block unten macht den Plan später Server-exklusiv.
--  3) Größenlimit auf daten: Ohne Bilder muss eine Firma klein sein
--     (< 200 KB) — verhindert Missbrauch als Freispeicher / Riesen-Prompts.
-- ═══════════════════════════════════════════════════════════════

-- 1) Storage-Bucket für Charakterbilder (öffentlich lesbar, max 5 MB/Datei)
insert into storage.buckets (id, name, public, file_size_limit)
  values ('charaktere', 'charaktere', true, 5242880)
  on conflict (id) do update set public = true, file_size_limit = 5242880;

-- Hochladen/Ersetzen nur im eigenen Ordner (Pfad beginnt mit der eigenen
-- Nutzer-ID) — niemand kann die Bilder einer fremden Firma überschreiben.
drop policy if exists "charaktere lesen"     on storage.objects;
drop policy if exists "charaktere hochladen" on storage.objects;
drop policy if exists "charaktere ersetzen"  on storage.objects;
-- SELECT braucht es auch für upsert-Uploads (intern insert-or-update);
-- öffentlich ausgeliefert wird sowieso über die public-URL des Buckets.
create policy "charaktere lesen" on storage.objects for select to authenticated
  using (bucket_id = 'charaktere');
create policy "charaktere hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'charaktere' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "charaktere ersetzen" on storage.objects for update to authenticated
  using (bucket_id = 'charaktere' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'charaktere' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2) plan als eigene Spalte + vorhandene Werte aus daten übernehmen
alter table firmen add column if not exists plan text not null default 'basis';
update firmen set plan = daten->>'plan'
  where daten->>'plan' in ('basis', 'plus') and plan = 'basis';

-- Nur bekannte Werte zulassen
alter table firmen drop constraint if exists firmen_plan_gueltig;
alter table firmen add constraint firmen_plan_gueltig
  check (plan in ('basis', 'plus', 'enterprise'));

-- 3) Größenlimit auf daten (greift für neue Schreibvorgänge; Alt-Zeilen mit
--    Base64-Bildern bleiben lesbar, lassen sich aber erst nach Bereinigung
--    wieder speichern — gewollt).
alter table firmen drop constraint if exists firmen_daten_klein;
alter table firmen add constraint firmen_daten_klein
  check (pg_column_size(daten) < 200000) not valid;

-- ═══════════════════════════════════════════════════════════════
-- SPÄTER (sobald Stripe da ist) — Plan wird Server-exklusiv:
-- Besitzer können ihren Plan dann NICHT mehr selbst setzen, nur noch
-- der Stripe-Webhook (Service-Key). Zum Aktivieren einkommentieren:
--
-- revoke insert (plan) on firmen from anon, authenticated;
-- revoke update (plan) on firmen from anon, authenticated;
-- ═══════════════════════════════════════════════════════════════

-- KONTROLLE:
-- select id, plan, pg_column_size(daten) as groesse from firmen;
-- select id, public, file_size_limit from storage.buckets where id = 'charaktere';
