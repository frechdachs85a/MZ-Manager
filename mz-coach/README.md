# MZ Coach

Persönliche Webseite für das ManagerZone-Team FC Toho (tid 847159). Läuft im normalen Browser,
für Desktop und Handy optimiert: ab 1024 px Breite Seitenleiste links und mehrspaltige Inhalte
(Kader als Tabelle mit MZ-Wert je Position), darunter Tab-Leiste unten und einspaltige Ansicht.

## Abweichungen vom Auftrag (Entscheidung von Marcus, 24.10.2026)

- Reine Webseite, keine installierbare App: kein Manifest, kein Service Worker, keine Splash-Bilder,
  kein eigenes Pull-to-Refresh (der Browser lädt beim Herunterziehen selbst neu).
- Keine Push-Benachrichtigungen. Die Automatik nach Ligaspielen (Etappe 7) zeigt ihre Ergebnisse
  auf der Übersicht.
- Automatik (25.10.2026): frühestens 12 Stunden nach Anstoß des eigenen Ligaspiels, damit alle Daten
  fertig sind (Anstoß 18:15 -> 6:15 Uhr am nächsten Morgen). Dann voll automatisch: eigenes Spiel
  auswerten, nächsten Ligagegner ermitteln, alle seine Ligaspiele der Saison holen und analysieren,
  Taktik vorschlagen und prüfen.
