-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Pläne — free / start / grow / scale (EINMALIG)
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- Wozu:
--  Die Preisseite kennt seit dem Umbau vier Pläne: Free, Start, Grow, Scale.
--  Die Datenbank kannte bisher nur basis / plus / enterprise. Solange das so
--  ist, kann niemand tatsächlich auf Grow oder Scale landen — die Seite böte
--  etwas an, das im System nicht existiert.
--
-- Zuordnung der bestehenden Zeilen (vorher nachgesehen, nicht geraten):
--  Kein einziger Datensatz hat eine Stripe-Kunden-ID. Es zahlt also niemand,
--  und die Einstufung ist entsprechend risikoarm.
--    basis (10 Zeilen) -> free   Sie haben nie bezahlt; free ist die
--                                ehrliche Einstufung, nicht start.
--    plus  (3 Zeilen)  -> grow   Bewusst auf Vollausstattung gesetzt.
--                                grow ist deren Entsprechung.
--
-- Warum die ALTEN Werte erlaubt bleiben:
--  stripe-webhook.js schreibt weiterhin 'basis' bzw. 'plus' (lib/stripe.js,
--  abo-checkout.js). Würde der Check sie verbieten, schlüge die nächste
--  Zahlung fehl — und zwar an einer Stelle, an der es niemand sofort merkt.
--  Die alten Werte fallen erst weg, wenn der Stripe-Teil umgestellt ist.
--
-- Neuer Vorgabewert: 'free'.
--  Bisher war es 'basis'. In der neuen Ordnung ist basis/start ein BEZAHLTER
--  Plan — eine neue Anmeldung landete also stillschweigend in einem Tarif,
--  für den nie jemand zugestimmt hat.
-- ═══════════════════════════════════════════════════════════════

-- 1) ERST den Check weiten, sonst scheitert das Umschreiben unten daran.
--
-- Der Name ist NACHGESEHEN, nicht geraten: In dieser Datenbank heisst die
-- Bedingung "firmen_plan_gueltig" (aus migration-m1.sql), nicht wie sonst
-- ueblich "firmen_plan_check". Mit dem falschen Namen haette das drop nichts
-- entfernt und der update darunter waere an der alten Regel gescheitert.
-- Beide Namen werden abgeraeumt, damit es auch in einer aelteren Datenbank
-- laeuft, in der die Bedingung noch den Standardnamen traegt.
alter table firmen drop constraint if exists firmen_plan_gueltig;
alter table firmen drop constraint if exists firmen_plan_check;
alter table firmen add constraint firmen_plan_gueltig
  check (plan in ('free','start','grow','scale','basis','plus','enterprise'));

-- 2) Bestehende Zeilen umschreiben.
update firmen set plan = 'free' where plan = 'basis';
update firmen set plan = 'grow' where plan = 'plus';
update firmen set plan = 'scale' where plan = 'enterprise';

-- 3) Vorgabewert auf free. Neue Anmeldungen sind ab jetzt kostenlos, bis
--    jemand aktiv zahlt.
alter table firmen alter column plan set default 'free';

-- Prüfen (erwartet: nur noch free/grow/scale, Vorgabewert 'free'):
--   select plan, count(*) from firmen group by plan order by plan;
--   select column_default from information_schema.columns
--    where table_name = 'firmen' and column_name = 'plan';
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'firmen_plan_gueltig';
