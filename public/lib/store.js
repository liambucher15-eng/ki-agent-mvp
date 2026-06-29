// Einfacher Speicher für Firmen (vorerst im Browser via localStorage).
// WICHTIG: Das ist der Speicher-Layer. SPÄTER wird hier intern auf eine echte
// Datenbank (Supabase) umgestellt — die Funktionen (saveFirma/ladeFirma/...)
// bleiben gleich, alle Aufrufer merken nichts. (Gleiche Idee wie Daten ≠ Code.)

const Store = (function () {
  const FIRMEN_KEY = "firmen"; // { [id]: firmaObjekt }
  const NUTZER_KEY = "nutzer"; // E-Mail des "eingeloggten" Nutzers (Platzhalter für echtes Login)

  function _alle() {
    try { return JSON.parse(localStorage.getItem(FIRMEN_KEY)) || {}; }
    catch { return {}; }
  }
  function _speichernAlle(obj) {
    localStorage.setItem(FIRMEN_KEY, JSON.stringify(obj));
  }

  // Erzeugt eine eindeutige, lesbare ID aus dem Firmennamen.
  function macheId(name) {
    const slug = (name || "firma")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "") // Umlaute/Akzente entfernen
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "firma";
    return slug + "-" + Math.random().toString(36).slice(2, 7);
  }

  return {
    // "Login" (Platzhalter, später Magic-Link via Supabase)
    aktuellerNutzer() { return localStorage.getItem(NUTZER_KEY) || null; },
    setNutzer(email) { localStorage.setItem(NUTZER_KEY, email); },
    abmelden() { localStorage.removeItem(NUTZER_KEY); },

    macheId,
    saveFirma(firma) { const a = _alle(); a[firma.id] = firma; _speichernAlle(a); return firma; },
    ladeFirma(id) { return _alle()[id] || null; },
    listeFirmen() { return Object.values(_alle()); },
    meineFirmen(email) { return Object.values(_alle()).filter((f) => f.email === email); },
  };
})();

window.Store = Store;
