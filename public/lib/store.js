// Speicher-Layer für Firmen.
// Ist Supabase konfiguriert (siehe auth.js), läuft alles über die Datenbank
// (Tabelle "firmen") — dauerhaft und geräteübergreifend. Sonst Fallback auf
// localStorage (Simulation). Die Daten-Funktionen sind async -> Aufrufer nutzen await.

const Store = (function () {
  const FIRMEN_KEY = "firmen";
  const NUTZER_KEY = "nutzer";

  // Den schon in auth.js erstellten Supabase-Client mitbenutzen (kein zweiter Client).
  const sb = (window.Auth && window.Auth.konfiguriert) ? window.Auth.client : null;

  function _alleLokal() { try { return JSON.parse(localStorage.getItem(FIRMEN_KEY)) || {}; } catch { return {}; } }
  function _speichernLokal(obj) { localStorage.setItem(FIRMEN_KEY, JSON.stringify(obj)); }

  function macheId(name) {
    const slug = (name || "firma")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "firma";
    return slug + "-" + Math.random().toString(36).slice(2, 7);
  }

  return {
    // E-Mail nur zur Vorbefüllung; das echte Login macht auth.js.
    aktuellerNutzer() { return localStorage.getItem(NUTZER_KEY) || null; },
    setNutzer(email) { localStorage.setItem(NUTZER_KEY, email); },
    abmelden() { localStorage.removeItem(NUTZER_KEY); },
    macheId,

    // Eine Firma laden (öffentlich lesbar -> Chat funktioniert für alle Besucher).
    async ladeFirma(id) {
      if (sb) {
        const { data, error } = await sb.from("firmen").select("daten").eq("id", id).maybeSingle();
        if (error) { console.warn("ladeFirma:", error.message); return null; }
        return data ? data.daten : null;
      }
      return _alleLokal()[id] || null;
    },

    // Eine Firma speichern/aktualisieren (nur Besitzer darf das, erzwingt RLS).
    async saveFirma(firma) {
      if (sb) {
        const { error } = await sb.from("firmen")
          .upsert({ id: firma.id, name: firma.name, daten: firma }, { onConflict: "id" });
        if (error) throw new Error(error.message);
        return firma;
      }
      const a = _alleLokal(); a[firma.id] = firma; _speichernLokal(a); return firma;
    },

    // Alle Firmen des eingeloggten Nutzers (für ein späteres Dashboard).
    async meineFirmen() {
      if (sb) {
        const { data: u } = await sb.auth.getUser();
        if (!u || !u.user) return [];
        const { data, error } = await sb.from("firmen")
          .select("daten").eq("besitzer", u.user.id).order("erstellt", { ascending: false });
        if (error) { console.warn(error.message); return []; }
        return (data || []).map((r) => r.daten);
      }
      return Object.values(_alleLokal());
    },
  };
})();

window.Store = Store;
