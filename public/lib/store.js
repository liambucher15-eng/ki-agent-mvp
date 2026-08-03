// Speicher-Layer für Firmen.
// Ist Supabase konfiguriert, läuft alles über die Datenbank (Tabelle "firmen") —
// dauerhaft und geräteübergreifend. Sonst Fallback auf localStorage (Simulation).
// Die Daten-Funktionen sind async -> Aufrufer nutzen await.
//
// LOGIN läuft über Clerk (lib/auth.js). Der Supabase-Client bekommt hier das
// Clerk-Session-Token mit: In Supabase ist Clerk als Third-Party-Auth-Provider
// eingetragen, die RLS-Policies vergleichen besitzer mit auth.jwt()->>'sub'
// (der Clerk-User-ID). Siehe README.

const Store = (function () {
  const FIRMEN_KEY = "firmen";
  const NUTZER_KEY = "nutzer";

  // Eigener Supabase-Client (Daten), authentifiziert per Clerk-Token.
  const sbKonfiguriert =
    !!window.SUPABASE_URL && !String(window.SUPABASE_URL).includes("DEIN-PROJEKT") &&
    !!window.SUPABASE_ANON_KEY && !String(window.SUPABASE_ANON_KEY).includes("DEIN-ANON");
  const sb = (sbKonfiguriert && window.supabase)
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
        // Supabase reicht dieses Token als Authorization-Header weiter.
        accessToken: async () => (window.Auth ? await window.Auth.token() : null),
      })
    : null;

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

    // Eine Firma laden. Seit Milestone 0 lässt die RLS-Policy nur noch den
    // BESITZER lesen (Datenschutz: daten enthält E-Mail + internes Wissen).
    // Für Besucher/Widget gibt es die gefilterte /firma-Function. Diese Funktion
    // hier ist also für Onboarding/Test-Chat im Browser des Erstellers gedacht;
    // für Fremde liefert sie null.
    async ladeFirma(id) {
      if (sb) {
        const { data, error } = await sb.from("firmen").select("daten").eq("id", id).maybeSingle();
        if (error) { console.warn("ladeFirma:", error.message); return null; }
        return data ? data.daten : null;
      }
      return _alleLokal()[id] || null;
    },

    // Charakterbilder (Data-URLs aus Upload/Stub) in den Storage-Bucket
    // "charaktere" hochladen und durch öffentliche URLs ersetzen. So bleibt die
    // firmen-Zeile klein (Größenlimit!) und das Widget lädt Bilder als Dateien.
    // Bilder, die schon URLs sind (http…), werden unverändert übernommen.
    // Ohne Supabase (Simulation): Data-URLs bleiben, wie sie sind.
    async ladeBilderHoch(firmaId, bilder) {
      if (!bilder) return bilder;
      if (!sb) return bilder;
      const nutzer = window.Auth ? await window.Auth.nutzer() : null;
      if (!nutzer) return bilder;

      const ergebnis = {};
      for (const [zustand, wert] of Object.entries(bilder)) {
        if (!wert || !String(wert).startsWith("data:")) { ergebnis[zustand] = wert; continue; }
        const blob = await (await fetch(wert)).blob();
        const endung = (blob.type.split("/")[1] || "png").replace("+xml", "");
        // Pfad MUSS mit der eigenen Nutzer-ID beginnen (Storage-Policy).
        const pfad = nutzer.id + "/" + firmaId + "-" + zustand + "." + endung;
        const { error } = await sb.storage.from("charaktere")
          .upload(pfad, blob, { upsert: true, contentType: blob.type });
        if (error) throw new Error("Bild-Upload (" + zustand + "): " + error.message);
        ergebnis[zustand] = sb.storage.from("charaktere").getPublicUrl(pfad).data.publicUrl;
      }
      return ergebnis;
    },

    // Eine Firma speichern/aktualisieren. Der Besitzer wird über die anonyme
    // Sitzung gesetzt (auth.uid()); die RLS-Regel lässt nur den Besitzer schreiben.
    //
    // WICHTIG (Milestone 5): Die plan-Spalte wird hier NICHT geschrieben — der Plan
    // ist Server-Wahrheit und wird ausschliesslich vom Stripe-Webhook gesetzt
    // (Column-Level-REVOKE in migration-m5.sql). Neue Firmen bekommen per DB-Default
    // "basis"; ein Re-Save lässt einen bezahlten Plan unangetastet.
    async saveFirma(firma) {
      if (sb) {
        // Besitzer = Clerk-User-ID (passt zur RLS-Policy auth.jwt()->>'sub').
        const nutzer = window.Auth ? await window.Auth.nutzer() : null;
        const eintrag = { id: firma.id, name: firma.name, daten: firma };
        if (nutzer) eintrag.besitzer = nutzer.id;
        const { error } = await sb.from("firmen").upsert(eintrag, { onConflict: "id" });
        if (error) throw new Error(error.message);
        return firma;
      }
      const a = _alleLokal(); a[firma.id] = firma; _speichernLokal(a); return firma;
    },

    // Alle Firmen des eingeloggten Nutzers (fürs Dashboard).
    async meineFirmen() {
      if (sb) {
        const nutzer = window.Auth ? await window.Auth.nutzer() : null;
        if (!nutzer) return [];
        const { data, error } = await sb.from("firmen")
          .select("daten").eq("besitzer", nutzer.id).order("erstellt", { ascending: false });
        if (error) { console.warn(error.message); return []; }
        return (data || []).map((r) => r.daten);
      }
      return Object.values(_alleLokal());
    },
  };
})();

window.Store = Store;
