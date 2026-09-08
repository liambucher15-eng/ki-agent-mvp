// Tests für die serverseitige Clerk-Prüfung — sicherheitskritisch:
// ein gefälschtes oder fremdes Token darf NICHT durchkommen.
//
// Hier wird ein eigenes RSA-Schlüsselpaar erzeugt und ein JWKS-Endpunkt
// vorgetäuscht (globales fetch überschrieben). Das echte Clerk wird also nie
// aufgerufen; geprüft wird nur unsere eigene Logik.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const HERAUSGEBER = "https://loyal-marmot-61.clerk.accounts.dev";

// Env VOR dem Require setzen — das Modul liest sie beim Laden.
process.env.CLERK_ISSUER = HERAUSGEBER;
const { pruefeToken, holeToken, ausPublishableKey } =
  require("../netlify/functions/lib/anmeldung");

// ── Schlüsselpaar und gefälschter JWKS-Endpunkt ─────────────────────────────

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-schluessel-1";

const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };

// Ein zweites Paar für den Fall "richtige kid, falsche Signatur".
const fremd = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

let jwksAufrufe = 0;
global.fetch = async (url) => {
  jwksAufrufe++;
  if (String(url).startsWith(HERAUSGEBER)) {
    return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

// ── Hilfsmittel: Token bauen ────────────────────────────────────────────────

function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function baueToken(nutzlast, optionen) {
  const o = optionen || {};
  const kopf = { alg: o.alg || "RS256", typ: "JWT", kid: o.kid === undefined ? KID : o.kid };
  const jetzt = Math.floor(Date.now() / 1000);
  const voll = { iss: HERAUSGEBER, sub: "user_abc123", exp: jetzt + 60, ...nutzlast };
  const daten = b64(kopf) + "." + b64(voll);
  if (o.ohneSignatur) return daten + ".";
  const key = o.falscherSchluessel ? fremd.privateKey : privateKey;
  const sig = crypto.sign("sha256", Buffer.from(daten, "utf8"), key).toString("base64url");
  return daten + "." + sig;
}

// ── Der gute Fall ───────────────────────────────────────────────────────────

test("gültiges Token -> Nutzer-ID kommt zurück", async () => {
  const nutzer = await pruefeToken(baueToken({}));
  assert.equal(nutzer, "user_abc123");
});

// ── Die Fälle, die abgelehnt werden müssen ──────────────────────────────────

test("abgelaufenes Token -> abgelehnt", async () => {
  const jetzt = Math.floor(Date.now() / 1000);
  await assert.rejects(() => pruefeToken(baueToken({ exp: jetzt - 3600 })), /abgelaufen/i);
});

test("falsch signiertes Token -> abgelehnt", async () => {
  await assert.rejects(
    () => pruefeToken(baueToken({}, { falscherSchluessel: true })),
    /Signatur ungültig/i
  );
});

test("manipulierte Nutzlast -> abgelehnt", async () => {
  // Signatur eines echten Tokens behalten, aber die Nutzer-ID austauschen.
  const echt = baueToken({ sub: "user_opfer" });
  const [kopf, , sig] = echt.split(".");
  const gefaelscht = kopf + "." + b64({ iss: HERAUSGEBER, sub: "user_angreifer",
    exp: Math.floor(Date.now() / 1000) + 60 }) + "." + sig;
  await assert.rejects(() => pruefeToken(gefaelscht), /Signatur ungültig/i);
});

test('alg "none" -> abgelehnt (klassisches JWT-Loch)', async () => {
  await assert.rejects(
    () => pruefeToken(baueToken({}, { alg: "none", ohneSignatur: true })),
    /Unerlaubtes Verfahren/i
  );
});

test('alg "HS256" -> abgelehnt (öffentlicher Schlüssel als HMAC-Geheimnis)', async () => {
  const kopf = b64({ alg: "HS256", typ: "JWT", kid: KID });
  const nutzlast = b64({ iss: HERAUSGEBER, sub: "user_x", exp: Math.floor(Date.now() / 1000) + 60 });
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const sig = crypto.createHmac("sha256", pem).update(kopf + "." + nutzlast).digest("base64url");
  await assert.rejects(() => pruefeToken(kopf + "." + nutzlast + "." + sig), /Unerlaubtes Verfahren/i);
});

test("fremder Herausgeber -> abgelehnt", async () => {
  await assert.rejects(
    () => pruefeToken(baueToken({ iss: "https://boese-instanz.clerk.accounts.dev" })),
    /Fremder Herausgeber/i
  );
});

test("unbekannte kid -> abgelehnt", async () => {
  await assert.rejects(() => pruefeToken(baueToken({}, { kid: "gibt-es-nicht" })), /Unbekannter Schlüssel/i);
});

test("Token ohne sub -> abgelehnt", async () => {
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = b64({ alg: "RS256", typ: "JWT", kid: KID });
  const nutzlast = b64({ iss: HERAUSGEBER, exp: jetzt + 60 });
  const daten = kopf + "." + nutzlast;
  const sig = crypto.sign("sha256", Buffer.from(daten, "utf8"), privateKey).toString("base64url");
  await assert.rejects(() => pruefeToken(daten + "." + sig), /Keine Nutzer-ID/i);
});

test("Unsinn statt Token -> abgelehnt", async () => {
  await assert.rejects(() => pruefeToken("nicht.mal.ein-jwt"), /./);
  await assert.rejects(() => pruefeToken(""), /drei Teile/i);
  await assert.rejects(() => pruefeToken(null), /drei Teile/i);
});

// ── Header lesen ────────────────────────────────────────────────────────────

test("holeToken liest den Authorization-Header", () => {
  assert.equal(holeToken({ headers: { authorization: "Bearer abc.def.ghi" } }), "abc.def.ghi");
  assert.equal(holeToken({ headers: { Authorization: "bearer  xyz" } }), "xyz");
  assert.equal(holeToken({ headers: {} }), "");
  assert.equal(holeToken({ headers: { authorization: "Basic abc" } }), "");
  assert.equal(holeToken({}), "");
});

// ── Herausgeber aus dem Publishable Key ─────────────────────────────────────

test("ausPublishableKey liest die Clerk-Domain aus dem Key", () => {
  // Genau der Key, der in public/lib/clerk-config.js steht.
  assert.equal(
    ausPublishableKey("pk_test_bG95YWwtbWFybW90LTYxLmNsZXJrLmFjY291bnRzLmRldiQ"),
    "https://loyal-marmot-61.clerk.accounts.dev"
  );
  assert.equal(ausPublishableKey("pk_test_DEIN-KEY"), "");
  assert.equal(ausPublishableKey(""), "");
  assert.equal(ausPublishableKey(null), "");
});

// ── Der JWKS-Cache ──────────────────────────────────────────────────────────

test("JWKS wird zwischengespeichert, nicht bei jeder Anfrage geholt", async () => {
  const vorher = jwksAufrufe;
  await pruefeToken(baueToken({}));
  await pruefeToken(baueToken({}));
  await pruefeToken(baueToken({}));
  // Der Satz liegt aus den Tests davor schon im Cache — es darf kein
  // einziger neuer Abruf dazukommen.
  assert.equal(jwksAufrufe, vorher, "JWKS wurde erneut geholt, obwohl gecacht");
});
