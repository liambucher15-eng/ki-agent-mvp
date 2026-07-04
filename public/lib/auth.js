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

    async abmelden() {
      if (client) await client.auth.signOut();
    },
  };
})();

window.Auth = Auth;
