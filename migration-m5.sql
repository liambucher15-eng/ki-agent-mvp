-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Milestone 5 — SaaS / Stripe (EINMALIG ausführen)
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- Macht den PLAN zur Server-Wahrheit:
--   1) Spalte stripe_kunde (mappt Stripe-Kunde -> Firma für Kündigungs-Webhooks)
--   2) plan wird für anon/authenticated GESPERRT — nur noch der Server
--      (Service-Key, Stripe-Webhook) darf ihn setzen. Damit kann sich niemand
--      selbst "plus" schalten. store.js schreibt die Spalte nicht mehr.
--
-- VORAUSSETZUNG: migration-m1.sql (plan-Spalte) ist schon gelaufen, und der
-- Stripe-Webhook läuft mit dem Service-Key.
-- ═══════════════════════════════════════════════════════════════

alter table firmen add column if not exists stripe_kunde text;

-- Plan server-exklusiv machen. GRANT/REVOKE wirken spaltenweise; der Service-Key
-- (role service_role) ist davon nicht betroffen und darf weiter schreiben.
revoke insert (plan) on firmen from anon, authenticated;
revoke update (plan) on firmen from anon, authenticated;

-- KONTROLLE (erwartet: plan NICHT in der Liste der beschreibbaren Spalten für
-- authenticated):
-- select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_name = 'firmen' and grantee in ('anon','authenticated')
--   order by grantee, column_name;
