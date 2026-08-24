-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Ein Abo = ein Agent
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
-- Setzt migration-abo.sql voraus (Tabelle abos + die beiden Trigger).
--
-- Warum:
--  migration-abo.sql hängt den Plan an den NUTZER. Dabei kam heraus, dass ein
--  Konto fünf Firmen besitzt — und alle fünf bekamen denselben bezahlten Plan.
--  Da der Verbrauchszähler je FIRMA zählt (migration-verbrauch.sql), wären das
--  fünfmal das Kontingent zum Preis von einem. Genau der Kostenschutz aus
--  netlify/functions/lib/verbrauch.js wäre damit unterlaufen.
--
--  Ab jetzt trägt genau EINE Firma je Konto das Abo. Alle weiteren Firmen
--  desselben Nutzers bleiben auf 'free'.
--
-- Wie die Bindung entsteht:
--  Der Kunde bezahlt, bevor es eine Firma gibt. abos.firma ist deshalb
--  zunächst leer und wird von der ERSTEN Firma beansprucht, die der Nutzer
--  danach anlegt. Wer schon Firmen hat und später kauft, bindet die zuletzt
--  erstellte.
--
--  Umhängen geht jederzeit über abo_firma_setzen() — ohne das säße ein Kunde
--  fest, der seinen Agenten neu aufsetzt.
--
-- Warum die Bindung NICHT im BEFORE-Trigger auf firmen passiert:
--  Ein BEFORE-Trigger, der von dort aus in abos schreibt, während gerade ein
--  abos-Trigger läuft, kann dieselbe Zeile zweimal im selben Kommando ändern
--  ("tuple to be updated was already modified"). Deshalb ist die Arbeit
--  aufgeteilt: BEFORE liest nur, geschrieben wird ausschliesslich in
--  AFTER-Triggern.
-- ═══════════════════════════════════════════════════════════════

-- 1) Welche Firma trägt das Abo. Leer = noch keine.
alter table abos add column if not exists firma text;

-- 2) Der Plan-Trigger auf firmen: NUR LESEN, kein Schreibvorgang.
--
--    Vier Fälle, und drei davon enden bei 'free':
--      kein Abo            -> free
--      Abo noch ungebunden -> free (der AFTER-Trigger unten bindet gleich und
--                                   zieht den Wert dann nach)
--      diese Firma gebunden-> der bezahlte Plan
--      andere Firma        -> free (das ist der Kern dieser Migration)
create or replace function firma_plan_aus_abo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bezahlt  text;
  gebunden text;
begin
  select plan, firma into bezahlt, gebunden from abos where nutzer = new.besitzer;

  if bezahlt is null or bezahlt = 'free' then
    new.plan := 'free';
  elsif gebunden is null then
    new.plan := 'free';
  elsif gebunden = new.id then
    new.plan := bezahlt;
  else
    new.plan := 'free';
  end if;

  return new;
end;
$$;

-- 3) Die erste Firma nach der Zahlung beansprucht das Abo.
--
--    Nur bei einem BEZAHLTEN Plan: Bei 'free' gibt es nichts zu binden, und
--    eine voreilige Bindung würde später die falsche Firma bevorzugen.
--
--    Kein eigenes "update firmen" nötig: Das Schreiben in abos löst den
--    Spiegel-Trigger (5) aus, und der zieht alle Firmen des Nutzers nach —
--    auch die gerade eingefügte.
create or replace function abo_firma_beanspruchen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update abos
     set firma = new.id, aktualisiert = now()
   where nutzer = new.besitzer
     and firma is null
     and plan <> 'free';
  return null;   -- AFTER-Trigger: Rückgabewert wird verworfen
end;
$$;

drop trigger if exists firmen_abo_beanspruchen on firmen;
create trigger firmen_abo_beanspruchen
  after insert on firmen
  for each row execute function abo_firma_beanspruchen();

