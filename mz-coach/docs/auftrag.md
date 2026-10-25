# Prompt für Claude Code: MZ Coach (ManagerZone-Assistent für FC Toho)

Kopiere alles ab "AUFTRAG" in Claude Code. Lege vorher die Datei `mz-wissen.md` in den Projektordner, sie enthält das komplette Fachwissen.

> **Änderungen durch Marcus (24.10.2026), gehen dem Text unten vor:**
> - Reine Webseite für Laptop und Handy (responsive), keine installierbare App, kein PWA, keine Splash-Bilder.
> - Keine Push-Benachrichtigungen. Ergebnisse der Automatik erscheinen auf der Übersicht.
> - Statt "fühlt sich an wie eine native iPhone-App": ruhige, moderne Optik, auf dem Handy wie am Desktop gut nutzbar.

---

AUFTRAG

Baue mir eine persönliche Web-App namens "MZ Coach" für mein ManagerZone-Fußballteam FC Toho (tid 847159). Die App ist nur für mich (ein Nutzer). Sie soll mein Team und meine Gegner automatisch analysieren, Taktiken als fertigen XML-Code für den ManagerZone-Taktik-Editor vorschlagen und mit jeder Analyse dazulernen.

Im Projektordner liegt `mz-wissen.md`. Das ist die verbindliche Fachgrundlage: Datenquellen, wie man die Stats-XML zuverlässig bekommt, die MZ-Formel, die Umrechnung von XML-Koordinaten in Editor-Koordinaten, die Prüfliste für Taktiken, meine Spielerregeln, meine aktuellen Taktiken und die Erkenntnisse aus 236 analysierten Spielen der Top 10. Lies sie komplett, bevor du planst. Nichts davon darf geschätzt oder durch "Allgemeinwissen" ersetzt werden.

## Grundregel für alle Analysen

Nur echte Daten von managerzone.com. Nichts schätzen, nichts erfinden. Fehlt ein Wert, zeigt die App "nicht verfügbar" mit Grund. Die KI muss bei jeder Aussage sagen können, woher sie stammt (Spiel-ID, Seite, Datum).

## Funktionen

1. **Login und Datenabruf**
   - Ich gebe einmal meinen ManagerZone-Login ein. Speicherung nur serverseitig und verschlüsselt (z. B. libsodium/AES-GCM mit Schlüssel aus Umgebungsvariable), niemals im Code, im Git-Repo, im Browser-Speicher oder in Logs. Bevorzugt nur das Session-Cookie speichern und bei Ablauf neu einloggen.
   - Der Abruf läuft serverseitig mit einem echten Browser (Playwright), weil manche Daten erst nach Anforderung über den 2D-Viewer bereitstehen (Ablauf in `mz-wissen.md`, Abschnitt 2).
   - Höfliches Abrufverhalten: höchstens 2 bis 3 parallele Anfragen, kleine Pausen, Caching. Bereits gespeicherte Spiele nie erneut abrufen.
   - Bevor du den Scraper baust: Weise mich darauf hin, die ManagerZone-Regeln zu automatisierten Abrufen zu prüfen, damit mein Account nicht gefährdet ist.

2. **Mein Kader, immer aktuell**
   - Alle Spieler mit allen Skills, Rot/Schwarz (ausgemaxt/trainierbar), Markierung Stärke/Schwäche, Scout-Sterne, Alter, Marktwert.
   - Status: Trainingslager, verletzt, gesperrt (Rot/Gelb-Rot), auf dem Transfermarkt.
   - MZ-Wert je Position nach der Formel aus `mz-wissen.md`, Abschnitt 6.
   - Verlauf: Jede Veränderung (neuer Ball, Verlust, Form, Marktwert) wird mit Datum gespeichert und als Änderungsliste angezeigt.

3. **Gegner analysieren** ("Analysiere Team X")
   - Alle Ligaspiele der laufenden Saison des Gegners: Formation aus der XML in Editor-Koordinaten, Einstellungen, alle Wechsel und Taktikwechsel mit Minute und Spielstand, Tore und Vorlagen, komplette Spielstatistik, Marktwerte und Alter der Startelf.
   - Bewertung: Spielt der Gegner immer gleich oder wechselnd, mit Begründung je Spiel. Stärken, Schwächen, Kaderwert-Vergleich.
   - Darstellung der Gegnerformation als kleines Spielfeld.

