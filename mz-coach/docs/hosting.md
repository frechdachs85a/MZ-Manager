# Hosting

Die Webseite läuft als ein Container (`Dockerfile`): Next.js-Server plus Chromium für den
ManagerZone-Abruf. Am 25.10.2026 lokal gebaut und gestartet: Server antwortet, Zeitplan aktiv,
Chromium startet im Container.

## Was jeder Anbieter können muss

- Docker-Container dauerhaft laufen lassen (der Zeitplan braucht einen laufenden Prozess).
- Ein dauerhaftes Laufwerk (Volume) unter `/data` für die SQLite-Datenbank.
- Eigene Domain mit HTTPS.

## Umgebungsvariablen (beim Anbieter eintragen, nie ins Repo)

| Name | Inhalt |
|---|---|
| `APP_PASSWORD_HASH` | `npm run hash-password` lokal ausführen, Ergebnis eintragen |
| `SESSION_SECRET` | mindestens 32 zufällige Zeichen |
| `MZ_TRESOR_KEY` | 32 Byte base64, z. B. `openssl rand -base64 32` |
| `DATABASE_PATH` | `/data/mz-coach.db` (im Dockerfile schon gesetzt) |

`MZ_TRESOR_KEY` nie ändern, sonst ist der gespeicherte ManagerZone-Zugang nicht mehr lesbar.

## Railway (Empfehlung)

1. Konto auf railway.com, mit GitHub verbinden.
2. Neues Projekt aus dem Repo `MZ-Manager`, als Root Directory `mz-coach` angeben. Railway erkennt das Dockerfile.
3. Volume anlegen, Mount Path `/data`.
4. Die Umgebungsvariablen oben eintragen.
5. Unter Networking die eigene Domain hinzufügen und den angezeigten DNS-Eintrag beim Domain-Anbieter setzen.
6. In der Webseite unter Einstellungen den ManagerZone-Zugang hinterlegen.
