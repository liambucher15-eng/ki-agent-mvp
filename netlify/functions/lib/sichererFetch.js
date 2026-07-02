// SSRF-Schutz für serverseitige Fetches (Webseiten-Scan).
// Ohne Schutz könnte jemand unsere Server dazu bringen, interne/Cloud-interne
// Adressen abzurufen (z.B. 169.254.169.254 = Cloud-Metadaten). Deshalb:
//   - nur http/https,
//   - Ziel-Hostname wird per DNS aufgelöst und gegen private/reservierte
//     IP-Bereiche geprüft,
//   - Weiterleitungen werden NICHT automatisch gefolgt, sondern Schritt für
//     Schritt selbst geprüft (sonst umgeht ein Redirect die Prüfung).

const dns = require("dns").promises;

function ipV4Privat(ip) {
  const teile = ip.split(".").map(Number);
  if (teile.length !== 4 || teile.some((n) => Number.isNaN(n))) return true; // unklar -> lieber blockieren
  const [a, b] = teile;
  if (a === 0) return true;                         // 0.0.0.0/8
  if (a === 10) return true;                        // 10.0.0.0/8
  if (a === 127) return true;                       // 127.0.0.0/8 (localhost)
  if (a === 169 && b === 254) return true;          // 169.254.0.0/16 (link-local + Cloud-Metadaten)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;// 100.64.0.0/10 (CGNAT)
  if (a === 192 && b === 0) return true;            // 192.0.0.0/24 + 192.0.2.0/24
  if (a >= 224) return true;                        // Multicast/reserviert (224–255)
  return false;
}

function ipPrivat(addr, family) {
  const ip = String(addr).toLowerCase();
  if (family === 4) return ipV4Privat(ip);
  // IPv6
  if (ip === "::1" || ip === "::") return true;                 // loopback / unspecified
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;  // fc00::/7 (unique local)
  if (ip.startsWith("fe80")) return true;                       // fe80::/10 (link-local)
  const v4mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);    // IPv4-mapped
  if (v4mapped) return ipV4Privat(v4mapped[1]);
  return false;
}

async function pruefeHostSicher(hostname) {
  if (/^localhost$/i.test(hostname)) throw new Error("Blockierte Ziel-Adresse");
  let adressen;
  try { adressen = await dns.lookup(hostname, { all: true }); }
  catch { throw new Error("DNS-Auflösung fehlgeschlagen"); }
  if (!adressen.length) throw new Error("DNS-Auflösung fehlgeschlagen");
  for (const a of adressen) {
    if (ipPrivat(a.address, a.family)) throw new Error("Blockierte Ziel-Adresse (privat/intern)");
  }
}

const STD_UA = "Mozilla/5.0 (compatible; KI-Agent-Scanner/1.0)";

// Wie fetch, aber SSRF-geprüft. Folgt Weiterleitungen selbst (max 3) und prüft jede.
async function sichererFetch(startUrl, { timeout = 8000, headers = {} } = {}) {
  let url = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    let u;
    try { u = new URL(url); } catch { throw new Error("Ungültige URL"); }
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Nur http/https erlaubt");
    await pruefeHostSicher(u.hostname);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(u.href, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "user-agent": STD_UA, ...headers },
      });
    } finally { clearTimeout(t); }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      url = new URL(loc, u).href; // relativ zum aktuellen Ziel auflösen, dann neu prüfen
      continue;
    }
    return res;
  }
  throw new Error("Zu viele Weiterleitungen");
}

module.exports = { sichererFetch, ipPrivat, ipV4Privat };
