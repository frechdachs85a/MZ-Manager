# MZ Coach

Persönliche Webseite für das ManagerZone-Team FC Toho (tid 847159). Läuft im normalen Browser,
für Desktop und Handy optimiert: ab 1024 px Breite Seitenleiste links und mehrspaltige Inhalte
(Kader als Tabelle mit MZ-Wert je Position), darunter Tab-Leiste unten und einspaltige Ansicht.

## Abweichungen vom Auftrag (Entscheidung von Marcus, 24.10.2026)

- Reine Webseite, keine installierbare App: kein Manifest, kein Service Worker, keine Splash-Bilder,
  kein eigenes Pull-to-Refresh (der Browser lädt beim Herunterziehen selbst neu).
- Keine Push-Benachrichtigungen. Die Automatik nach Ligaspielen (Etappe 7) zeigt ihre Ergebnisse
  auf der Übersicht.
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
- ManagerZone-Abruf (Etappe 2, Teil 2): Login per Playwright, Sitzungs-Cookie verschlüsselt, gedrosselte Abrufe
  (max. 2 parallel, 2 bis 4 s Pause), Kaderseite wird als Rohseite gespeichert (Einstellungen, "Kader jetzt abrufen").
  Gegen echtes ManagerZone noch nicht getestet. Offen: Auslesen der Spieler aus der Kaderseite. Dafür muss
  einmal echtes HTML der eingeloggten Seite vorliegen (Download "Seite" in den Einstellungen).
- Regeln von ManagerZone zu automatisierten Abrufen: siehe `docs/mz-seiten.md`. Der Abruf läuft auf eigenes Risiko.

## Sicherheit

- Nie `DEBUG=pw:api` oder `DEBUG=pw:*` setzen: Playwright schreibt dann eingegebene Werte ins Log, auch das ManagerZone-Passwort.
- Nach einem fehlgeschlagenen Login gibt es keinen automatischen neuen Versuch (IP-Sperre bei ManagerZone).
  Bei "Passwort falsch" erst wieder nach neu gespeichertem Zugang.
