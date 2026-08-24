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

    // Eine Firma speichern/aktualisieren. Der Besitzer ist die Clerk-User-ID;
    // die RLS-Regel laesst nur den Besitzer schreiben.
    //
    // Die plan-Spalte wird hier NICHT geschrieben, und der Browser koennte es
    // auch gar nicht: Ein Trigger auf firmen setzt plan bei jedem
    // Schreibvorgang aus der Tabelle abos, in der allein der Stripe-Webhook
    // schreibt (migration-abo.sql). Was ein Konto darf, entscheidet damit der
    // Server — egal was von hier aus mitgeschickt wird.
    //
    // Neue Firmen ohne bezahltes Abo bekommen "free" (DB-Default seit
    // migration-plaene.sql; frueher war es "basis", also ein BEZAHLTER Plan).
    async saveFirma(firma) {
      if (sb) {
        // Besitzer = Clerk-User-ID (passt zur RLS-Policy auth.jwt()->>'sub').
        const nutzer = window.Auth ? await window.Auth.nutzer() : null;

        // OHNE Besitzer NICHT speichern.
        //
        // Vorher wurde die Zeile in diesem Fall stillschweigend ohne besitzer
        // angelegt. Das ist der teuerste stille Fehler im ganzen Ablauf:
        //   * meineFirmen() filtert nach besitzer — der Agent taucht im
        //     Dashboard NIE auf, obwohl er in der Datenbank steht.
        //   * Der Plan-Trigger holt den Plan ueber besitzer aus abos
        //     (migration-abo.sql). Ohne Besitzer gibt es immer "free" — ein
        //     Kunde haette also bezahlt und bekaeme den kostenlosen Plan.
        //
        // Das passiert nicht nur, wenn jemand den Konto-Schritt umgeht: Das
        // Einrichten dauert mit Bildgenerierung leicht zehn Minuten, und eine
        // abgelaufene Clerk-Sitzung sieht hier genauso aus.
        //
        // Lieber eine sichtbare Fehlermeldung als ein Agent, den niemand
        // wiederfindet. In der Datenbank stehen aus der Zeit davor drei solche
        // herrenlosen Zeilen.
        if (!nutzer) {
          throw new Error("Nicht angemeldet — bitte die Seite neu laden und erneut anmelden. " +
            "Deine Eingaben bleiben erhalten.");
        }

        const eintrag = { id: firma.id, name: firma.name, daten: firma, besitzer: nutzer.id };
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

    // Wie viele Antworten hat der Agent diesen Monat gegeben?
    //
    // Geht ueber die Datenbank-Function antworten_stand_lesen, die IN SICH
    // prueft, ob die Firma dem Anrufer gehoert (migration-verbrauch.sql) —
    // sonst koennte ein Angemeldeter den Verbrauch fremder Firmen abfragen.
    //
    // Gibt null zurueck, wenn es nicht geht (kein Supabase, Migration noch
    // nicht gelaufen, Netzfehler). Der Aufrufer blendet den Hinweis dann
    // einfach aus — eine fehlende Verbrauchsanzeige ist kein Grund, das
    // Dashboard kaputt aussehen zu lassen.
    async verbrauch(firmaId) {
      if (!sb || !firmaId) return null;
      try {
        const { data, error } = await sb.rpc("antworten_stand_lesen", { firma_id: firmaId });
        if (error) return null;
        const stand = Number(data);
        return Number.isFinite(stand) && stand >= 0 ? stand : null;
      } catch {
        return null;
      }
    },
  };
})();

window.Store = Store;
