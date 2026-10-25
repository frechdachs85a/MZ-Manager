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
cp .env.example .env.local
npm run hash-password   # Passwort eingeben, Ausgabe in .env.local eintragen
npm run dev             # http://localhost:3000
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
- Echte Seiten als Testdaten liegen nur lokal in `src/lib/mz/parser/fixtures/` (Repo ist öffentlich).
- Regeln von ManagerZone zu automatisierten Abrufen: siehe `docs/mz-seiten.md`. Der Abruf läuft auf eigenes Risiko.

## Sicherheit

- Nie `DEBUG=pw:api` oder `DEBUG=pw:*` setzen: Playwright schreibt dann eingegebene Werte ins Log, auch das ManagerZone-Passwort.
- Nach einem fehlgeschlagenen Login gibt es keinen automatischen neuen Versuch (IP-Sperre bei ManagerZone).
  Bei "Passwort falsch" erst wieder nach neu gespeichertem Zugang.
