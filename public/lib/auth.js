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

    async abmelden() {
      if (client) await client.auth.signOut();
    },
  };
})();

window.Auth = Auth;
