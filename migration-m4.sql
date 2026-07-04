-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Milestone 4 — Agent Platform (EINMALIG ausführen)
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- Zwei neue Tabellen, beide vom Server (Service-Key) geschrieben und
-- NUR vom Firmen-Besitzer lesbar:
--   1) gespraeche       — was Besucher gefragt haben (Analytics + Verkaufsargument)
--   2) kontaktanfragen  — Leads, die der Agent per Tool "kontakt_hinterlassen"
--                         aufnimmt (der Chatbot-zu-Agent-Moment)
--
-- DATENSCHUTZ: gespraeche speichert Besucher-Eingaben. Kein IP, kein Name.
-- Für Produktion braucht es einen AVV + Löschkonzept (DSGVO) — für den
-- MVP ist das Loggen bewusst datensparsam (nur Frage/Antwort + Seite).
-- ═══════════════════════════════════════════════════════════════

-- 1) gespraeche
create table if not exists gespraeche (
  id        bigint generated always as identity primary key,
  firma_id  text not null,
  frage     text not null,
  antwort   text,
  seite     text,                        -- welche Unterseite (Pfad), falls bekannt
  erstellt  timestamptz not null default now()
);
create index if not exists gespraeche_firma_idx on gespraeche (firma_id, erstellt desc);

alter table gespraeche enable row level security;

-- Nur der Besitzer der Firma darf die Gespräche lesen (join über firmen.besitzer).
-- Geschrieben wird ausschliesslich vom Server (Service-Key umgeht RLS).
drop policy if exists "gespraeche lesen (Besitzer)" on gespraeche;
create policy "gespraeche lesen (Besitzer)" on gespraeche for select using (
  exists (select 1 from firmen f where f.id = gespraeche.firma_id and f.besitzer = auth.uid())
);

-- 2) kontaktanfragen (Leads)
create table if not exists kontaktanfragen (
  id        bigint generated always as identity primary key,
  firma_id  text not null,
  name      text,
  kontakt   text,                        -- E-Mail oder Telefon, wie der Besucher es angibt
  nachricht text not null,
  erledigt  boolean not null default false,
  erstellt  timestamptz not null default now()
);
create index if not exists kontaktanfragen_firma_idx on kontaktanfragen (firma_id, erstellt desc);

alter table kontaktanfragen enable row level security;

-- Besitzer darf lesen UND als erledigt markieren (update). Schreiben (insert)
-- macht der Server via Service-Key.
drop policy if exists "kontaktanfragen lesen (Besitzer)"  on kontaktanfragen;
drop policy if exists "kontaktanfragen aendern (Besitzer)" on kontaktanfragen;
create policy "kontaktanfragen lesen (Besitzer)" on kontaktanfragen for select using (
  exists (select 1 from firmen f where f.id = kontaktanfragen.firma_id and f.besitzer = auth.uid())
);
create policy "kontaktanfragen aendern (Besitzer)" on kontaktanfragen for update using (
  exists (select 1 from firmen f where f.id = kontaktanfragen.firma_id and f.besitzer = auth.uid())
);

-- KONTROLLE:
-- select tablename, policyname, cmd from pg_policies
--   where tablename in ('gespraeche','kontaktanfragen');
