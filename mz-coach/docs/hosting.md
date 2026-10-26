# Hosting

Die Webseite läuft als ein Container (`Dockerfile`): Next.js-Server plus Chromium für den ManagerZone-Abruf.
Am 25.10.2026 gebaut und mit leerem Volume gestartet: Gesundheitsprüfung antwortet, Ersteinrichtung erscheint,
Schlüssel und Datenbank landen auf dem Volume, Chromium startet im Container. Das Playwright-Abbild gibt es für
amd64 und arm64 (Oracle Ampere).

## Was jeder Hoster können muss

- Den Container dauerhaft laufen lassen (der Zeitplan um 4 und 6 Uhr braucht einen laufenden Prozess), genau eine Instanz.
- Ein dauerhaftes Laufwerk (Volume) unter `/data`: Datenbank, Sicherungen und `geheimnisse.json`.
- HTTPS.

## Ersteinrichtung (ohne Schlüssel von Hand)

1. Beim ersten Start legt der Server `/data/geheimnisse.json` an: Sitzungs-Schlüssel und Tresor-Schlüssel (für den
   verschlüsselten ManagerZone-Zugang), zufällig erzeugt, nur für den Server lesbar.
2. Solange kein App-Passwort gesetzt ist, steht im Serverprotokoll eine Zeile
   `MZ Coach noch nicht eingerichtet. Einrichtungscode: XXXX-XXXX-XXXX`.
3. Die Seite aufrufen: sie führt zu `/einrichtung`. Code eingeben, App-Passwort (mind. 10 Zeichen) zweimal eingeben.
   Danach ist die Einrichtung gesperrt, angemeldet wird mit dem Passwort.
4. Unter Einstellungen den ManagerZone-Zugang hinterlegen und „Kader jetzt abrufen“.

Direkt nach dem ersten Start einrichten: Wer den Code nicht hat, kommt nicht weiter, aber erst mit dem Passwort
ist die Seite wirklich deine.

Wichtig: `geheimnisse.json` nie löschen. Ohne den Tresor-Schlüssel ist der gespeicherte ManagerZone-Zugang nicht
mehr lesbar (dann einfach neu eingeben), ohne den Sitzungs-Schlüssel muss man sich neu anmelden.
Passwort vergessen: in `geheimnisse.json` die Zeile `passwortHash` entfernen und neu starten, dann gibt es wieder
einen Einrichtungscode.

Optional statt der Datei (haben dann Vorrang): `APP_PASSWORD_HASH`, `SESSION_SECRET`, `MZ_TRESOR_KEY`
(erzeugen mit `npm run hash-password`). Werden sie später entfernt, gilt wieder die Datei.

## Hetzner Cloud (gewählt am 25.10.2026)

Kosten: CAX11 (2 Kerne Ampere, 4 GB, 40 GB) laut Vergleichsseiten etwa 6,49 € im Monat inklusive IPv4
(nach der Preiserhöhung im Juni 2026). Vor der Bestellung die Preisseite von Hetzner prüfen. Abrechnung stundengenau,
Server löschen beendet die Kosten.

