-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Milestone 0 — Lese-Isolation (EINMALIG ausführen)
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- VORHER in Netlify/.env eintragen: SUPABASE_SERVICE_KEY
-- (Supabase -> Project Settings -> API -> "service_role" -- GEHEIM,
--  nur als Server-Umgebungsvariable, NIEMALS ins Frontend/Git!)
--
-- Was diese Migration ändert und warum:
--  1) firmen: Bisher durfte JEDER die komplette daten-Spalte lesen —
--     inklusive E-Mail des Besitzers und internem Wissen. Ab jetzt
--     liest der Browser nur noch die eigene Firma (Besitzer); Besucher
--     bekommen Firmendaten ausschliesslich über die gefilterte
--     /firma-Function (die läuft mit dem Service-Key).
--  2) scan_jobs: Bisher offene Policies (jeder konnte Jobs anlegen/
--     überschreiben). Ab jetzt schreibt/liest nur noch der Server
--     (Service-Key umgeht RLS; keine Policies = anon komplett gesperrt).
-- ═══════════════════════════════════════════════════════════════

-- 1) firmen: öffentliche Lese-Policy ersetzen durch Besitzer-Lese-Policy
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where tablename = 'firmen' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on firmen', p.policyname);
  end loop;
end $$;

create policy "firmen lesen (nur Besitzer)" on firmen
  for select using (auth.uid() = besitzer);

-- 2) scan_jobs: alle offenen Policies entfernen (nur noch Server via Service-Key)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where tablename = 'scan_jobs'
  loop
    execute format('drop policy %I on scan_jobs', p.policyname);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- KONTROLLE (danach ausführen — erwartet:
--   firmen: 3 Zeilen (lesen nur Besitzer / anlegen / aendern),
--   scan_jobs: 0 Zeilen)
-- ═══════════════════════════════════════════════════════════════
-- select tablename, policyname, cmd, qual, with_check
--   from pg_policies where tablename in ('firmen','scan_jobs');
