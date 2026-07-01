# Design-Ideen (Sammlung)

> Liams Ideen für das Design. **Nur merken, nicht umsetzen.** Erst umsetzen/vergleichen,
> wenn Liam ausdrücklich „vergleichen" (oder „umsetzen") sagt.
>
> **Ordnung:** Gleiches immer am selben Ort — Ideen sind nach Thema gruppiert
> (Onboarding, Agent-Darstellung, …). Neue Ideen jeweils unter den passenden Abschnitt.

---

# ⭐ DIE KERNIDEE (alle Ideen zusammengeführt)

> Synthese aus allen gesammelten Ideen (O1–O4, A1–A3, S0–S3). Das ist der Leitstern.
> Einzelne Ideen unten bleiben als Detail-Referenz erhalten.

## Der Leitsatz
> **„Ruhiges Vertrauen mit einem lebendigen Funken."**

Das Produkt muss zwei Dinge gleichzeitig sein: **vertrauenswürdig** (B2B, Firmen geben
dem Agenten ihre Kundenkommunikation) und **nahbar/menschlich** (es ist ein Concierge,
kein kaltes Tool). Die ganze Gestaltung löst genau diesen Spannungsbogen:
**Ruhe trägt, ein warmer Funke lebt darin.**

## 1. Die Welt: clean + warm (nicht laut, nicht kalt)
- Überwiegend **hell, viel Weissraum, fette klare Typo** (Maeve-Eleganz).
- Lebendigkeit kommt aus **weichen Indigo→Coral-Verläufen** (Blobs/Aurora), aber **dosiert**:
  → **60-30-10** — 60 % Ruhe (weiss/grau), 30 % Indigo (tragend), **10 % Orange (Funke)**.
