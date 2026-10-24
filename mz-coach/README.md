# MZ Coach

Persönliche Web-App (PWA) für das ManagerZone-Team FC Toho (tid 847159).
Fachgrundlage: `mz-wissen.md`. Auftrag: `docs/auftrag.md`.

## Start lokal

```bash
npm install
cp .env.example .env.local
npm run hash-password   # Passwort eingeben, Ausgabe in .env.local eintragen
npm run dev             # http://localhost:3000
```

## Befehle

- `npm test` Tests (Vitest)
- `npm run lint` ESLint
- `npm run build && npm start` Produktionsbuild
- `node scripts/make-icons.mjs` Icons und Splash-Bilder neu erzeugen (braucht Playwright)

## Stand

- Etappe 1 fertig: Gerüst, iOS-Design, PWA, Login-Schutz.
- Etappe 2 teilweise: SQLite, MZ-Formel, Koordinaten-Umrechnung, verschlüsselter MZ-Zugang, Kader- und Spieleransicht, Änderungsverlauf. Offen: Abruf von ManagerZone (Netzwerkfreigabe nötig).
