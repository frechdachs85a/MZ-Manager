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

## Kaderseite ohne Anmeldung (24.10.2026)

- `/?p=players&tid=847159` ohne Login liefert keine Spielerliste, sondern eine Weiterleitungsseite
  (Titel "Logout - Managerzone", Meta-Refresh auf `/?changesport=soccer`, löscht das Cookie `PHPSESSID`).
- Daraus folgt: Das Session-Cookie heißt `PHPSESSID`. Der Aufbau der eingeloggten Kaderseite ist noch
  nicht gesehen. Der Parser wird erst geschrieben, wenn echtes HTML der eingeloggten Seite vorliegt.

## Fehlermeldungen beim Login (24.10.2026, im HTML der Startseite enthalten)

- "Incorrect username or password"
- "Access has been temporarily blocked due to too many failed login attempts from your IP address.
  Please try again in a few minutes."
  Folge für die App: Login nie automatisch wiederholen, nach einem Fehlschlag stoppen und melden.

## Regeln zu automatisierten Abrufen (24.10.2026 gelesen)

### robots.txt (`/robots.txt`)
- `User-agent: *` sperrt u. a. `Disallow: /?p=match` (also Spielberichtsseiten `/?p=match&sub=...`),
  außerdem `/css/`, `/js/`, `/img/` und einzelne News.
- `ClaudeBot`, `GPTBot`, `OAI-SearchBot` und weitere Crawler sind komplett gesperrt (`Disallow: /`).
- `/?p=players`, `/ajax.php` und `/matchviewer/` stehen nicht in der Liste.

### Terms Of Use (`/?p=start&sub=terms_of_use`, "Revised May 2018"), wörtlich
- "You may not modify, adapt, translate, reverse engineer, decompile, or disassemble the Software
  or create any derivative work thereof or any software interfacing with the Software."
  ("Software" meint dort ausdrücklich auch "all HTML code contained in this Web site".)
- "Failure to abide by these terms and conditions may result in disqualification, account closure,
  forfeiture of funds and/or legal action against you."
- "It is your responsibility to protect your Password. Any actions carried out by the use of your
  login details are at your sole risk"

### General Rules (`/?p=start&sub=game_rules`), wörtlich
- "you must not log into any account other than your own"
- "It is also forbidden to view any non-public team details without the owner's or crew's permission"
- Strafen: "Warning, Temporary transfer ban, Team fine, Removal of transferred player, Club closure,
  Account suspension"
- Eine ausdrückliche Regel zu Bots, Skripten oder Abrufhäufigkeit steht in beiden Texten nicht.
