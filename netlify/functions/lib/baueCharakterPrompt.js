// Baut die Bild-Prompts für die 4 Charakter-Zustände aus der Firmen-Eingabe.
// EINE Stilklammer sorgt dafür, dass alle 4 Ausdrücke dieselbe Figur zeigen.
// Wird jetzt vom Platzhalter-Generator vorbereitet und SPÄTER von der echten
// Bild-API (Higgsfield) unverändert genutzt.

function baueCharakterPrompt({ beschreibung, farbe } = {}) {
  const stil =
    `Ein einfaches, freundliches Maskottchen. ${beschreibung || "rundes, sympathisches Wesen"}. ` +
    `Flacher, stilisierter Cartoon-Stil, klare Konturen, einfarbiger heller Hintergrund, ` +
    `Hauptfarbe ${farbe || "#3f7d5a"}. Immer dieselbe Figur, gleiche Proportionen, zentriert.`;

  const ausdruecke = {
    idle: "neutraler, freundlicher Ruheausdruck, leichtes Lächeln, schaut nach vorne",
    denken: "nachdenklicher Ausdruck, Blick nach oben, Hand am Kinn",
    sprechen: "offener Mund beim Sprechen, lebhaft und einladend",
    verlegen: "verlegen, leicht errötet, schaut zur Seite, entschuldigendes Lächeln",
  };

  const prompts = {};
  for (const [zustand, ausdruck] of Object.entries(ausdruecke)) {
    prompts[zustand] = `${stil} Ausdruck: ${ausdruck}.`;
  }
  return { stil, prompts };
}

module.exports = { baueCharakterPrompt };
