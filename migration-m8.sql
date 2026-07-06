-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Milestone 8 — Seiten-Kontext & proaktive Fragen (EINMALIG)
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- EINE Tabelle: seiten_hinweise — der pro (Firma, Seite) einmal von der KI
-- generierte proaktive Eröffnungssatz („Sie schauen sich die Preise an —
-- soll ich helfen?"). GECACHT, damit die API-Kosten 1× pro Seite anfallen
-- und NICHT pro Besucher. Wird nur vom Server (Service-Key) geschrieben und
-- gelesen — der Besucher bekommt den Text über die /seiten-hinweis-Function.
-- ═══════════════════════════════════════════════════════════════

create table if not exists seiten_hinweise (
  firma_id  text not null,
  pfad      text not null,
  text      text not null,
  erstellt  timestamptz not null default now(),
  primary key (firma_id, pfad)
);

alter table seiten_hinweise enable row level security;
-- KEINE Policies: die Tabelle ist komplett server-exklusiv (wie scan_jobs).
-- Der anonyme/authentifizierte Client kommt nur über die Function heran.