- Die Webseite soll alle eigenen Taktik-Reiter kennen und sich die Exporte selbst holen können
  (Taktikseite: changeTacticTab, teamTactic.editor.exportTactic, Feld #importExportData).
Fachgrundlage: `mz-wissen.md`. Auftrag: `docs/auftrag.md`.

## Start lokal

```bash
npm install
npx playwright install --with-deps chromium   # Browser für den ManagerZone-Abruf
npm run dev             # http://localhost:3000, führt beim ersten Mal zur Ersteinrichtung
                        # (Einrichtungscode steht in der Konsole)
```

## Befehle

- `npm test` Tests (Vitest)
- `npm run lint` ESLint
- `npm run build && npm start` Produktionsbuild
- `node scripts/make-icons.mjs` Logo und Favicons neu erzeugen (braucht Playwright)

## Stand

- Etappe 1 fertig: Gerüst, Design, Login-Schutz. Responsive für Desktop und Handy.
- Etappe 2 teilweise: SQLite, MZ-Formel, Koordinaten-Umrechnung, verschlüsselter MZ-Zugang, Kader- und Spieleransicht, Änderungsverlauf.
- Kader (Etappe 2): vier eigene Seiten werden ausgelesen, von Hand gespeichert und in den Einstellungen
  hochgeladen (mehrere auf einmal) oder automatisch per Playwright abgerufen (gegen echtes ManagerZone noch
  nicht getestet):
  Kaderübersicht `?p=players&sub=alt` (Skills, Rot/Schwarz, Alter, Marktwert),
  Spieleransicht `?p=players` (Scoutbericht: Sterne Hoch/Niedrig/Training, Markierung 1/2),
  Verletzt / Gesperrt `?p=players&sub=unavailable` (Sperren je Wettbewerb),
  Trainingslager `?p=training_camp` (Paket, Enddatum),
  Taktik `?p=tactics` (Kegel = nicht aufstellbar).
  Übersicht zeigt fürs nächste Ligaspiel, wer fehlt und wann er frühestens zurück ist.
  Offen: Transfermarkt-Status.
- Taktik-Prüfer (Teil von Etappe 5): Seite „Taktik“, XML aus dem Editor einfügen. Prüfliste aus
  mz-wissen.md, Abschnitt 5, als Code: Fehler (eindeutig verletzt) und Hinweise (Regel ohne genaue Grenze).
  Spielfeld mit allen drei Aufstellungen, Kegel-Spieler rot. Noch nicht an einer echten exportierten Taktik geprüft.
- Spielfeld-Ansicht (Teil von Etappe 3): Grenzen aus der Umrechnung in mz-wissen.md, Abschnitt 3.
- Spiele (Etappe 3): Stats-XML einfügen oder hochladen, Spielseite mit Aufstellungen, Toren, Wechseln.
- Gegneranalyse (Etappe 4): Spielliste hochladen, fehlende Ligaspiele holt die Webseite ohne Login,
  Urteil gleich/wechselnd mit Begründung je Spiel, Taktikvorschlag nach mz-wissen.md, Abschnitt 10.
- Transfermarkt-Scout (Etappe 8, Teil): Seite „Markt“. Größte Schwachstelle = Startplatz mit dem niedrigsten
  MZ-Wert in seiner Rolle (Startelf aus dem neuesten eigenen Spiel). Empfehlung = Marktspieler mit dem größten
  Gewinn auf einem Startplatz, innerhalb von Kapital und freien Ausländerplätzen (trägt Marcus ein) und der
  99-Regel. Mit Gründen, Vorbehalten, Ablehnen (dann der nächste), „heute kein passender Spieler“.
  Suche täglich ab 6 Uhr per Zeitplan (`src/instrumentation.ts`, abschaltbar mit `MZ_ZEITPLAN=aus`).
  Nationalität und Arbeitsbewilligung kommen aus der Spieleransicht (an der echten Seite geprüft).
  Die Marktsuche (ajax.php?p=transfer&sub=transfer-search) ist nach dem Quelltext des Userscripts
  Mazyar gebaut und noch nicht an einer echten Antwort geprüft; die erste Antwort wird roh gespeichert.
- Top 10 (Lernmaterial): je Team die letzten 10 Liga- und 10 Weltligaspiele, Spiellisten wöchentlich,
  fehlende Stats-XML täglich nachgeholt. Muster: Startstile, jeder Wechsel (Rolle, Regelminute, Spielstand),
  Taktikwechsel und Karten, Zeitleiste je Spiel, Stil gegen Gegnerklasse. Wöchentliches Archiv.
- Taktik-Portfolio: bewährte Stile der Top 10 je Gegnerklasse gegen das eigene Archiv, fehlende Stile mit echter
  Beispiel-Startaufstellung und Regel-Kurzcheck. Gegnerseite zeigt, was die Top 10 gegen diesen Gegnertyp spielen.
- Taktik-Archiv (Reiter mit XML, Prüfung gegen aktuellen Kader, Spiele je Taktik), Spieltag-Checkliste,
  Saisonstatistik, Jugend (Regel 4/1 oder 4/2 ab Nr. 195), Kaderwert-Vergleich, Ligatabelle.
- Scoutbericht: Sterne Hoch/Niedrig/Training (nur gefüllte), Stärken (1) und Schwächen (2), wörtlicher Text des Scouts
  (beim Kaderabruf per Klick auf „Scoutbericht“ gelesen, nur fehlende oder bei geänderten Sternen; Aufbau der Antwort noch
  nicht an einer echten geprüft, die erste wird roh gespeichert). Einstufung Rang 1 bis 6 aus Sternen und Schlüsselwort,
  sonst „Scoutbericht unbekannt“ mit Text und Bestätigen. Prognose je Skill. Loyale Spieler (Herz) ohne Bericht, nicht
  verkaufbar. Kader nach Rang sortier- und filterbar. Jugend: Rang 1 bis 3 behalten, sonst Abgabekandidat.
- Regelmuster je Team aus der Stats-XML (Wechsel mit Regelminute, Bedingung, Rolle des Ausgewechselten; Taktikwechsel mit
  Spielstand; „sehr wahrscheinlich keine Regel“, wenn das Team in der Lage war und nichts auslöste).
- Chat mit Claude: am 25.10.2026 auf Wunsch von Marcus entfernt (laufende Kosten je Frage bei Anthropic).
- Zeitplan (`src/lib/zeitplan.ts`): 4 Uhr Top 10 und eigene Spiele, 6 Uhr Markt, täglich Aufräumen, wöchentlich Sicherung.
- Echte Seiten als Testdaten liegen nur lokal in `src/lib/mz/parser/fixtures/` (Repo ist öffentlich).
- Regeln von ManagerZone zu automatisierten Abrufen: siehe `docs/mz-seiten.md`. Der Abruf läuft auf eigenes Risiko.

## Hosting

Anleitung für Railway und Oracle Cloud „Always Free“: `docs/hosting.md`. Ersteinrichtung ohne Schlüssel von Hand:
Schlüssel erzeugt der Server selbst (`/data/geheimnisse.json`), das App-Passwort legst du auf `/einrichtung` fest,
mit dem Einrichtungscode aus dem Serverprotokoll.

## Sicherheit

- Nie `DEBUG=pw:api` oder `DEBUG=pw:*` setzen: Playwright schreibt dann eingegebene Werte ins Log, auch das ManagerZone-Passwort.
- Nach einem fehlgeschlagenen Login gibt es keinen automatischen neuen Versuch (IP-Sperre bei ManagerZone).
  Bei "Passwort falsch" erst wieder nach neu gespeichertem Zugang.
