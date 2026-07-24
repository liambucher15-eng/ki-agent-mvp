// Auth-Layer (Supabase Magic-Link). Kapselt das Login, damit der Rest der App
// einfach Auth.* aufruft. Wenn Supabase (noch) nicht konfiguriert ist, läuft die
// App im Simulations-Modus weiter (Auth.konfiguriert === false).

const Auth = (function () {
  const konfiguriert =
    !!window.SUPABASE_URL &&
    !String(window.SUPABASE_URL).includes("DEIN-PROJEKT") &&
    !!window.SUPABASE_ANON_KEY &&
    !String(window.SUPABASE_ANON_KEY).includes("DEIN-ANON");

  let client = null;
  if (konfiguriert && window.supabase) {
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  return {
    konfiguriert,
    client,

    // Schickt den Login-Link an die E-Mail. redirectTo = wohin der Link zurückführt.
    async sendMagicLink(email, redirectTo) {
      if (!client) throw new Error("Supabase nicht konfiguriert");
      return client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    },

    // Aktuell eingeloggter Nutzer (oder null).
    async nutzer() {
      if (!client) return null;
      const { data } = await client.auth.getUser();
      return data.user || null;
    },

    // Stellt sicher, dass eine Sitzung existiert. Gibt es noch keine, wird der
    // Nutzer ANONYM angemeldet (echte Nutzer-ID ohne E-Mail). Damit gehört ein
    // erstellter Agent diesem Browser — Fremde können ihn nicht überschreiben
    // (siehe RLS besitzer = auth.uid()). Später auf Magic-Link aufrüstbar.
    async sitzungSichern() {
      if (!client) return null;
      const { data } = await client.auth.getUser();
      if (data.user) return data.user;
      const { data: neu, error } = await client.auth.signInAnonymously();
      if (error) throw new Error("Anmeldung fehlgeschlagen: " + error.message);
      return neu.user;
    },

    // Verknüpft die (anonyme) Sitzung mit einer E-Mail — der Nutzer wird so vom
    // anonymen zu einem dauerhaften Konto, OHNE die Nutzer-ID zu wechseln. Damit
    // bleibt die Firma in seinem Besitz (besitzer = auth.uid()), und er kann per
    // Bestätigungs-Link auf jedem Gerät zurückkommen. Supabase schickt die Mail.
    async verknuepfeEmail(email, redirectTo) {
      if (!client || !email) return { ok: false };
      await this.sitzungSichern(); // sicherstellen, dass eine (anonyme) Sitzung existiert
      const { error } = await client.auth.updateUser(
        { email },
        redirectTo ? { emailRedirectTo: redirectTo } : undefined
      );
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },

    // Konto mit E-Mail + PASSWORT anlegen — als ECHTES signUp (NICHT die anonyme
    // Sitzung aufwerten). Wichtig fürs Gate: Mit "Confirm email" = AN gibt signUp
    // KEINE Sitzung zurück (data.session === null). Der Nutzer ist also NICHT
    // eingeloggt, bis er den Link in der Mail klickt — und erst dann funktioniert
    // der Login (anmelden). So gibt es kein Durchkommen ohne Bestätigung.
    // Eine evtl. vorhandene anonyme Sitzung wird vorher beendet.
    async registriere(email, password, redirectTo) {
      if (!client) return { ok: false, error: "Supabase nicht konfiguriert" };
      if (!email || !password || password.length < 8) {
        return { ok: false, error: "E-Mail und Passwort (min. 8 Zeichen) nötig" };
      }
      try { await client.auth.signOut(); } catch (e) {}
      const { data, error } = await client.auth.signUp({
        email, password,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });
      if (error) return { ok: false, error: error.message };
      // Schon registriert? Supabase liefert dann einen Nutzer mit LEEREN
      // identities und schickt keine neue Mail (Schutz vor E-Mail-Enumeration).
      const ident = data && data.user && data.user.identities;
      if (Array.isArray(ident) && ident.length === 0) {
        return { ok: false, bereitsRegistriert: true,
          error: "Diese E-Mail ist bereits registriert. Melde dich stattdessen an." };
      }
      // Session vorhanden = "Confirm email" ist AUS (dann gibt es nichts zu bestätigen).
      return { ok: true, bestaetigungNoetig: !(data && data.session) };
    },

    // Rückkehrer: Login mit E-Mail + Passwort (z.B. vom Dashboard aus).
    async anmelden(email, password) {
      if (!client) return { ok: false, error: "Supabase nicht konfiguriert" };
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },

    // Hat der aktuelle Nutzer ein dauerhaftes Konto (E-Mail gesetzt, nicht anonym)?
    async hatKonto() {
      const u = await this.nutzer();
      return !!(u && u.email && u.is_anonymous !== true);
    },

    // Ist die E-Mail des aktuellen Nutzers bestätigt? WICHTIG fürs Onboarding-Gate:
    // erst danach darf es weitergehen. refreshSession() holt den frischen Stand vom
    // Server (der Bestätigungsklick passiert oft auf einem anderen Tab und setzt
    // email_confirmed_at serverseitig); getUser() ist der Fallback.
    async emailBestaetigt() {
      if (!client) return false;
      let u = null;
      try { const { data } = await client.auth.refreshSession(); u = data && data.user; } catch (e) {}
      if (!u) { try { const { data } = await client.auth.getUser(); u = data && data.user; } catch (e) {} }
      return !!(u && u.email && u.email_confirmed_at && u.is_anonymous !== true);
    },

    async abmelden() {
      if (client) await client.auth.signOut();
    },
  };
})();

window.Auth = Auth;