4. **Perfekte Taktik gegen Gegner X**
   - Wählt nach den Faustregeln in `mz-wissen.md` (Abschnitt 10) eine meiner Taktiken oder passt sie an.
   - Gibt immer kompletten XML-Code aus (Kopieren-Button), nie Einzelzeilen.
   - Jede Taktik läuft vor der Ausgabe automatisch durch einen Prüfer, der die Prüfliste aus Abschnitt 5 als Code umsetzt (Stürmerzahl, y ≥ 63, Abstände ≥ 47, Wechsel, Bankplätze, Rot-Regel, gesperrte/verletzte/Trainingslager-Spieler). Schlägt eine Prüfung fehl, wird die Taktik korrigiert, nicht ausgegeben.
   - Begründung in wenigen Sätzen, mit Bezug auf die Daten.

5. **Automatik nach jedem Ligaspiel**
   - Ligaspiele sind mittwochs und sonntags. Am Folgetag (Donnerstag und Montag, morgens) läuft automatisch: eigener Kader aktualisieren, eigenes letztes Spiel auswerten, nächsten Ligagegner analysieren, Taktikempfehlung erstellen.
   - Ist die Statistik noch nicht fertig ("Statistik wird berechnet"), später erneut versuchen.
   - Push-Benachrichtigung aufs iPhone (Web Push für PWA) mit: Empfehlung fürs nächste Spiel, verletzte oder gesperrte Spieler, und ob die Taktik deswegen angepasst wurde.
   - Wenn ein Stammspieler ausfällt, wird die Taktik automatisch mit dem nächstbesten verfügbaren Spieler neu gebaut und geprüft.

6. **Transfermarkt-Scout**
   - Durchsucht den Transfermarkt nach Spielern, die mein Team auf einer Position verbessern (Vergleich MZ-Wert gegen meinen aktuellen Spieler auf der Position).
   - Filter nach meinen Regeln: 99-Regel (Sprint und Ausdauer 9+, Ausnahme Ausdauer 8 bei günstigen Einwechslern), Alter, Budget.
   - Anzeige: Skills, MZ-Wert je Position, Unterschied zu meinem Spieler, Alter, Marktwert, aktuelles Gebot, Auktionsende.
   - Marktwert ist kein Preismaßstab, das in der Bewertung berücksichtigen.
   - Ergänzung Marcus, 25.10.2026:
     - Größte Schwachstelle des Teams erkennen und den Spieler vom Markt suchen, der am meisten hilft.
     - Grenzen beachten: erlaubte Zahl nicht einheimischer Spieler und verfügbares Kapital.
     - Vorschlag ablehnen können, dann wird der nächstbeste gesucht. Abgelehnte Spieler werden nicht erneut vorgeschlagen.
     - Jeden Tag automatisch neu suchen.
     - Ist kein passender Spieler da, wird das ausdrücklich gesagt.
     - Zu jedem Vorschlag sichtbar: warum dieser Spieler, um wie viel er das Team verstärkt und wodurch (Position, MZ-Wert vorher/nachher).
   - Biet-Automat (Marcus, 25.10.2026):
     - Maximalgebot je Spieler, Knopf "Max" setzt den verfügbaren Saldo ein.
     - Liegt Marcus in der Schlussphase nicht vorne, eine Stufe höher bieten, nie über das Maximum.
     - Geboten wird zwischen 1 und 3 Minuten vor Ende, nicht knapper. Jedes Gebot in den letzten 3 Minuten
       verlängert die Frist um 3 Minuten (laut ManagerZone); weiter, bis Marcus allein vorne ist oder das
       Maximum erreicht ist.
     - Jedes Gebot mit Zeit und Betrag protokollieren.
     - Offen: wie das Gebot abgeschickt wird (Funktion buy() in transfer.js, Datei angefragt).

7. **Lernendes Gedächtnis**
   - Jedes abgerufene Spiel (eigene, Gegner, Topteams) wird dauerhaft gespeichert: Roh-XML plus ausgewertete Felder.
   - Neue Erkenntnisse speichert die KI als Markdown in einem Ordner `wissen/` (z. B. `wissen/gegner/<tid>.md`, `wissen/erkenntnisse.md`). `mz-wissen.md` ist die Startbasis.
   - Vor jeder Antwort lädt die KI das relevante Wissen (eigener Kader, Gegnerdatei, Erkenntnisse) in ihren Kontext.
   - Ich kann Erkenntnisse ansehen, bearbeiten und löschen.

