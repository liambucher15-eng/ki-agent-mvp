-- ═══════════════════════════════════════════════════════════════
-- MIGRATION Abo — bezahlter Plan haengt am NUTZER, nicht an der Firma
-- Supabase-Dashboard -> SQL Editor -> einfügen -> "Run".
--
-- Das Problem:
--  Der gewünschte Weg ist: Preisseite -> Konto -> bezahlen -> Onboarding ->
--  Agent einrichten. Beim Bezahlen gibt es also noch KEINE Firma, der der
--  Stripe-Webhook einen Plan zuschreiben könnte. Heute verlangt
--  abo-checkout.js eine firmaId — das setzt die umgekehrte Reihenfolge voraus
--  (erst Onboarding, dann Abo aus dem Dashboard heraus).
--
-- Die Lösung:
--  Der bezahlte Plan wird am Clerk-Nutzer gespeichert. Legt derselbe Nutzer
--  später im Onboarding seine Firma an, übernimmt ein TRIGGER den Plan.
--
-- Warum ein Trigger und kein Server-Endpunkt:
--  store.js schreibt die Firma direkt aus dem Browser nach Supabase. Dürfte
--  der Browser dabei die Spalte "plan" mitschicken, gäbe sich jeder selbst
--  'scale'. Ein Trigger überschreibt den mitgeschickten Wert ausnahmslos —
--  der Client KANN nicht schummeln, egal was er sendet. Das ist dieselbe
--  Eigenschaft wie beim Systemprompt: Der Browser bestimmt nicht, was gilt.
-- ═══════════════════════════════════════════════════════════════

-- 1) Wer hat was bezahlt. Eine Zeile je Clerk-Nutzer.
create table if not exists abos (
  nutzer        text primary key,          -- Clerk-User-ID (auth.jwt() ->> 'sub')
  plan          text not null default 'free'
                check (plan in ('free','start','grow','scale')),
  stripe_kunde  text,                      -- für Kündigungs-Webhooks
  aktualisiert  timestamptz not null default now()
);

alter table abos enable row level security;

-- Lesen darf nur der Besitzer — das Dashboard zeigt den eigenen Plan.
-- Schreiben darf NIEMAND über die API: Nur der Service-Key (Stripe-Webhook)
-- kommt daran vorbei, und der umgeht RLS ohnehin. Ohne diese Einschränkung
-- könnte sich jeder Angemeldete selbst 'scale' eintragen.
drop policy if exists "abo lesen (nur eigenes)" on abos;
create policy "abo lesen (nur eigenes)" on abos
  for select using (nutzer = auth.jwt() ->> 'sub');

-- 2) Der Trigger. Beim Anlegen ODER Ändern einer Firma wird "plan" IMMER aus
--    der abos-Tabelle des Besitzers gesetzt — der vom Browser mitgeschickte
--    Wert wird verworfen.
--
--    Kein Eintrag in abos -> 'free'. Das ist der richtige Rückfall: Wer nicht
--    bezahlt hat, bekommt den kostenlosen Plan, nicht den zuletzt gesetzten.
create or replace function firma_plan_aus_abo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bezahlt text;
begin
  select plan into bezahlt from abos where nutzer = new.besitzer;
  new.plan := coalesce(bezahlt, 'free');
  return new;
end;
$$;

drop trigger if exists firmen_plan_setzen on firmen;
create trigger firmen_plan_setzen
  before insert or update on firmen
  for each row execute function firma_plan_aus_abo();

-- 2b) Die GEGENRICHTUNG. Ohne sie wäre der Trigger oben eine Falle:
--     Ändert sich das Abo (Zahlung, Kündigung), stünde in firmen.plan weiter
--     der alte Wert, bis der Kunde zufällig etwas speichert.
--
--     Und wichtiger noch: netlify/functions/lib/firmaLaden.js -> setzePlanServer
--     schreibt heute per PATCH direkt auf firmen.plan. Der Trigger oben würde
--     genau diesen Schreibvorgang überschreiben und die Zahlung verwerfen.
--     Deshalb schreibt der Webhook künftig in abos, und von dort fliesst es
--     hierher. Eine Quelle der Wahrheit statt zwei, die sich widersprechen.
create or replace function abo_auf_firmen_spiegeln()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update firmen set plan = new.plan where besitzer = new.nutzer and plan is distinct from new.plan;
  return new;
end;
$$;

drop trigger if exists abos_auf_firmen on abos;
create trigger abos_auf_firmen
  after insert or update of plan on abos
  for each row execute function abo_auf_firmen_spiegeln();

-- 3) Bestehende Firmen in die abos-Tabelle spiegeln, damit der Trigger sie
--    beim nächsten Speichern nicht auf 'free' zurückwirft.
--    (Die drei grow-Firmen aus migration-plaene.sql sollen grow bleiben.)
insert into abos (nutzer, plan)
select distinct on (besitzer) besitzer, plan
  from firmen
 where besitzer is not null
 order by besitzer,
          -- Bei mehreren Firmen je Nutzer gewinnt der grösste Plan.
          case plan when 'scale' then 4 when 'grow' then 3 when 'start' then 2 else 1 end desc
on conflict (nutzer) do nothing;
-- Der Spiegel-Trigger feuert dabei sofort und schreibt denselben Wert nach
-- firmen zurueck — unschaedlich, weil die Werte identisch sind, und er stellt
-- sicher, dass beide Tabellen ab hier garantiert uebereinstimmen.

-- Prüfen:
--   select * from abos order by plan;
--   select plan, count(*) from firmen group by plan;
--   select tgname from pg_trigger where tgrelid = 'firmen'::regclass and not tgisinternal;

-- ===============================================================
-- OFFENE ENTSCHEIDUNG: Ein Abo deckt derzeit ALLE Firmen eines Nutzers.
--
-- Beim Ausführen dieser Migration ist das sichtbar geworden: Ein Konto besitzt
-- fünf Firmen. Zwei davon standen auf grow, drei auf free. Da der Plan jetzt am
-- Nutzer hängt und der grösste gewinnt, stehen seither alle fünf auf grow.
--
-- Innerhalb dieses Datenbestandes ist das harmlos (Testdaten, kein einziger
-- Stripe-Kunde). Als Regel ist es aber eine echte Lücke:
--   * public/lib/store.js -> macheId() hängt an jeden Namen einen Zufallswert.
--     Jeder Onboarding-Durchlauf legt also eine NEUE Firma an.
--   * Der Verbrauchszähler zählt je FIRMA (migration-verbrauch.sql).
--     Fünf Firmen bedeuten fünfmal das Kontingent zum Preis von einem.
--
-- Damit unterläuft die Mehrfach-Firma genau den Kostenschutz, der in
-- netlify/functions/lib/verbrauch.js aufgebaut wurde.
--
-- Bewusst NICHT hier entschieden, weil es eine Preisfrage ist und keine
-- technische: public/preis.html sagt heute nirgends, wie viele Agenten ein Plan
-- umfasst. Sie durchgehend im Singular zu formulieren ("deine Webseite") ist
-- kein Vertrag.
--
-- Der technische Weg, falls die Antwort "ein Abo = ein Agent" lautet:
--   alter table abos add column firma text;
--   Der Trigger oben vergibt den Plan dann nur an abos.firma und bindet beim
--   ersten Firmen-Insert nach der Zahlung (firma is null -> new.id eintragen).
--   Jede weitere Firma desselben Nutzers bliebe auf free.
--   Dazu gehört ein Knopf im Dashboard, um das Abo umzuhängen — sonst sitzt
--   ein Kunde fest, der seinen Agenten neu aufsetzt.
-- ===============================================================