1. Konto auf hetzner.com/cloud anlegen (Hetzner prüft neue Konten, das kann einen Moment dauern).
2. Neues Projekt → „Server hinzufügen“:
   - Standort: Falkenstein oder Nürnberg (Deutschland)
   - Image: **Ubuntu 24.04**
   - Typ: **Arm64 (Ampere) → CAX11**. Ist er gerade nicht bestellbar, geht auch ein x86-Typ (CX-Reihe) mit
     mindestens 4 GB; das Skript läuft auf beiden.
   - Netzwerk: öffentliche IPv4 an
   - SSH-Schlüssel: eigenen öffentlichen Schlüssel hinzufügen (empfohlen). Ohne Schlüssel schickt Hetzner ein
     root-Passwort per E-Mail.
   - Firewall: optional eine anlegen mit eingehend TCP 22, 80, 443 erlaubt. Ohne Firewall sind die Ports offen.
   - **Cloud-Config** (unten bei „Cloud config“): Text aus dem Kasten unten einfügen und `MEIN-CODE` durch einen
     eigenen Einrichtungscode ersetzen (mindestens 8 Zeichen, nur Buchstaben, Ziffern und Bindestriche). Dann richtet
     sich der Server beim ersten Start komplett selbst ein, ganz ohne SSH. Weiter bei Schritt 4.
     ```yaml
     #cloud-config
     runcmd:
       - [bash, -c, "curl -fsSL https://raw.githubusercontent.com/frechdachs85a/MZ-Manager/main/mz-coach/deploy/server/einrichten.sh -o /root/einrichten.sh && HOME=/root EINRICHTUNGSCODE=MEIN-CODE bash /root/einrichten.sh > /root/einrichten.log 2>&1"]
     ```
3. Ohne Cloud-Config: per SSH auf den Server (`ssh root@<öffentliche IP>`) und ausführen:
   ```bash
   curl -fsSLO https://raw.githubusercontent.com/frechdachs85a/MZ-Manager/main/mz-coach/deploy/server/einrichten.sh
   bash einrichten.sh            # oder: bash einrichten.sh meine-domain.de
   ```
   Das Skript installiert Docker, legt bei 4 GB Arbeitsspeicher 2 GB Swap an, holt den Code, baut und startet
   (beim ersten Mal einige Minuten). Ohne Domain läuft die Seite unter `https://<IP-mit-Bindestrichen>.sslip.io`.
   Mit eigener Domain vorher beim Domain-Anbieter einen A-Eintrag auf die öffentliche IP setzen.
4. Mit Cloud-Config: etwa 10 bis 15 Minuten warten (Bau beim ersten Start), dann
   `https://<öffentliche IP mit Bindestrichen statt Punkten>.sslip.io` öffnen, z. B. `https://203-0-113-7.sslip.io`,
   und mit dem selbst gewählten Code einrichten. Fortschritt bei Bedarf: `/root/einrichten.log` auf dem Server.
   Ohne Cloud-Config zeigt das Skript am Ende Adresse und Einrichtungscode.

Update auf den neuesten Stand: `bash einrichten.sh` erneut ausführen. Protokoll: im Ordner
`~/MZ-Manager/mz-coach/deploy/server` mit `docker compose logs -f app`. Daten liegen in
`~/MZ-Manager/mz-coach/deploy/server/daten`. Ubuntu spielt Sicherheitsupdates von selbst ein (unattended-upgrades).
Hetzner bietet zusätzlich Backups des ganzen Servers gegen Aufpreis (Preis bei der Serverauswahl).

## Railway (Anmeldung war am 25.10.2026 gesperrt)

Kosten: Hobby-Tarif 5 $ im Monat inklusive 5 $ Verbrauch (Stand Oktober 2026, railway.com/pricing). Geschätzt
reicht das für diese Seite; den echten Verbrauch zeigt Railway nach ein paar Tagen.

1. Konto auf railway.com, mit GitHub verbinden, Hobby-Tarif wählen.
2. New Project → Deploy from GitHub repo → `MZ-Manager`.
3. Im Dienst unter Settings: Root Directory `mz-coach`, Branch `main`. Railway nimmt das Dockerfile und die
   `railway.toml` (Gesundheitsprüfung `/api/gesund`, Neustart bei Absturz). Falls die `railway.toml` nicht
   erkannt wird: unter Settings „Config File Path“ auf `/mz-coach/railway.toml` stellen.
4. Volume anlegen (Rechtsklick auf den Dienst → Attach Volume), Mount Path `/data`.
5. Settings → Networking → „Generate Domain“. Später optional die eigene Domain hinzufügen und den angezeigten
   DNS-Eintrag beim Domain-Anbieter setzen.