-- 4) Kauft jemand, der schon Firmen hat: die zuletzt erstellte bindet.
--
--    BEFORE-Trigger auf abos, damit nur "new" verändert wird und kein zweiter
--    Schreibvorgang auf dieselbe Zeile entsteht.
--
--    Bei einer Kündigung (plan -> free) wird firma NICHT geleert: Kauft der
--    Kunde später wieder, soll derselbe Agent weiterlaufen und nicht ein
--    beliebiger anderer.
create or replace function abo_firma_binden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan <> 'free' and new.firma is null then
    select id into new.firma
      from firmen
     where besitzer = new.nutzer
     order by erstellt desc nulls last, id
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists abos_firma_binden on abos;
create trigger abos_firma_binden
  before insert or update on abos
  for each row execute function abo_firma_binden();

-- 5) Spiegel: Ändert sich am Abo etwas, werden ALLE Firmen des Nutzers
--    geradegezogen. "set plan = plan" sieht sinnlos aus, ist aber Absicht:
--    Der BEFORE-Trigger (2) entscheidet für jede Zeile neu, ob sie das Abo
--    trägt. So fällt die alte Firma beim Umhängen automatisch auf free.
create or replace function abo_auf_firmen_spiegeln()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update firmen set plan = plan where besitzer = new.nutzer;
  return new;
end;
$$;

drop trigger if exists abos_auf_firmen on abos;
create trigger abos_auf_firmen
  after insert or update of plan, firma on abos
  for each row execute function abo_auf_firmen_spiegeln();

-- 6) Das Abo auf einen anderen eigenen Agenten umhängen.
--
--    Als Datenbank-Function und nicht als Netlify-Endpunkt, weil die
--    Besitzprüfung damit an der Identität hängt, die Postgres selbst aus dem
--    Clerk-JWT liest (auth.jwt() ->> 'sub'). Ein Server-Endpunkt müsste die
--    Nutzer-ID vom Browser entgegennehmen — und wer eine fremde ID mitschickt,
--    könnte damit ein fremdes Abo auf eine tote Firma umhängen. Das wäre echte
--    Sabotage, anders als beim Checkout, wo ein Falscheintrag nur eigenes Geld
--    verschenkt.
--
--    Dasselbe Muster wie antworten_stand_lesen() in migration-verbrauch.sql:
--    security definer, aber die Prüfung steht IN der Function.
create or replace function abo_firma_setzen(firma_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ich text := auth.jwt() ->> 'sub';
  treffer int;
begin
  if ich is null then return 'nicht angemeldet'; end if;

  select count(*) into treffer from firmen where id = firma_id and besitzer = ich;
  if treffer = 0 then return 'gehoert dir nicht'; end if;

  update abos set firma = firma_id, aktualisiert = now() where nutzer = ich;
  if not found then return 'kein abo'; end if;

  return 'ok';
end;
$$;

revoke all on function abo_firma_setzen(text) from public;
revoke all on function abo_firma_setzen(text) from anon;
grant execute on function abo_firma_setzen(text) to authenticated;
grant execute on function abo_firma_setzen(text) to service_role;

-- 7) Bestehende Abos an eine Firma binden: die zuletzt erstellte je Konto.
--
--    Welche der fünf Firmen des einen Kontos ursprünglich bezahlt war, lässt
--    sich nicht mehr rekonstruieren — migration-plaene.sql hat die alten Werte
--    überschrieben. Das ist unkritisch: Es sind durchweg Testdatensätze
--    (M10 Test Plus, M4 Lead Test, Gate Test …) und kein einziger Stripe-Kunde.
--    Umhängen geht mit abo_firma_setzen() jederzeit.
update abos a
   set firma = (select f.id from firmen f
                 where f.besitzer = a.nutzer
                 order by f.erstellt desc nulls last, f.id
                 limit 1)
 where a.firma is null
   and a.plan <> 'free';

-- 8) Alle Firmen geradeziehen. Ab hier gilt: je Konto höchstens ein Agent
--    mit bezahltem Plan.
update firmen set plan = plan;

-- Prüfen:
--   select nutzer, plan, firma from abos order by plan;
--   select plan, count(*) from firmen group by plan;
--   -- Kein Konto darf mehr als EINE Firma mit bezahltem Plan haben:
--   select besitzer, count(*) from firmen
--    where plan <> 'free' and besitzer is not null
--    group by besitzer having count(*) > 1;
