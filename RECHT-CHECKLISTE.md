# Rechtliches vor dem Livegang

Diese Datei gehört zu den Entwürfen `public/impressum.html`,
`public/datenschutz.html` und `public/agb.html`. Sie listet auf, was noch fehlt,
und in welcher Reihenfolge es zusammengehört.

**Kein Rechtsrat.** Was hier steht, ist aus dem Code belegt oder allgemein
bekannte Pflicht. Die Formulierungen in AGB und Haftung gehören trotzdem einmal
zu jemandem, der dafür geradesteht.

---

## Schritt 1 — Die Angaben zusammentragen

Alles, was in den drei Seiten gelb markiert ist (`class="luecke"`). Suchen mit:

```bash
grep -c 'class="luecke"' public/impressum.html public/datenschutz.html public/agb.html
```

### Impressum

| Angabe | Warum |
|---|---|
| Firmierung | Einzelunternehmen „Liam Bucher“ oder eine GmbH — davon hängen Handelsregister und MwSt ab |
| Ladungsfähige Adresse | **Postfach genügt nicht.** Wer die Privatadresse nicht zeigen will, braucht eine Domiziladresse |
| E-Mail-Adresse | Pflicht. Der Chat mit Aura ersetzt sie nicht |
| Handelsregisternummer | Nur falls eingetragen, sonst Abschnitt streichen |
| MWST-Nummer | Nur falls pflichtig, sonst streichen — **siehe Warnung unten** |
| Verantwortliche Person | Name |

> **Achtung MwSt.** `preis.html` und `data/aurachat.json` schreiben an mehreren
> Stellen „inkl. MwSt.“. Wer nicht mehrwertsteuerpflichtig ist, darf keine
> ausweisen. Entweder MWST-Nummer im Impressum **und** „inkl. MwSt.“ auf der
> Preisseite — oder beides weg. Ein Widerspruch dazwischen ist angreifbar.

### Datenschutz

Der grösste Teil ist schon ausgefüllt und aus dem Code belegt. Offen:

| Angabe | Wo nachsehen |
|---|---|
| Region des Supabase-Projekts | Supabase → Project Settings → General |
| Region von Netlify | Netlify → Site configuration |
| Aufbewahrungsfrist Gespräche | Vorgabe 90 Tage, `FRIST_GESPRAECHE_TAGE` überschreibt |
| Aufbewahrungsfrist Kontaktanfragen | Vorgabe 365 Tage, `FRIST_KONTAKTE_TAGE` überschreibt |
| Aufbewahrungsfrist Zähler | Erledigt: 1 Tag NACH Ablauf des Zählfensters (`lib/aufbewahrung.js`) |
| Sind mit allen Diensten AVV geschlossen? | Siehe Liste unten |
| Google Fonts: bleiben oder selbst ausliefern? | Siehe unten |

> Die drei Fristen sind keine Formsache: Sie stehen in der Erklärung und müssen
> danach auch **wirklich** durchgesetzt werden. Der Code dafür ist da
> (`lib/aufbewahrung.js`), die Zahlen stehen dort in einer Konstante. Wer die
> Frist hier ändert, ändert sie auch dort.

### AGB

| Entscheidung | Wirkung |
|---|---|
| Nur B2B oder auch Privatpersonen? | Entscheidet über Widerrufsrecht, Konsumentenschutz und Gerichtsstand |
| Rückerstattung bei unterjähriger Kündigung? | Muss ausdrücklich drinstehen |
| Verfügbarkeit zusagen oder nicht? | Ohne eigenes Rechenzentrum ist „keine Zusage“ ehrlicher |
| Haftung für Agent-Antworten | **Kernstück, mit Anwalt.** Vorsatz und grobe Fahrlässigkeit lassen sich nicht ausschliessen |
| Gerichtsstand | Ort |

---

## Schritt 2 — Fremddienste: Auftragsverarbeitung prüfen

Für jeden dieser Dienste braucht es einen Auftragsverarbeitungsvertrag. Bei
allen sechs ist er im Konto anklickbar oder Teil der Nutzungsbedingungen — er
muss aber tatsächlich abgeschlossen sein.

| Dienst | Was dorthin geht | Ort | AVV geprüft am |
|---|---|---|---|
| Anthropic | Gesprächsverlauf, Firmenwissen, Text der Kundenseite | USA | |
| Google (Gemini) | Figurbeschreibung, hochgeladene Vorlagen | USA | |
| Supabase | Alle gespeicherten Daten | ? | |
| Netlify | Zugriffsdaten, alle Anfragen | ? | |
| Clerk | E-Mail, Passwort-Hash, Sitzungen | USA | |
| Stripe | Zahlungs- und Rechnungsdaten | USA / EU | |

