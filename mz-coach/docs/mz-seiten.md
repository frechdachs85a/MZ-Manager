# ManagerZone-Seiten: echte Beobachtungen

Nur, was direkt von managerzone.com abgerufen und angesehen wurde. Mit Datum.

## Startseite / Login (24.10.2026, ohne Anmeldung abgerufen)

- Sichtbares Formular: `form#logindata` (name `logindata`), `onsubmit="return safeLogin(this);"`
  - Benutzername: `input#login_username` (name `login_username`)
  - Passwort: `input#login_password` (name `login_password`)
  - Checkbox `input#remember_me`
- Verstecktes Formular `form[name=login]` mit `action="/?p=login"`, `method="post"` und den Feldern
  `logindata[md5]`, `logindata[username]`, `logindata[markasdefault]`, `logindata[sport]`,
  `logindata[remember_me]`, `sport=soccer`, `lang`.
  `safeLogin` (JavaScript der Seite) füllt dieses Formular vermutlich aus dem sichtbaren und schickt es ab.
  Nicht geprüft. Deshalb Login per Playwright über die sichtbaren Felder, damit das Seiten-JavaScript selbst läuft.
- Auf der Seite ist ein Cookie-Banner von Cookiebot eingebunden (`consent.cookiebot.com/uc.js`).
