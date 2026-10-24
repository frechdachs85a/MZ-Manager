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

## Umsetzung im Abruf (Stand 24.10.2026)

- Login: `#login_username` und `#login_password` füllen, Enter im Passwortfeld (laut HTML
  `onkeypress` keyCode 13 → `$('#logindata').submit()`). Erfolg wird geprüft, indem `/?p=players`
  danach keine Abmeldeseite mehr liefert. Fehler über die Sichtbarkeit von
  `.wrong_username_or_password` und `.too_many_failed_login_attempts`.
- Nicht gesehen und deshalb offen: ob ManagerZone beim Login ein reCAPTCHA zeigt (das Skript
  `recaptcha/api.js` ist auf der Startseite eingebunden), wie die Seite nach erfolgreichem Login
  aussieht, und der Aufbau der eingeloggten Kaderseite.
- Getestet nur gegen einen lokalen Nachbau mit den beobachteten Merkmalen, noch nicht gegen managerzone.com.

## Kaderübersicht eingeloggt: `/?p=players&sub=alt` (24.10.2026, von Marcus gespeichert)

Titel "Kaderübersicht - ManagerZone". Seite auf Deutsch. Auszug der Tabelle liegt nur lokal unter `src/lib/mz/parser/fixtures/kader-alt-2026-10-24.html` (nicht im öffentlichen Repo).

- Tabelle `table#playerAltViewTable`, 47 Zeilen (Profis, Nachwuchs und Jugend gemeinsam, Nr 1 bis 207).
- Spalten (Überschrift, Skills zusätzlich mit `title`): Nr, Name, Wert, Gehalt, Alter, Geboren (Saison),
  Sp (Sprint), Au (Ausdauer), Sü (Spielübersicht), Pa (Passen), Sch (Schuss), Ko (Kopfball), To (Torwart),
  Te (Technik), Zw (Zweikampf), Fl (Flanken), St (Standards), Er (Erfahrung), Fo (Form), Checkbox.
- Name-Zelle: Link `?p=players&pid=<PID>&tid=847159`.
- Wert und Gehalt als `1&nbsp;084&nbsp;289 EUR`.
- Ausgemaxt = Zelle mit `class="maxed"`. Erfahrung und Form tragen nie `maxed` (nicht trainierbar).
- Zweite Tabelle `table.alt-view-table-mobile` mit gekürzten Namen ("L Chao Feng") und `data-value`,
  `data-salary`, `data-born`; wird nicht gebraucht.
- Im Kopf ein Skript mit `server_time = new Date(2026, 9, 24, 22, 48, 40);` (Monat ab 0) = Stand der Seite.
  Die Seitenuhr zeigte am 24.10.2026 dieselbe Zeit wie Europe/Berlin (Startseite 22:18 bei 20:18 UTC).
- NICHT auf dieser Seite: Scout-Sterne, Markierung 1/2 (stärkste Skills/Schwächen), Status
  (verletzt, gesperrt, Trainingslager, Transfermarkt). Dafür gibt es Links zu
  `?p=players&sub=unavailable` ("Verletzt / Gesperrt") und `?p=training_camp` ("Trainingslager"). Noch nicht gesehen.
- Abgleich mit mz-wissen.md, Abschnitt 11: alle notierten Skills der 20 Profis stimmen, und die MZ-Formel
  ergibt für Peschke MF 8,37 und VT 8,36 wie notiert.

## Verletzt / Gesperrt: `/?p=players&sub=unavailable` (24.10.2026, von Marcus gespeichert)

- Bereich `#squad_unavailable` mit zwei Abschnitten `<h3>Verletzungen</h3>` und `<h3>Platzverweise</h3>`.
- Verletzungen: nur der leere Fall gesehen: `<p>keine verletzten Spieler</p>`. Aufbau mit Einträgen unbekannt,
  die Webseite meldet dann "nicht verfügbar" statt zu raten.
- Platzverweise: `table#suspensionsList`, Kopfzeile mit `td`: Name, "Platzverw. Liga-/Pokalname", Spiele,
  Begegnungsart, Datum. Erste Zelle: `img` mit `title="Rote Karte"` und Link `a.switch_to_squad_tab` (pid),
  dazu eine Mobil-Liste `dl.hitlist-compact-list` mit denselben Werten.
- Am 24.10.: zwei Einträge, je Rote Karte, 1 Spiel, Begegnungsart "Offizieller Pokal", Wettbewerb als Link
  (`?p=cup&sub=schedule&...`). Sperre also je Wettbewerb. Wie die leere Liste aussieht: nicht gesehen.

## Trainingslager: `/?p=training_camp` (24.10.2026, von Marcus gespeichert)

- Zusammenfassung `.training_camp_stats table`: Spalte "Derzeit im Trainingslager", Zeile je Lagerart
  (Bildtitel "Trainingslager" 10, "Jugendaufbautrainingslager" 2).
- Liste `#training_camp_players_container`, je Spieler `.tc_table_container` mit `a.player_link` (pid),
  `.tc_table_package_text strong` (Paket, z. B. "Torjägerpaket Nr. 5", "Jugendaufbautrainingslager"),
  Zeilen "Aktuelle Eigenschaft:", "Dauer (Wochen):", "Verbleibende Tage:", "Startdatum:", "Enddatum:" (JJJJ-MM-TT).
- Laut Hilfetext gilt das Enddatum, "bis du entweder selbst das Trainingslager beendest oder der Spieler sein
  maximales Potential in allen Fertigkeiten, die er im Trainingslager trainiert, erreicht hat".
- 12 Einträge = 10 + 2 laut Zusammenfassung.

## Taktik: `/?p=tactics` (24.10.2026, von Marcus gespeichert)

- Spielerliste als `dd#n_<pid>` mit `.full-name` und `.pitch-position` (z. B. "Torw.", "Vert.", "Ausw. St.").
- Klassen der `dd`: `on_field` (in der Aufstellung, Feld oder Bank), `draggable ui-draggable` (frei),
  `tc ui-draggable` (Kegel: nicht aufstellbar). Nach Marcus: Kegel = Trainingslager ohne Chip.
- Am 24.10.: 7 mit Kegel, 3 weitere im Trainingslager ohne Kegel aufgestellt, 2 aus dem Jugendaufbau-Lager frei.
- Verletzte oder Gesperrte tragen am 24.10. keine eigene Klasse (ein Spieler mit Pokalsperre: `on_field`).
  Andere Klassen sind unbekannt, die Webseite meldet sie, statt sie zu werten.