Zusätzlich klären: Werden die Gesprächsdaten bei Anthropic zum Training
verwendet? (Bei der zahlenden API-Nutzung normalerweise nicht — das gehört
trotzdem bestätigt und in die Datenschutzerklärung.)

### Google Fonts

Die Seiten laden „Inter“ von `fonts.googleapis.com`. Dabei erfährt Google die
IP jedes Besuchers, noch bevor irgendetwas zugestimmt wurde.

Zwei Wege:

1. **Selbst ausliefern.** Schriftdateien nach `public/lib/schriften/` legen,
   `@font-face` in `seite.css`, die beiden `<link>` auf Google entfernen.
   Betrifft: `start.html`, `preis.html`, `kontakt.html`, `probe.html`,
   `404.html` und die drei neuen Rechtsseiten. Rund eine halbe Stunde, danach
   fällt der Abschnitt aus der Datenschutzerklärung weg — und die
   `font-src`-Zeile in der CSP wird enger.
2. **So lassen** und in der Datenschutzerklärung nennen. Ist zulässig, aber
   erklärungsbedürftig.

Empfehlung: Weg 1. Es ist der einzige Punkt auf dieser Liste, der Datenschutz
und Ladezeit gleichzeitig verbessert.

---

## Schritt 3 — Auftragsverarbeitungsvertrag für die eigenen Kunden

**Das ist der Punkt, den kein Video nennt und der trotzdem sicher kommt.**

Sobald ein Agent auf der Webseite eines Betriebs läuft, verarbeitet AuraChat
Daten von dessen Besuchern. Damit ist die Rollenverteilung:

- **Der Betrieb** ist Verantwortlicher.
- **AuraChat** ist Auftragsverarbeiter.

Der erste Kunde mit einer Rechtsabteilung fragt danach. Ohne AVV darf er den
Agenten streng genommen nicht einsetzen.

### Was hineingehört

1. **Gegenstand und Dauer** — Betrieb eines KI-Agenten auf der Webseite des
   Kunden, für die Laufzeit des Abos.
2. **Art der Daten** — Fragen und Antworten im Chat, aufgerufene Unterseite,
   freiwillig hinterlassene Kontaktdaten, IP-bezogene Zähler.
3. **Betroffene** — Besucher der Kundenwebseite.
4. **Weisungsrecht** — AuraChat verarbeitet nur auf Weisung des Kunden.
5. **Vertraulichkeit** — wer Zugriff hat.
6. **Technische Massnahmen** — hier lässt sich mit dem füllen, was wirklich da
   ist: Verschlüsselung unterwegs (HTTPS erzwungen) und im Ruhezustand
   (Supabase), Zugriffstrennung je Kunde über Row Level Security, Anmeldung mit
   signiertem Token serverseitig geprüft, Rate-Limits, Herkunftsprüfung der
   einbettenden Domain, SSRF-Schutz beim Webseiten-Scan.
7. **Unterauftragsverarbeiter** — die Liste aus Schritt 2. Der Kunde muss ihr
   zustimmen und über Änderungen informiert werden.
8. **Drittlandübermittlung** — USA, Standardvertragsklauseln.
9. **Unterstützung** bei Auskunft und Löschung.
10. **Löschung nach Vertragsende.**
11. **Meldung von Datenpannen** an den Kunden, mit Frist.

### Wie ausliefern

Am einfachsten als PDF zum Herunterladen im Dashboard, mit Ankreuzfeld beim
Abschluss. Das genügt für kleine Betriebe und macht aus einer Pflicht ein
Verkaufsargument: „AVV liegt bei.“

---

## Schritt 4 — Textbaustein für die Kunden

Der Kunde muss die Besucher **seiner** Webseite über den Agenten informieren.
Dieser Absatz gehört ins Dashboard, direkt neben die Einbau-Zeile, zum
Kopieren.

> **KI-Assistent**
>
> Auf dieser Webseite ist ein KI-Assistent eingebunden, den wir über AuraChat
> (<span>[Firmierung, Ort]</span>) betreiben. Wenn Sie den Assistenten
> anschreiben, werden Ihre Nachricht, die Antwort und die Adresse der gerade
> aufgerufenen Unterseite verarbeitet, um Ihre Frage zu beantworten. Zur
> Erzeugung der Antwort werden diese Angaben an Anthropic (USA) übermittelt.
> Hinterlassen Sie Name und E-Mail, verwenden wir diese nur, um Ihnen zu
> antworten. Der Assistent verfolgt Sie nicht über Webseiten hinweg und legt
> kein Profil an. Gespeichert werden die Gespräche für
> <span>[Frist]</span>. Rechtsgrundlage ist unser berechtigtes Interesse an
> einer guten Beratung (Art. 6 Abs. 1 lit. f DSGVO) beziehungsweise die
> Bearbeitung Ihrer Anfrage (lit. b).