8. **Chat**
   - Ein Chatfeld, in dem ich frei frage: "Analysiere Team X", "Finde die beste Taktik gegen Y", "Wer verbessert meinen Sturm?", "Was hat sich bei meinen Spielern geändert?"
   - Die KI hat Werkzeuge (Tool Use) für: Kader abrufen, Spiel abrufen, Team analysieren, Taktik bauen, Taktik prüfen, Transfermarkt suchen, Wissen lesen und schreiben.
   - Antworten auf Deutsch, locker und direkt, ohne Gedankenstriche, ohne Emojis, Ansprache "du".

## Design (wichtig)

- Mobile first, abgestimmt auf iOS: fühlt sich an wie eine native iPhone-App.
- Als PWA installierbar (Zum Home-Bildschirm), mit App-Icon, Splash, Vollbild, Safe Areas (Notch, Home-Indicator) beachtet.
- Untere Tab-Leiste: Übersicht, Kader, Gegner, Taktik, Markt, Chat.
- Moderne, ruhige Optik im Stil von iOS: große Titel, Karten mit abgerundeten Ecken, viel Weißraum, SF-Pro-ähnliche Systemschrift, Hell- und Dunkelmodus automatisch.
- Flüssige Übergänge, Pull-to-Refresh, Haptik-ähnliches Feedback, Touch-Ziele mindestens 44 px.
- Spielfeld-Ansicht für Formationen (eigene und gegnerische) als SVG.
- Skills übersichtlich: Balken oder Kugeln, ausgemaxte Skills farblich markiert, wie auf ManagerZone.
- Startseite: nächstes Spiel mit Countdown, empfohlene Taktik, Ausfälle, Tabelle, letzte Skill-Änderungen.

## Technik (Vorschlag, gerne verbessern und begründen)

- Next.js mit TypeScript, Tailwind, PWA
- Datenbank: Postgres (z. B. Supabase oder Neon) oder SQLite für den Start
- Scraper: Playwright, als eigener Worker
- KI: Anthropic Claude API mit Tool Use; API-Schlüssel nur als Umgebungsvariable
- Zeitpläne: Cron-Jobs auf dem Server (Do und Mo morgens, Europe/Berlin)
- Hosting: etwas, das dauerhaft Hintergrundjobs und einen Browser laufen lassen kann (z. B. Railway, Fly.io oder ein kleiner VPS). Erkläre mir die Optionen und Kosten kurz.
- Zugangsschutz der App selbst (nur ich): Passwort oder Passkey

## Vorgehen

Bau in Etappen und zeig mir nach jeder Etappe, was läuft:
1. Projektgerüst, Design-System, PWA, Login-Schutz der App
2. ManagerZone-Login und Abruf meines Kaders, Speicherung, Kaderansicht mit MZ-Werten
3. Spielabruf mit Viewer-Anforderung und XML-Parser, Koordinaten-Umrechnung, Spielfeld-Ansicht
4. Gegneranalyse
5. Taktik-Generator mit automatischem Prüfer
6. Chat mit Tool Use und Wissensspeicher
7. Automatik nach Ligaspielen und Push-Benachrichtigungen
8. Transfermarkt-Scout

Schreibe für den XML-Parser, die Koordinaten-Umrechnung, die MZ-Formel und den Taktik-Prüfer automatische Tests. Testfall für die Umrechnung: Bei meinem Spiel 1625669278 (Torwart bei origin-y 1000) muss Cavalcante auf etwa 103/63 und Chille auf etwa 33/223 im Editor landen.

Frag mich, wenn eine Entscheidung wirklich bei mir liegt (Hosting, Kosten, Datenbank). Alles andere entscheide selbst und sag kurz, was du gewählt hast.

## Freundschaftsspiele mit dem Team der Frau (Marcus, 25.10.2026)

- Laut Marcus von ManagerZone genehmigt: Freundschaftsspiele zwischen beiden Teams erlaubt, Transfers untereinander nicht.
- Jeden Dienstag zwischen 6 und 11 Uhr von Marcus' Konto eine Einladung an ihr Team schicken: Donnerstag 11 und 19 Uhr, Freitag 11 und 19 Uhr.
  Feste Uhrzeit, keine absichtlich wechselnden Zeiten.
- Annehmen macht sie selbst. Die Webseite loggt sich nicht in ihr Konto ein (General Rules: "you must not log into any account other than your own").
- Transfermarkt: Spieler ihres Teams nie vorschlagen und nie bieten.
- Offen: Seite zum Verschicken einer Einladung (HTML) und ihre tid.
