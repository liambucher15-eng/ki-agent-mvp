# Abo-System — Plan (SaaS-Aufbau)

> Wie aus dem Prototyp ein verkaufbares Web-SaaS mit monatlichem Abo wird.
> Kein App-Download — alles im Browser. Zwei Pläne: **Basis** (Farbkugel) / **Plus** (Maskottchen).

---

## Das Produkt in 3 Teilen

| Teil | Adresse (Beispiel) | Für wen | Status |
|------|--------------------|---------|--------|
| **Landing-Seite** | `deinedomain.ch` | Interessenten | neu |
| **Dashboard** (Web-App, enthält Onboarding) | `app.deinedomain.ch` | zahlende Kunden | Onboarding-Prototyp da |
| **Widget** | auf der Kundenseite | deren Besucher | da (`widget.js`) |

---

## Empfohlene Reihenfolge: erst Wert, dann Bezahlung

### STUFE 1 — Produkt real machen (ohne Bezahlung)
Ziel: Ein Kunde kann sich einloggen, das Onboarding durchlaufen, der Agent geht live.
So kannst du es selbst testen und erste Kunden **manuell** freischalten.

1. **Deploy zu Netlify**
   - Repo mit Netlify verbinden, `ANTHROPIC_API_KEY` als Umgebungsvariable in Netlify setzen
   - Ergebnis: alles öffentlich erreichbar (Voraussetzung für Widget auf echten Seiten + Stripe-Webhooks)
2. **Echtes Speichern (Supabase)**
   - `firmen`-Tabelle anlegen (SQL liegt vor) + Onboarding speichert den gescannten Agenten wirklich
   - `chat.js` lädt die Firma aus der DB (statt nur Seed/Client-Config)
3. **Dashboard-Hülle**
   - Nach Login: kein Agent → Onboarding; Agent vorhanden → Übersicht
   - Übersicht: Agent testen, Embed-Code, Infos/Design bearbeiten, Agent löschen
   - `onboarding-neu.html` wird hier eingehängt (echtes Speichern statt Prototyp-Zustand)

### STUFE 2 — Monetarisieren (Stripe-Abo)
4. **Datenmodell fürs Abo (Supabase)**
   - `profile`-Tabelle (1:1 mit Login-Nutzer): `plan` ('basis'|'plus'), `abo_status`
     ('aktiv'|'gekuendigt'|'keins'), `stripe_customer_id`, `stripe_subscription_id`
5. **Landing-Seite mit Preisen**
   - Produkt erklären, zwei Pläne nebeneinander (Basis / Plus), je „Jetzt starten"
6. **Stripe anbinden** (drei Netlify-Functions)
   - `checkout-starten.js` → erstellt eine **Stripe-Checkout-Session** (gehostete Bezahlseite)
   - `stripe-webhook.js` → hört auf Stripe-Events (`checkout.session.completed`,
     `customer.subscription.updated/deleted`) → schreibt `plan` + `abo_status` nach Supabase
   - `portal-starten.js` → öffnet das **Stripe Customer Portal** (Kunde kündigt/ändert selbst)
   - **Test-Modus zuerst** (Stripe-Test-Keys), dann Live umstellen
7. **Plan-Steuerung (Feature-Gating)**
   - Onboarding: **Maskottchen-Schritt nur bei `plan === 'plus'`**, sonst Orb
   - Widget/Chat: nur antworten, wenn `abo_status === 'aktiv'` (sonst dezenter Hinweis)
   - optional: Nachrichten-Limit pro Plan

---

## Wichtige Designentscheidungen (Empfehlungen)
- **Stripe Checkout (gehostet)** statt eigener Bezahlseite → Stripe übernimmt Kartendaten +
  Sicherheit (PCI). Wir sehen **nie** Kartendaten. Einfacher und sicherer.
- **Stripe Customer Portal** für Kündigung/Zahlungsmethode → fertig von Stripe, spart viel Arbeit.
- **Magic-Link-Login** (Supabase) behalten — schon vorhanden.
- **Abo bestimmt den Agent-Typ** — nicht das Onboarding (wie bereits festgelegt).

## Was schon existiert (wiederverwendbar)
Onboarding-Flow, Scan/Chat/Dokument-Functions, Supabase-Config, Auth (Magic-Link, teils),
Store (localStorage + Supabase, teils), Widget (`widget.js` + `widget-frame.html`).

## Was neu gebaut werden muss
Netlify-Deploy, Landing-Seite, Dashboard-Hülle, `profile`-Tabelle, 3 Stripe-Functions,
Plan-Steuerung. Echtes Speichern im Onboarding fertigstellen.

## Sicherheit / Geld (Grenze)
Stripe-Integration (Struktur, Test-Modus) baue ich. Die echten **Stripe-Schlüssel** trägt
Liam selbst ein (wie der ANTHROPIC_API_KEY). Zahlungen/Transaktionen löst Claude nie selbst aus.
