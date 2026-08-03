# Login über Clerk einrichten

Das Login läuft jetzt über [Clerk](https://clerk.com) statt über Supabase Auth.
Clerk bringt Registrierung, Login, Passwort-Reset **und die E-Mail-Bestätigung**
fertig mit. Supabase bleibt für die Daten (Tabelle `firmen`, Storage) zuständig.

Solange in `public/lib/clerk-config.js` noch `pk_test_DEIN-KEY` steht, läuft das
Onboarding im Simulations-Modus (kein echtes Login, nur ein E-Mail-Feld).

## 1. Clerk-Konto und Key

1. Auf [clerk.com](https://clerk.com) ein Konto und eine Anwendung anlegen.
2. Als Anmeldeart **E-Mail + Passwort** aktivieren, und
   **"Verify email address"** einschalten (Clerk verlangt dann den Code aus der Mail).
3. Unter **API Keys** den **Publishable key** kopieren (beginnt mit `pk_test_`
   oder `pk_live_`).
4. In `public/lib/clerk-config.js` eintragen:
   ```js
   window.CLERK_PUBLISHABLE_KEY = "pk_test_dein-echter-key";
   ```
   Der Publishable key ist öffentlich. Den **Secret key** niemals ins Frontend.

## 2. Erlaubte Domains

In Clerk unter **Domains** die Adressen eintragen, auf denen die App läuft:
`http://localhost:8888` (lokal) und später die Netlify-Domain.

## 3. Clerk mit Supabase verbinden (für die Daten)

Die Firmen-Daten liegen in Supabase mit Row Level Security. Damit Supabase den
per Clerk angemeldeten Nutzer erkennt:

1. In **Clerk**: unter *Integrations* die **Supabase-Integration** aktivieren.
   Clerk zeigt dir dann eine **Clerk-Domain** (z.B. `https://xxx.clerk.accounts.dev`).
2. In **Supabase**: *Authentication -> Sign In / Providers -> Third Party Auth*
   -> **Clerk** hinzufügen und die Clerk-Domain eintragen.
3. In **Supabase SQL**: die Policies auf die Clerk-User-ID umstellen. Die
   Clerk-ID steht im Token unter `sub`:
   ```sql
   -- Beispiel für die Tabelle firmen (analog für storage-Policies):
   drop policy if exists "firmen_besitzer_lesen" on firmen;
   create policy "firmen_besitzer_lesen" on firmen
     for select using (besitzer = auth.jwt() ->> 'sub');

   drop policy if exists "firmen_besitzer_schreiben" on firmen;
   create policy "firmen_besitzer_schreiben" on firmen
     for all using (besitzer = auth.jwt() ->> 'sub')
     with check (besitzer = auth.jwt() ->> 'sub');
   ```
   Hinweis: `besitzer` muss Text sein (Clerk-IDs sehen aus wie `user_2abc...`),
   nicht `uuid`. Falls die Spalte noch `uuid` ist:
   ```sql
   alter table firmen alter column besitzer type text using besitzer::text;
   ```

## 4. Testen

1. `netlify dev` starten, `http://localhost:8888/onboarding-aura.html` öffnen.
2. Schritt "Erstelle dein Konto": Clerks Fenster erscheint. Registrieren,
   **Code aus der E-Mail eingeben**. Erst danach schaltet das Onboarding weiter.
3. `http://localhost:8888/dashboard.html` ohne Login öffnen: Clerks Login-Fenster
   erscheint statt der Daten.

## Was passiert ohne Schritt 3?

Login und Onboarding funktionieren, aber das **Speichern in Supabase** schlägt
fehl (RLS lässt den unbekannten Nutzer nicht schreiben). Schritt 3 ist also
nötig, sobald echte Daten gespeichert werden sollen.
