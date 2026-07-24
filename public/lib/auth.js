// Auth-Layer über CLERK. Kapselt das Login, damit der Rest der App einfach
// Auth.* aufruft. Clerk übernimmt Registrierung, Login UND die E-Mail-
// Bestätigung (Code-Eingabe) — deshalb gibt es hier keine eigenen Passwort- oder
// Bestätigungs-Formulare mehr.
//
// Ist kein echter Publishable Key hinterlegt (lib/clerk-config.js), läuft die
// App im Simulations-Modus weiter (Auth.konfiguriert === false).
//
// Zusammenspiel mit Supabase (Daten): Der Supabase-Client bekommt in store.js
// das Clerk-Session-Token (Auth.token()). In Supabase muss Clerk dafür als
// Third-Party-Auth-Provider eingetragen sein; die RLS-Policies vergleichen dann
// besitzer mit auth.jwt()->>'sub' (der Clerk-User-ID). Siehe README.

const Auth = (function () {
  const key = window.CLERK_PUBLISHABLE_KEY || "";
  const konfiguriert = !!key && !key.includes("DEIN-KEY");

  let clerk = null;
  let bereitP = null;

  // Clerk-Skript nachladen und initialisieren (einmalig, alle warten auf dasselbe
  // Versprechen). Ohne Key passiert nichts.
  function bereit() {
    if (!konfiguriert) return Promise.resolve(null);
    if (bereitP) return bereitP;
    bereitP = new Promise((fertig) => {
      function start() {
        try {
          clerk = new window.Clerk(key);
          clerk.load({}).then(() => fertig(clerk)).catch(() => { clerk = null; fertig(null); });
        } catch (e) { clerk = null; fertig(null); }
      }
      if (window.Clerk) return start();
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
      s.crossOrigin = "anonymous";
      s.onload = start;
      s.onerror = () => fertig(null);
      document.head.appendChild(s);
    });
    return bereitP;
  }

  return {
    konfiguriert,
    bereit,
    get client() { return clerk; },

    // Aktuell eingeloggter Nutzer (oder null). Vereinheitlicht auf die Felder,
    // die der Rest der App nutzt: id, email.
    async nutzer() {
      const c = await bereit();
      if (!c || !c.user) return null;
      const email = (c.user.primaryEmailAddress && c.user.primaryEmailAddress.emailAddress) || "";
      return { id: c.user.id, email, clerk: c.user };
    },

    // Session-Token für Supabase (Third-Party Auth). null, wenn nicht eingeloggt.
    async token() {
      const c = await bereit();
      if (!c || !c.session) return null;
      try { return await c.session.getToken(); } catch (e) { return null; }
    },

    // Ist jemand eingeloggt? (Clerk lässt nur bestätigte Konten hinein, deshalb
    // ist das gleichbedeutend mit "Konto vorhanden und E-Mail bestätigt".)
    async hatKonto() {
      return !!(await this.nutzer());
    },
    async emailBestaetigt() {
      return !!(await this.nutzer());
    },

    // Clerks fertige Anmelde-/Registrier-Oberfläche in ein Element hängen.
    // Clerk erzwingt dabei die E-Mail-Bestätigung von sich aus.
    async zeigeRegistrierung(el) {
      const c = await bereit();
      if (!c || !el) return false;
      c.mountSignUp(el, { signInUrl: "#", forceRedirectUrl: window.location.href });
      return true;
    },
    async zeigeAnmeldung(el) {
      const c = await bereit();
      if (!c || !el) return false;
      c.mountSignIn(el, { forceRedirectUrl: window.location.href });
      return true;
    },

    // Auf Login warten: ruft zurück, sobald ein Nutzer eingeloggt ist.
    async beiAnmeldung(rueckruf) {
      const c = await bereit();
      if (!c) return () => {};
      return c.addListener((ev) => { if (ev.user) rueckruf(ev.user); });
    },

    async abmelden() {
      const c = await bereit();
      if (c) await c.signOut();
    },
  };
})();

window.Auth = Auth;