---

## Schritt 5 — Umschalten (alles auf einmal)

Erst wenn die Texte wirklich stehen. Diese fünf Stellen gehören **zusammen**,
sonst widerspricht die Seite sich selbst:

1. **Die drei Seiten:** Entwurfs-Kasten (`<div class="entwurf-hinweis">`) und
   den HTML-Kommentar oben entfernen, alle `<span class="luecke">` durch die
   echten Angaben ersetzen.

2. **Die Footer** in `public/start.html`, `public/kontakt.html` und
   `public/preis.html`. Dort steht heute:

   ```html
   <li><span class="folgt">Impressum <em>folgt</em></span></li>
   <li><span class="folgt">Datenschutz <em>folgt</em></span></li>
   <li><span class="folgt">AGB <em>folgt</em></span></li>
   ```

   Ersetzen durch:

   ```html
   <li><a href="impressum.html">Impressum</a></li>
   <li><a href="datenschutz.html">Datenschutz</a></li>
   <li><a href="agb.html">AGB</a></li>
   ```

3. **`data/aurachat.json`** — an drei Stellen sagt der Agent heute ausdrücklich,
   dass es die Texte nicht gibt (Feld `grenzen`, Feld `Rechtliches`, und am Ende
   von `wissen` unter „WAS ES NOCH NICHT GIBT“). Solange das drinsteht,
   behauptet der Agent auf der eigenen Startseite das Gegenteil des Footers.

4. **`netlify.toml`** — die drei `X-Robots-Tag = "noindex"`-Blöcke für
   `/impressum.html`, `/datenschutz.html` und `/agb.html` löschen. Rechtsseiten
   müssen auffindbar sein.

5. **`public/sitemap.xml`** — die drei Seiten aufnehmen.

---

## Schritt 6 — Produktion bestätigen

Nicht rechtlich, aber derselbe Livegang. Aus dem Vault (`PROJEKT-aurachat.md`,
„Betrieb — was nirgends steht“) ist nichts davon geprüft.

- [ ] **Domain steht fest.** `public/robots.txt` und `public/sitemap.xml`
      schreiben `aurachat.ch` fest verdrahtet. Stimmt sie nicht, zeigt die
      Sitemap auf einen toten Host — schlimmer als keine Sitemap.
- [ ] **HSTS-Preload** in `netlify.toml` nachtragen, sobald die Domain steht
      und alle Subdomains per HTTPS laufen (steht dort auskommentiert mit
      Begründung).
- [ ] **Stripe im Live-Modus:** Live-Schlüssel gesetzt, Produktions-Webhook
      eingerichtet, Kundenportal auch live konfiguriert.
- [ ] **Alle sechs Stripe-Preis-IDs** als Netlify-Umgebungsvariable gesetzt.
      Fehlt ein Jahrespreis, schlägt der Kauf fehl — mit Absicht, siehe
      `.env.example`.
- [ ] **`CLERK_ISSUER`** als Netlify-Umgebungsvariable setzen:
      `https://loyal-marmot-61.clerk.accounts.dev` (steckt im Publishable Key).
      **Ohne diese Variable lehnen alle angemeldeten Funktionen ab** — das ist
      Absicht, siehe `netlify/functions/lib/anmeldung.js`.
- [ ] **`PLATTFORM_TAGESDECKEL`** setzen oder bewusst beim Vorgabewert lassen
      (`netlify/functions/lib/verbrauch.js`).
- [ ] **Budget-Alarme** bei Anthropic und Google AI Studio einrichten. Der
      Tagesdeckel im Code ist die zweite Bremse, nicht die erste.
- [ ] **Clerk-Dashboard prüfen:** Bot-Schutz aktiv, Sitzungsdauer, E-Mail-
      Bestätigung erzwungen.
- [ ] **Supabase:** Welche der elf `migration-*.sql` sind wirklich gelaufen?
      Fuer die Aufbewahrungsfristen braucht es KEINE neue Migration — sie laufen
      ueber den Service-Key gegen die bestehenden Tabellen.
- [ ] **Automatische Sicherung** der Datenbank aktiv (Supabase → Database →
      Backups). Steht auf keiner der Videolisten und wäre der teuerste Verlust.
- [ ] **Widget auf einer echten Kundendomain** einbetten und ausprobieren. Laut
      Vault nie live erprobt — und die neuen Sicherheits-Kopfzeilen fassen
      genau das an.
