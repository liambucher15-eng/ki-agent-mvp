// Tests für die Stripe-Webhook-Signaturprüfung — sicherheitskritisch:
// ein gefälschtes "bezahlt"-Event darf NICHT durchkommen.

const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Env VOR dem (einzigen) Require setzen — das Modul liest sie beim Laden und
// wird danach aus dem Require-Cache bedient (weitere process.env-Änderungen
// hätten also keine Wirkung mehr).
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_geheim";
process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.STRIPE_PREIS_START = "price_start_1";
process.env.STRIPE_PREIS_GROW = "price_grow_2";
process.env.STRIPE_PREIS_SCALE = "price_scale_3";
process.env.STRIPE_PREIS_START_JAHR = "price_start_jahr";
process.env.STRIPE_PREIS_GROW_JAHR = "price_grow_jahr";
const { verifiziereWebhook, erstelleCheckout, konfiguriert, preisFuer } = require("../netlify/functions/lib/stripe");

function signiere(body, secret, t) {
  t = t || Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(t + "." + body, "utf8").digest("hex");
  return "t=" + t + ",v1=" + sig;
}

test("korrekt signiertes Event wird akzeptiert und geparst", () => {
  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { metadata: { nutzer: "user_x" } } } });
  const header = signiere(body, "whsec_test_geheim");
  const ev = verifiziereWebhook(body, header);
  assert.equal(ev.type, "checkout.session.completed");
  assert.equal(ev.data.object.metadata.nutzer, "user_x");
});

test("falsches Secret -> abgelehnt", () => {
  const body = "{}";
  const header = signiere(body, "whsec_falsch");
  assert.throws(() => verifiziereWebhook(body, header), /ungültig/i);
});

test("manipulierter Body -> abgelehnt", () => {
  const echt = "{}";
  const header = signiere(echt, "whsec_test_geheim");
  assert.throws(() => verifiziereWebhook('{"böse":1}', header), /ungültig/i);
});

test("veralteter Zeitstempel (>5 min) -> abgelehnt", () => {
  const body = "{}";
  const alt = Math.floor(Date.now() / 1000) - 600;
  const header = signiere(body, "whsec_test_geheim", alt);
  assert.throws(() => verifiziereWebhook(body, header), /alt/i);
});

test("fehlende Signatur -> abgelehnt", () => {
  assert.throws(() => verifiziereWebhook("{}", ""), /unvollständig/i);
});

// --- Vier Plaene, und das Abo haengt am NUTZER ---
//
// Der springende Punkt dieser Gruppe: In den Metadaten steht der Nutzer, nicht
// die Firma. Der Kunde bezahlt, BEVOR er seinen Agenten einrichtet — waere hier
// eine firmaId noetig, gaebe es den Weg 'Preisseite -> Konto -> bezahlen ->
// Onboarding' gar nicht.
const echterFetch = global.fetch;
afterEach(() => { global.fetch = echterFetch; });

function mockCheckoutAntwort() {
  // Zuruecksetzen ist wichtig: letzterAufruf haengt an der FUNKTION und
  // ueberlebt sonst den Test. Ein Test, der prueft "es gab keinen Aufruf",
  // saehe dann den Aufruf des vorherigen Tests und schluege grundlos fehl
  // (oder, schlimmer, ginge grundlos durch).
  mockCheckoutAntwort.letzterAufruf = undefined;
  global.fetch = async (url, opts) => {
    mockCheckoutAntwort.letzterAufruf = { url, opts };
    return { ok: true, json: async () => ({ id: "cs_test", url: "https://checkout.stripe.com/x" }) };
  };
}

