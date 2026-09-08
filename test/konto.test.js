// Tests fuer Aufbewahrungsfristen und Konto-Loeschung.
//
// Beides sind Vorgaenge, die Daten VERNICHTEN. Ein Fehler faellt hier nicht
// als Fehlermeldung auf, sondern als fehlender Datensatz — und dann ist es zu
// spaet. Deshalb wird vor allem geprueft, was NICHT geloescht werden darf.

const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://probe.invalid";
process.env.SUPABASE_SERVICE_KEY = "service_probe";
process.env.FRIST_GESPRAECHE_TAGE = "90";
process.env.FRIST_KONTAKTE_TAGE = "365";

const { raeumeAb, FRISTEN } = require("../netlify/functions/lib/aufbewahrung");
const { exportiereKonto, loescheKonto, inListe } = require("../netlify/functions/lib/konto");

const echterFetch = global.fetch;

// Faengt alle Aufrufe ab und protokolliert sie.
function fangeAb(antworten) {
  const rufe = [];
  global.fetch = async (url, opts) => {
    const u = String(url);
    rufe.push({ url: u, methode: (opts && opts.method) || "GET", koerper: opts && opts.body });
    for (const [muster, wert] of Object.entries(antworten || {})) {
      if (u.includes(muster)) return { ok: true, status: 200, json: async () => wert };
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  return {
    rufe,
    urls: () => rufe.map((r) => r.methode + " " + r.url),
    ende() { global.fetch = echterFetch; },
  };
}

// ── Aufbewahrung ────────────────────────────────────────────────────────────

test("Aufbewahrung: raeumt genau die drei Tabellen, mit den richtigen Spalten", async () => {
  const f = fangeAb();
  try {
    await raeumeAb(true);
    const geloescht = f.rufe.filter((r) => r.methode === "DELETE").map((r) => r.url);
    assert.equal(geloescht.length, 3, "genau drei Tabellen");

    // gespraeche und kontaktanfragen nach Erstellungsdatum ...
    assert.ok(geloescht.some((u) => u.includes("/gespraeche?erstellt=lt.")));
    assert.ok(geloescht.some((u) => u.includes("/kontaktanfragen?erstellt=lt.")));

    // ... rate_limits dagegen nach fenster_ende. Die Tabelle hat kein
    // "erstellt" (schema.sql), und nach Erstellungsdatum zu loeschen wuerde
    // laufende Monatssperren wegwerfen.
    assert.ok(geloescht.some((u) => u.includes("/rate_limits?fenster_ende=lt.")),
      "rate_limits muss ueber fenster_ende laufen");
  } finally { f.ende(); }
});

test("Aufbewahrung: die Fristen sind gesetzt und plausibel", () => {
  const nach = (t) => FRISTEN.find((f) => f.tabelle === t);
  assert.equal(nach("gespraeche").tage, 90);
  assert.equal(nach("kontaktanfragen").tage, 365);
  // Leads laenger als Gespraeche — sie sind das, wofuer der Kunde bezahlt.
  assert.ok(nach("kontaktanfragen").tage > nach("gespraeche").tage);
});

test("Aufbewahrung: Abstandsbremse verhindert Dauerlauf", async () => {
  const f = fangeAb();
  try {
    await raeumeAb(true);               // setzt den Merker
    const vorher = f.rufe.length;
    const r = await raeumeAb();          // ohne erzwingen -> muss aussetzen
    assert.equal(r.uebersprungen, "zu frueh");
    assert.equal(f.rufe.length, vorher, "kein einziger weiterer Aufruf");
  } finally { f.ende(); }
});

// ── Konto ───────────────────────────────────────────────────────────────────

test("inListe: Anfuehrungszeichen in einer ID koennen den Filter nicht aufbrechen", () => {
  assert.equal(inListe(["a", "b"]), 'in.("a","b")');
  const boese = inListe(['x") or true --']);
  assert.ok(boese.includes('\\"'), "das Anfuehrungszeichen muss maskiert sein");
});

test("Export: liest nur Daten der EIGENEN Firmen", async () => {
  const f = fangeAb({ "/firmen?": [{ id: "meine-firma", daten: {}, plan: "grow" }] });
  try {
    const d = await exportiereKonto("user_abc");
    const urls = f.urls().join("\n");

    // Der Nutzer steht im Firmen-Filter ...
    assert.ok(urls.includes("firmen?besitzer=eq.user_abc"));
    // ... und Gespraeche werden ueber die gefundene Firmen-ID geholt,
    // nicht ueber irgendetwas aus dem Browser.
    assert.ok(urls.includes("gespraeche?firma_id=in."));
    assert.ok(urls.includes('meine-firma'));
    assert.equal(d.nutzer, "user_abc");
    assert.equal(d.agenten.length, 1);
  } finally { f.ende(); }
});

test("Export ohne eigene Firma fragt Gespraeche GAR NICHT ab", async () => {
  // Der gefaehrliche Fall: Eine leere Liste ergaebe den Filter "in.()".
  // Der ist ungueltig, und je nach Auslegung traefe er ALLES — also die
  // Gespraeche saemtlicher Kunden.
  const f = fangeAb({ "/firmen?": [] });
  try {
    const d = await exportiereKonto("user_neu");
    const urls = f.urls().join("\n");
    assert.ok(!urls.includes("gespraeche"), "keine Gespraechs-Abfrage ohne Firma");
    assert.ok(!urls.includes("in.()"), "niemals ein leerer in-Filter");
    assert.deepEqual(d.gespraeche, []);
  } finally { f.ende(); }
});

test("Loeschen ohne eigene Firma raeumt NUR die Abo-Zeile", async () => {
  const f = fangeAb({ "/firmen?": [] });
  try {
    await loescheKonto("user_neu");
    const geloescht = f.rufe.filter((r) => r.methode === "DELETE").map((r) => r.url);
    assert.equal(geloescht.length, 1);
    assert.ok(geloescht[0].includes("abos?nutzer=eq.user_neu"));
    assert.ok(!geloescht.join("").includes("in.()"), "niemals ein leerer in-Filter");
  } finally { f.ende(); }
});

test("Loeschen: Reihenfolge von aussen nach innen, Firmen zuletzt", async () => {
  const f = fangeAb({ "/firmen?": [{ id: "f1", daten: {} }] });
  try {
    await loescheKonto("user_abc");
    const geloescht = f.rufe.filter((r) => r.methode === "DELETE").map((r) => r.url);

    const iGespraeche = geloescht.findIndex((u) => u.includes("/gespraeche"));
    const iKontakte = geloescht.findIndex((u) => u.includes("/kontaktanfragen"));
    const iFirmen = geloescht.findIndex((u) => u.includes("/firmen"));
    const iAbos = geloescht.findIndex((u) => u.includes("/abos"));

    assert.ok(iGespraeche >= 0 && iKontakte >= 0 && iFirmen >= 0 && iAbos >= 0);
    // Zuerst das, was an der Firma haengt. Andersherum blieben Waisen zurueck,
    // die niemand mehr zuordnen — und damit auch nicht mehr loeschen — kann.
    assert.ok(iGespraeche < iFirmen, "Gespraeche vor den Firmen");
    assert.ok(iKontakte < iFirmen, "Kontaktanfragen vor den Firmen");
    assert.ok(iFirmen < iAbos, "Firmen vor der Abo-Zeile");
  } finally { f.ende(); }
});