6. Deployments → neuester → Logs: Zeile „Einrichtungscode“ suchen. Dann die Seite öffnen und einrichten (siehe oben).

Keine Umgebungsvariablen nötig.

## Oracle Cloud „Always Free“ (0 €)

Kosten: 0 € im Rahmen von Always Free (Stand Oktober 2026: Ampere A1 mit zusammen 2 Kernen und 12 GB).
Kreditkarte nur zur Prüfung bei der Anmeldung.

1. Konto auf oracle.com/cloud/free anlegen (Heimatregion z. B. Frankfurt).
2. Compute → Instances → Create instance: Image „Canonical Ubuntu 24.04“, Shape „VM.Standard.A1.Flex“
   (Ampere, z. B. 2 OCPU / 12 GB), öffentliche IP an, SSH-Schlüssel herunterladen.
   Gibt es gerade keine A1-Kapazität, später erneut versuchen oder eine andere Verfügbarkeitszone wählen.
3. Netzwerk freigeben: Instance → Subnet → Security List → Ingress Rules hinzufügen:
   Quelle `0.0.0.0/0`, TCP, Zielport `80` und eine zweite Regel für `443`.
4. Per SSH auf den Server (`ssh -i <schlüssel> ubuntu@<öffentliche IP>`) und ausführen:
   ```bash
   curl -fsSLO https://raw.githubusercontent.com/frechdachs85a/MZ-Manager/main/mz-coach/deploy/server/einrichten.sh
   bash einrichten.sh            # oder: bash einrichten.sh meine-domain.de
   ```
   Ohne Domain läuft die Seite unter `https://<IP-mit-Bindestrichen>.sslip.io`. Mit eigener Domain vorher beim
   Domain-Anbieter einen A-Eintrag auf die öffentliche IP setzen.
5. Am Ende zeigt das Skript Adresse und Einrichtungscode. Seite öffnen und einrichten (siehe oben).

Update und Protokoll wie bei Hetzner (mit `sudo` vor `docker`).

## Automatische Updates und Fernzugang für Claude (ab 26.10.2026, von Marcus ausdrücklich erlaubt)

- `einrichten.sh` richtet einen systemd-Timer ein: alle 5 Minuten prüft `deploy/server/aktualisieren.sh`, ob es auf
  `main` einen neuen Stand gibt, und baut nur dann neu. Protokoll: `journalctl -u mz-coach-update`.
  Abschalten: `systemctl disable --now mz-coach-update.timer`.
- Fernzugang: Mit einem Schlüssel, dessen SHA-256-Hash in `src/lib/fern.ts` steht, kann Claude über
  `/api/fern/diagnose` die Diagnose lesen und über `/api/fern/abruf?art=kader|markt|top` einen Abruf starten
  (je Art höchstens alle 15 Minuten). Kein Zugriff auf App-Passwort, MZ-Zugang oder Einstellungen.
  Läuft am 30.11.2026 ab. Sofort abschalten: `FERN_AUS=1` in `deploy/server/.env` eintragen und im Ordner
  `deploy/server` `docker compose up -d` ausführen.

## Zeitplan, Aufräumen, Sicherung

- 4 Uhr: Top 10 (Spiellisten einmal pro Woche, montags; fehlende Spiele täglich nachgeholt), eigene Ligaspiele, Ligatabelle.
- 6 Uhr: Transfermarkt.
- Täglich: Aufräumen (je Art die letzten 3 Rohseiten, die letzten 7 Marktsuchen, 2000 Protokollzeilen;
  Spieler-Schnappschüsse nur bei Änderung). Spiele, Spiellisten, Änderungsverlauf, Taktiken und Archiv bleiben immer.
- Wöchentlich: Archiv der Top-10-Auswertung und Sicherung der ganzen Datenbank nach `/data/sicherung/`
  (die letzten 8). Die Sicherungen liegen auf demselben Volume; für Schutz gegen Verlust des Volumes
  zusätzlich ab und zu eine Datei herunterladen.