- „Enblox = Energie, Maeve = Eleganz" → mutiger Verlauf, zurückhaltend eingesetzt.
- Quelle: [S0](#s0--farbpalette-plattform-marke--gefällt-liam) · [S2](#s2--aurora-blob-verläufe-in-eigenen-farben) · [S3](#s3--landingpage-vibe-mutige-gradients--bold-typo-in-eigenen-farben)

## 2. Die Farbe
- **Indigo `#4F46E5`** (Vertrauen + KI) · **Orange `#F97316` / Coral `#FB923C`** (Wärme/Funke)
  · Neutral warm-weiss `#FAFAF9`, Text `#111827`.
- **Der Verlauf (Indigo→Coral) ist der rote Faden** — als Hintergrund-Flächen, als
  **Produkt-Highlight-Bilder** und als Akzente. Sparsam einsetzen, nicht jeder Screen braucht ihn.
- ⚠️ **Die Orb ist NICHT die Onboarding-Deko.** Sie ist nur eine der zwei Agent-Darstellungen
  (Modell B, §3). Im Onboarding arbeiten wir mit **Verlaufs-/Bildflächen + Produkt-Präsentation**,
  nicht mit einer Kugel auf jedem Screen.

## 3. Der Agent: ZWEI Modelle zur Auswahl (Produkt-Feature)
Die Firma wählt im Onboarding zwischen zwei Agent-Typen — **beide gleichwertig**:

- **Modell A — Maskottchen:** figürlicher Charakter (z.B. Salbei via Higgsfield),
  reagiert in Zuständen (idle/denken/sprechen/verlegen).
  - **Stil-Optionen fürs Maskottchen:** poliert/3D *oder* handgezeichnet ([S1](#s1--handgezeichnet--illustrierter-vibe), „menschlich").
  - **Anordnung für mehr Aufmerksamkeit** ([A3](#a3--anordnung-des-maskottchens-mehr-aufmerksamkeit)): gross oben im
    Glow-Ring als Hero + klein als Avatar neben jeder Bot-Nachricht.
- **Modell B — Farbkugel (Orb):** abstrakte **leuchtende Kugel** im Indigo→Coral-Verlauf,
  die beim Denken/Sprechen **pulsiert & leuchtet** ([A1](#a1--glow-bar-oder-sprechende-kugel) + [A2](#a2--kugel-im-cleanen-chat-fenster)).
  Der „cleane, abstrakte" Agent ohne figürliches Maskottchen.
- **Gemeinsame Klammer:** beide leben im selben Look (Indigo/Orange, Gradient, Wärme).
  Die Orb ist zugleich die **Default-/Plattform-Identität**, wenn eine Firma kein eigenes
  Maskottchen erstellt.

## 4. Das Onboarding
- **Split-Screen** (O1): eine Seite **Fragen/Formular**, die andere Seite eine grosse
  **Verlaufs-/Bildfläche zur Produkt-Präsentation** — den freien Platz (v.a. Desktop) nutzen,
  um das Produkt zu highlighten (Feature-Bild, Vorschau, kurze Vorteile), [O8](#o8--produkt-highlight-fläche-freien-platz-nutzen). **Keine Orb hier.**
- Oben ein **Schritt-Pfad/Stepper** (O2) — fertig ✓ / aktiv / offen.
- Light als Standard; **Dark-Variante** (O4, „Get Started"-Look) als Option im Hinterkopf.
- **Eigener Schritt „Design-Anpassung"** ([O5](#o5--design-anpassung-an-die-kunden-webseite-kernzweck)): der Kunde stellt **die Farben + Schrift
  seiner EIGENEN Webseite** ein (idealerweise per Auto-Erkennung aus der URL), damit der
  Agent sich **nahtlos in die Kundenseite einfügt** statt „reingeklatscht" zu wirken.
  Plattform-Look ist nur der Startwert. Mit Live-Vorschau.
- Quelle: [O1](#o1--split-screen-layout-basis-richtung) · [O2](#o2--schritt-pfad--stepper-oben) · [O3](#o3--verfeinerung-des-split-layouts-gefällt-sehr-gut) · [O4](#o4--dunkle-variante-mit-schritt-karten) · [O5](#o5--design-anpassung-an-die-kunden-webseite-kernzweck)

## 5. Zwei Ebenen — WICHTIG nicht verwechseln
- **Plattform-Marke** (Liams Produkt: Onboarding, Landingpage, Default-Agent):
  → fix **Indigo/Orange + Orb + Gradient-Vibe**. Das ist *deine* Identität.
- **Kunden-Agent** (das eingebettete Widget pro Firma):
  → **Firmenfarbe** überschreibt alles; Charakter pro Firma (Orb als Default,
  oder eigenes Maskottchen wie Salbei via Higgsfield). Deine Marke bleibt dezent („mit KI-Agent").

## In einem Satz
**Eine helle, ruhige, vertrauensvolle Oberfläche (Indigo + viel Weiss), in der warme
Indigo→Coral-Verläufe als wiederkehrende Geste leben — als Hintergrund-Flächen und als
Produkt-Highlight-Bilder, sparsam dosiert (60-30-10). Die leuchtende Orb ist die Agent-Figur,
nicht die Deko.**

---

# 🎬 ONBOARDING

## O1 — Split-Screen-Layout (Basis-Richtung)
**Referenz:** Remote.com Sign-up

- **~1/3 links:** Fläche mit **Farbverlauf (Gradient)** — Branding, evtl. kleine Vorschau-Karten.
- **~2/3 rechts:** die **Fragen / das Formular** auf hellem Grund (Welcome-Headline oben,
  Felder darunter, CTA unten).
- Wirkung: clean, modern, freundlich — Fragen im Fokus, Marke links präsent.

## O2 — Schritt-Pfad / Stepper oben
**Referenz:** Checkout-Stepper (Account ✓ → Shipping ② → Payment ③)

- **Horizontaler Pfad mit nummerierten Kreisen**, durch Linien verbunden.
- Zustände: **fertig** (gefüllt + Häkchen ✓), **aktiv** (Nummer, farbiger Rand + Label),
  **offen** (grau). Linie: erledigter Teil farbig, Rest grau.
- Stil noch **unklar** — Richtung, nicht final.

## O3 — Verfeinerung des Split-Layouts (gefällt sehr gut)
**Referenz:** oranges „Create an account" + blaues „Login to your account"

- Baut auf **O1** auf, zwei Detail-Varianten:
  - **Text über Verlaufsbild** (orange Ref): neben/hinter dem Formular eine **Bildfläche
    mit Farbverlauf**, darüber eine leicht durchscheinende Text-/Testimonial-Karte (Glas-Optik).
  - **Weicher Verlaufs-Hintergrund** (blaue Ref): weisse Formular-Karte zentriert auf
    einem **sanften, ganzflächigen Verlauf** (statt harter 1/3-Teilung).

## O4 — Dunkle Variante mit Schritt-Karten
**Referenz:** „Get Started with Us" (dunkel/grün)

- Wieder **Split** (vgl. O1): **links Verlaufsfläche** mit Headline „Get Started with Us"
  + kurzem Text, **rechts das Formular** auf dunklem Grund.
- Besonderheit: die Schritte als **Karten** dargestellt (1 / 2 / 3 nebeneinander),
  der **aktuelle Schritt hervorgehoben** (hell/weiss), die nächsten gedämpft.
- Kombiniert O1 (Split) + O2 (Schrittanzeige) — nur als Karten statt als Pfad. Dark-Mode-Option.

## O5 — Design-Anpassung an die KUNDEN-Webseite (Kernzweck!)
**Wichtig:** Der Agent passt sich **NICHT** an Liams Plattform-Design an, sondern **an die
Webseite, auf die er eingebettet wird** (die Seite des Kunden). Ziel: Der Agent sieht aus,
als wäre er **ein nativer Teil genau dieser Webseite** — nicht „reingeklatscht".

- Eigener Onboarding-Schritt: der **Kunde stellt das Design seiner eigenen Webseite ein**,
  damit der Agent sich dort einfügt.
- Einstellbar (= die Stilmerkmale der Kundenseite nachbilden):
  - **Farben der Kundenseite** — Primär + Akzent (färbt Bubble, Header, Buttons, Links, Glow).
  - **Schriftart der Kundenseite** — gängige Web-Fonts wählen.
  - **Form/Eck-Radius** (rund vs. kantig) + **Position** der Bubble (rechts/links unten).
- **Live-Vorschau:** Änderungen sofort am Agenten sichtbar.
- **Auto-Erkennung (stark!):** aus der **URL der Kundenwebseite** Farben + Schrift automatisch
  auslesen und vorschlagen → der Kunde muss kaum etwas tippen, der Agent matcht sofort.
- Liams Plattform-Look (Indigo/Orange, Orb-Default) ist nur der **Startwert**, bevor der
  Kunde anpasst — am Ende zählt allein das Design der Kundenseite.
- Technischer Bezug: speist die Style-Felder der Firma; heute gibt es nur einen einfachen
  Farb-Picker (onboarding.html Schritt 2) — das hier ist der **Ausbau** dazu.

## O7 — Dokumente hochladen (Menükarte, Preisliste …)
**Idee:** Zusätzlich zum Webseiten-Scan kann der Kunde **wichtige Dateien hochladen**
(z.B. Menükarte, Preisliste, Broschüre) — gerade Infos, die nicht (gut) auf der Webseite stehen.

- **Technik:** Claude liest **Bilder (Foto/PNG/JPG) und PDFs direkt** (Vision/Document) →
  extrahiert den Inhalt (z.B. alle Gerichte mit Preisen) → kommt ins `wissen` des Agenten.
- **Platzierung:** im „Überprüfen & Ergänzen"-Schritt (ergänzt die gescannten Infos).
- **Formate:** .txt/.md (im Browser ausgelesen), PDF + Bilder (Backend `dokument-lesen.js` via Claude).
- **Grenze:** Dateigröße ~4,5 MB (Function-Body-Limit); Bilder ggf. vorher verkleinern.

## O6 — „Scan-First"-Onboarding (Webseite lesen statt tippen) ⭐ KERN-FLOW
**Idee:** Nach der E-Mail gibt der Kunde **nur seine Webseite-URL** ein. Die KI **scannt
die Webseite**, extrahiert automatisch alle Infos (Firmenname, Angebot, wichtige Inhalte)
**und die Farben**, und speichert sie. Der Kunde muss danach nur noch **überprüfen & ergänzen**.

- **Ablauf:** Anmelden → **URL eingeben** → **KI scannt** (Lade-Animation) →
  **Überprüfen & Ergänzen** (alles vorausgefüllt) → **Anpassen** (Farben auto-erkannt, später änderbar) → Fertig.
- **Wichtig:** Der Agent **orientiert sich nur an der Webseite** — keine Halluzinationen,
  nur was wirklich auf der Seite steht (passt zu „erfinde nichts" im System-Prompt).
- **Farben** werden beim Scan miterkannt und im Anpassen-Schritt vorausgefüllt;
  **jederzeit änderbar** (vgl. [O5](#o5--design-anpassung-an-die-kunden-webseite-kernzweck)).
- **Vorteil:** minimaler Aufwand für den Kunden = „magisches" Onboarding, hoher Aha-Effekt.
- **Technik (Backend, noch zu bauen):** Netlify-Function `scan.js` → Webseite(n) per `fetch`
  holen, Text extrahieren, an Claude geben („extrahiere Name, Angebot, Infos, FAQ"),
  Farben aus dem HTML/CSS lesen → strukturiert in der Firma speichern.
  Realistisch: Startseite + wichtige Unterseiten (Über uns, Kontakt), nicht die ganze Seite komplett.

---

## O8 — Produkt-Highlight-Fläche (freien Platz nutzen)
**Referenz:** Revolut-artiges Sign-in (links Formular, rechts grosse Bild-/Verlaufsfläche)
+ „For desktop login forms you have ample space for product presentation."

- **Statt überall eine Orb:** den freien Platz (besonders auf Desktop) nutzen, um **das Produkt
  zu highlighten** — eine grosse **Verlaufs-/Bildfläche** neben dem Formular.
- Inhalt dieser Fläche kann sein: ein schönes **abstraktes Verlaufsbild**, eine **Produkt-Vorschau**
  (Mini-Chat/Agent in Aktion), **Feature-Stichpunkte**, ein **Testimonial** oder eine kurze Nutzen-Liste.
- **Verläufe sind die Design-Sprache** hier (Indigo→Coral / Aurora), nicht die Kugel.
- Mobile: Fläche schrumpft/entfällt, Formular zuerst. Desktop: Split ~ 50/50 oder 40/60.
- Bezug: schärft [O1](#o1--split-screen-layout-basis-richtung)/[O3](#o3--verfeinerung-des-split-layouts-gefällt-sehr-gut) — die „andere Hälfte" ist **Produkt-Marketing**, kein Deko-Element.

---

# ⚙️ AGENT-VERHALTEN / FUNKTIONEN

## F1 — Live-Nachschlagen auf der eigenen Webseite (bei Wissenslücke)
**Idee:** Wenn der Agent eine Frage NICHT aus den Onboarding-Infos beantworten kann,
darf er **live auf die Firmen-Webseite zugreifen** und dort nachsehen — aber
**AUSSCHLIESSLICH auf die eigene Webseite**, keine andere Quelle.

- **Technik:** Claude **Tool-Use**. Werkzeug `webseite_nachschlagen(thema)` im `chat.js`.
  System-Prompt: „Wenn du es nicht weisst, nutze das Werkzeug — nutze NUR diese Quelle."
- **Sperre „nur eigene Webseite":** Domain-Whitelist — das Werkzeug darf nur die beim
  Onboarding gespeicherte Firmen-Domain abrufen, jede andere URL wird hart abgelehnt.
- **Verhältnis zum Onboarding-Scan ([O6](#o6--scan-first-onboarding-webseite-lesen-statt-tippen--kern-flow)):**
  Scan = einmalige schnelle Basis; Live-Nachschlagen = Fallback für Lücken + hält den
  Agenten aktuell (geänderte Preise/Angebote) ohne erneutes Onboarding.
- **Trade-offs:** langsamer + teurer bei solchen Antworten (nur wenn nachgeschlagen wird);
  mit Cache abmildern. Passt zur „erfinde nichts"-Regel: lieber kurz nachsehen als raten.

---

# 🤖 AGENT-DARSTELLUNG (Chat / Avatar)

## A1 — Glow-Bar oder sprechende Kugel
**Referenz:** „Ask anything"-Bar mit Aurora-Glow + leuchtende Farbverlauf-Kugel (Orb)

- **Variante A — Glow-Bar:** Eingabe-/Chat-Bar mit weichem **farbigem Glow/Aurora** rundherum.
- **Variante B — sprechende Kugel:** Agent als **leuchtende Orb mit Farbverlauf**, reagiert
  beim Sprechen (pulsiert/leuchtet) — Alternative zum Maskottchen.
- „Vielleicht / ganz anders möglich" — offene Richtung.

## A2 — Kugel im cleanen Chat-Fenster
**Referenz:** „AI Chat" — Neo AI (Orb mittig im weissen Karten-Chat)

- Bestätigt die **Kugel-Richtung** (vgl. A1, Variante B): kleine **leuchtende Orb**
  (Orange/Pink-Glow) **mittig** im Chat-Fenster als Agent-Präsenz.
- Drumherum **sehr clean**: weisse Karte, Begrüssungstext unter der Kugel, unten eine
  abgesetzte Eingabe-Bar mit Icons (+ / Suche / Mikrofon / Senden-Pfeil).
- Wirkung: ruhig, modern, Kugel als ruhiger Mittelpunkt statt Maskottchen.

## A3 — Anordnung des Maskottchens (mehr Aufmerksamkeit)
**Referenz:** „Omniscient chatbot" (Maskottchen gross oben im Glow-Ring, dunkles UI)

> **Kein eigener Charakter** — sondern ein **Layout-/Anordnungs-Muster** für Modell A
> (Maskottchen), damit es mehr Aufmerksamkeit zieht. Gilt unabhängig vom Charakter-Stil.

- Maskottchen **gross oben im Kreis mit Glow-Ring** (Hero-Platzierung, sofort sichtbar)
  + zusätzlich **klein als Avatar** neben jeder Bot-Nachricht (Wiedererkennung im Verlauf).
- Layout: klassische Bubbles (User farbig rechts, Bot links), Avatar oben als „Persönlichkeit".
- Die Glow-Ring-Idee passt zur Marke (Indigo→Coral-Verlauf als Ring um das Maskottchen).

---

# 🎨 STIL / VIBE (übergreifende Richtung)

## S0 — Farbpalette (Plattform-Marke) ✅ gefällt Liam
> Liam will sie noch auf Coolors gegenchecken — Richtung steht aber.

**Logik:** 1 Primärfarbe (Vertrauen) + 1 Akzent (Energie/Wärme) + Neutrale. Mehr nicht.
Die dunklen/hellen Töne sind nur Abstufungen derselben Farbe, keine Extra-Farben.

| Rolle | Farbe | Hex |
|-------|-------|-----|
| Primär (Buttons, Links, Marke) | Indigo | `#4F46E5` |
| Primär dunkel (Headlines, Hover) | Tief-Indigo | `#3730A3` |
| Akzent (Highlight, CTA, Glow) | Warm-Orange | `#F97316` |
| Akzent weich (Verläufe/Glow) | Coral | `#FB923C` |
| Hintergrund | Warm-Weiss | `#FAFAF9` |
| Text | Fast-Schwarz | `#111827` |
| Text sekundär | Grau | `#6B7280` |

- Coolors: `https://coolors.co/4f46e5-3730a3-f97316-fafaf9-111827`
- Schönster Verlauf (für Glow/Orb/Blobs): **Indigo → Coral** (`#4F46E5` → `#FB923C`).
- **Einsatz-Regel 60-30-10:** 60 % Neutral (Flächen), 30 % Indigo (tragend),
  **10 % Orange (nur Akzente — sparsam, sonst verliert es die Wirkung).**
- Merksatz: *Eine Farbe zum Vertrauen (Indigo), eine zum Zeigen (Orange), der Rest ist Ruhe.*
- Hinweis: gilt für **Onboarding + Plattform-Marke**. Der eingebettete Kunden-Agent
  bekommt pro Firma eigene Farben (überschrieben).

## S2 — Aurora-/Blob-Verläufe (in EIGENEN Farben)
**Referenz:** zwei Poster — „WE CREATE BEST DIGITAL PRODUCTS" + „about us"
(weicher leuchtender Verlaufs-Blob auf cremefarbenem Grund, grosse Bold-Typo daneben)

- **Gefällt Liam** — aber **in seinen Farben** (Indigo/Orange/Coral), nicht im Original-Pink.
- Look: grosser, weicher, **diffuser Farb-Blob** (wie eine leuchtende Wolke/Aurora) auf
  hellem, fast neutralem Grund; daneben/darüber **grosse, fette Typografie** in Fast-Schwarz.
- Passt direkt zu **S0** (Indigo→Coral-Verlauf) und zur **Orb-Idee (A1/A2)** — derselbe
  Verlauf, einmal als Hintergrund-Blob, einmal als Agent-Kugel.
- Mögliche Anwendung: Hero/Onboarding-Hintergrund, leere Chat-Fläche, Marketing-Seite.

## S3 — Landingpage-Vibe: mutige Gradients + Bold-Typo (in EIGENEN Farben)
**Referenz:** Enblox/Frameblox („Work Smarter", „Ready to Reclaim Your Time?") + Maeve (Design-Studio)

- **Gefällt Liam** — passt gut, **in seinen Farben** (Indigo/Orange/Coral statt Pink/Magenta).
- Sprache: grosse weiche **Verlaufsflächen**, viel Weissraum, **fette Typo** (teils Serif-Akzente),
  **Gradient-Karten** (Feature-Kacheln mit Verlaufs-Hintergrund), farbige Tags.
- **Wichtige Anpassung (sonst kippt es):** diese Refs nutzen Gradient *vollflächig/laut* →
  okay für Consumer-Apps, aber Liams Produkt ist **B2B/Vertrauen**. Darum **60-30-10 anwenden**
  (vgl. [S0](#s0--farbpalette-plattform-marke--gefällt-liam)): Gradient nur als **10 %-Statement**
  (Hero, EINE CTA-Sektion, Agent-Orb), Rest ruhig (weiss, Luft, schwarze Typo).
- Merksatz: **„Enblox = die Energie, Maeve = die Eleganz."** → mutiger Gradient-Look von Enblox,
  aber die zurückhaltende Dosierung von Maeve (überwiegend weiss, Gradient als Akzent).
- Bonus: Indigo ist kühler als das Pink der Vorlagen → wirkt automatisch **seriöser**, passt zum KI-Tool.

## S1 — Handgezeichneter / illustrierter Vibe
**Referenz:** „Cool Cat's" Coffee-App (blau/creme, gezeichnete Strich-Figuren, handschriftlicher Look)

- Komplett andere Richtung als die cleane Orb-/Glow-Welt: **handgezeichnete Illustrationen**
  (Strich-Charaktere, Doodle-Stil), **handschrift-artige Schrift**, warme Cremetöne + kräftige
  Markenfarbe.
- **Ziel: menschlich, nahbar, mit Charakter** — wirkt weniger „tech", mehr persönlich.
- Mögliche Anwendung: gezeichneter Agent-Charakter statt Kugel/Maskottchen + illustrierte
  Onboarding-Screens (vgl. „Cool Cat's Club"-Screen mit Doodle).
- **Konkurriert** mit der Kugel-Richtung (A1/A2) — zwei gegensätzliche Stil-Welten,
  Entscheidung noch offen.