test("erstelleCheckout: der NUTZER steht in den Metadaten, keine Firma", async () => {
  mockCheckoutAntwort();
  await erstelleCheckout({ nutzer: "user_abc", plan: "grow", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" });
  const body = new URLSearchParams(mockCheckoutAntwort.letzterAufruf.opts.body);
  assert.equal(body.get("metadata[nutzer]"), "user_abc");
  assert.equal(body.get("client_reference_id"), "user_abc");
  assert.equal(body.get("subscription_data[metadata][nutzer]"), "user_abc");
  // Es darf gar keine firma_id mehr mitgeschickt werden.
  assert.equal(body.get("metadata[firma_id]"), null);
});

test("erstelleCheckout: jeder kaufbare Plan trifft seinen eigenen Preis", async () => {
  for (const [plan, preis] of [["start", "price_start_1"], ["grow", "price_grow_2"], ["scale", "price_scale_3"]]) {
    mockCheckoutAntwort();
    await erstelleCheckout({ nutzer: "u", plan, erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" });
    const body = new URLSearchParams(mockCheckoutAntwort.letzterAufruf.opts.body);
    assert.equal(body.get("line_items[0][price]"), preis, "Plan " + plan);
    assert.equal(body.get("metadata[plan]"), plan);
  }
});

test("erstelleCheckout: 'free' ist NICHT kaufbar", async () => {
  // Eine Checkout-Session ueber CHF 0 waere eine Zahlungsaufforderung ohne
  // Betrag. Wichtiger noch: Wer free waehlt, soll gar nicht erst zu Stripe.
  mockCheckoutAntwort();
  await assert.rejects(
    () => erstelleCheckout({ nutzer: "u", plan: "free", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" }),
    /nicht kaufbar/i
  );
});

test("erstelleCheckout: unbekannter Plan wird abgelehnt, nicht geraten", async () => {
  // Frueher fiel jeder unbekannte Wert stillschweigend auf den teuersten Plan
  // zurueck. Ein Tippfehler im Frontend haette den Kunden also ungefragt in ein
  // anderes Abo geschickt, als er angeklickt hat.
  mockCheckoutAntwort();
  await assert.rejects(
    () => erstelleCheckout({ nutzer: "u", plan: "gorw", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" }),
    /nicht kaufbar/i
  );
  await assert.rejects(
    () => erstelleCheckout({ nutzer: "u", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" }),
    /nicht kaufbar/i
  );
});

test("erstelleCheckout: ohne Nutzer-ID gar nicht erst zu Stripe", async () => {
  // Eine Zahlung, die sich niemandem zuordnen laesst, ist Geld ohne Gegenleistung.
  mockCheckoutAntwort();
  await assert.rejects(
    () => erstelleCheckout({ plan: "grow", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" }),
    /Nutzer-ID/i
  );
});

test("die alten Env-Namen bleiben gueltig (basis -> start, plus -> grow)", () => {
  // Ein bereits eingerichtetes Deployment darf beim naechsten Deploy nicht
  // stumm die Bezahlung verlieren. Die Zuordnung ist dieselbe wie in
  // migration-plaene.sql.
  const alt = { START: process.env.STRIPE_PREIS_START, GROW: process.env.STRIPE_PREIS_GROW };
  delete process.env.STRIPE_PREIS_START;
  delete process.env.STRIPE_PREIS_GROW;
  process.env.STRIPE_PREIS_BASIS = "price_alt_basis";
  process.env.STRIPE_PREIS_PLUS = "price_alt_plus";
  try {
    assert.equal(preisFuer("start"), "price_alt_basis");
    assert.equal(preisFuer("grow"), "price_alt_plus");
  } finally {
    process.env.STRIPE_PREIS_START = alt.START;
    process.env.STRIPE_PREIS_GROW = alt.GROW;
  }
});

test("konfiguriert: true, sobald mindestens ein Preis + Secret gesetzt sind", () => {
  assert.equal(konfiguriert(), true);
});

// --- Abrechnungstakt: monatlich oder jaehrlich --------------------------
//
// Die Preisseite bietet beides an. Bis zu dieser Gruppe tauschte der
// Umschalter NUR Text: Wer "jaehrlich" waehlte, las CHF 66 und landete im
// Monatsabo zu CHF 79. Eine Falschabrechnung, die niemand vor der Belastung
// bemerkt haette.

test("takt 'jahr' nimmt den Jahrespreis, nicht den Monatspreis", async () => {
  mockCheckoutAntwort();
  await erstelleCheckout({ nutzer: "u", plan: "grow", takt: "jahr", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" });
  const body = new URLSearchParams(mockCheckoutAntwort.letzterAufruf.opts.body);
  assert.equal(body.get("line_items[0][price]"), "price_grow_jahr");
  assert.equal(body.get("metadata[takt]"), "jahr");
});

test("ohne Takt gilt monatlich", async () => {
  // Der Wert, den die Preisseite beim Laden anzeigt. Ein fehlender Takt darf
  // nicht versehentlich das guenstigere Jahresabo ausloesen.
  mockCheckoutAntwort();
  await erstelleCheckout({ nutzer: "u", plan: "grow", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" });
  const body = new URLSearchParams(mockCheckoutAntwort.letzterAufruf.opts.body);
  assert.equal(body.get("line_items[0][price]"), "price_grow_2");
  assert.equal(body.get("metadata[takt]"), "monat");
});

test("fehlender Jahrespreis faellt NICHT auf den Monatspreis zurueck", async () => {
  // Das ist der eigentliche Punkt: Scale hat oben keinen Jahrespreis. Ein
  // stiller Rueckfall wuerde CHF 199 statt der gelesenen CHF 166 abbuchen.
  mockCheckoutAntwort();
  await assert.rejects(
    () => erstelleCheckout({ nutzer: "u", plan: "scale", takt: "jahr", erfolgUrl: "https://x/ok", abbruchUrl: "https://x/nein" }),
    /Jahrespreis/i
  );
  assert.equal(mockCheckoutAntwort.letzterAufruf, undefined, "kein Stripe-Aufruf");
});

test("preisFuer trennt die beiden Takte sauber", () => {
  assert.equal(preisFuer("start", "monat"), "price_start_1");
  assert.equal(preisFuer("start", "jahr"), "price_start_jahr");
  assert.notEqual(preisFuer("grow", "monat"), preisFuer("grow", "jahr"));
});

test("STRIPE_API_KEY gilt genauso wie STRIPE_SECRET_KEY", () => {
  // Die Stripe-CLI und der Stripe-MCP-Server nutzen STRIPE_API_KEY. Genau
  // daran lag die Bezahlung zuletzt still: Der Schluessel war eingetragen,
  // nur unter dem anderen Namen, und der Checkout antwortete "noch nicht
  // eingerichtet" — ohne einen Hinweis, woran es liegt.
  //
  // Das Modul liest SECRET beim Laden, deshalb hier ein frischer Require aus
  // dem Cache heraus statt einer Aenderung an process.env im laufenden Modul.
  const pfad = require.resolve("../netlify/functions/lib/stripe");
  const gemerkt = { secret: process.env.STRIPE_SECRET_KEY, api: process.env.STRIPE_API_KEY };
  try {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_API_KEY = "sk_test_ueber_den_anderen_namen";
    delete require.cache[pfad];
    const frisch = require("../netlify/functions/lib/stripe");
    assert.equal(frisch.konfiguriert(), true, "Schluessel unter STRIPE_API_KEY muss zaehlen");
  } finally {
    process.env.STRIPE_SECRET_KEY = gemerkt.secret;
    if (gemerkt.api === undefined) delete process.env.STRIPE_API_KEY;
    else process.env.STRIPE_API_KEY = gemerkt.api;
    delete require.cache[pfad];
    require("../netlify/functions/lib/stripe");
  }
});
