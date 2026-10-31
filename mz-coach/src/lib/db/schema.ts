import type Database from "better-sqlite3";

// Jede Migration genau einmal, in dieser Reihenfolge. Nie bestehende ändern, nur anhängen.
const MIGRATIONEN: string[] = [
  `
  CREATE TABLE einstellung (
    schluessel TEXT PRIMARY KEY,
    wert TEXT NOT NULL,
    geaendert TEXT NOT NULL
  );

  -- aktueller Stand je eigenem Spieler
  CREATE TABLE spieler (
    pid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    nr INTEGER,
    alter_jahre INTEGER,
    daten_json TEXT NOT NULL,      -- Skills, Status, Marktwert, Scout usw.
    quelle TEXT NOT NULL,          -- woher der Stand stammt (URL/Seite)
    abgerufen TEXT NOT NULL,       -- ISO-Zeit
    aktiv INTEGER NOT NULL DEFAULT 1
  );

  -- jeder Abruf als unveränderlicher Schnappschuss
  CREATE TABLE spieler_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER NOT NULL,
    abgerufen TEXT NOT NULL,
    quelle TEXT NOT NULL,
    daten_json TEXT NOT NULL
  );
  CREATE INDEX spieler_snapshot_pid ON spieler_snapshot(pid, abgerufen);

  -- erkannte Änderungen (neuer Ball, Verlust, Form, Marktwert ...)
  CREATE TABLE spieler_aenderung (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER NOT NULL,
    datum TEXT NOT NULL,
    feld TEXT NOT NULL,
    alt TEXT,
    neu TEXT,
    quelle TEXT NOT NULL
  );
  CREATE INDEX spieler_aenderung_datum ON spieler_aenderung(datum);

  -- jedes abgerufene Spiel, Roh-XML plus Auswertung. Nie doppelt abrufen.
  CREATE TABLE spiel (
    mid INTEGER PRIMARY KEY,
    typ TEXT,
    abgerufen TEXT NOT NULL,
    stats_xml TEXT,
    auswertung_json TEXT
  );
  `,
  `
  -- jede von ManagerZone abgerufene Seite unverändert, als Beleg und für den Parser
  CREATE TABLE rohseite (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    art TEXT NOT NULL,             -- z. B. kader
    url TEXT NOT NULL,
    abgerufen TEXT NOT NULL,
    status INTEGER,                -- HTTP-Status der Antwort
    html_roh TEXT,                 -- Antwort des Servers
    html_dom TEXT                  -- Seite nach dem JavaScript im Browser
  );
  CREATE INDEX rohseite_art ON rohseite(art, abgerufen);

  -- Protokoll jedes Abrufs: gestartet, Ergebnis, Fehlermeldung (nie Zugangsdaten)
  CREATE TABLE abruf_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    art TEXT NOT NULL,
    gestartet TEXT NOT NULL,
    beendet TEXT,
    ok INTEGER,
    meldung TEXT
  );
  `,
  `
  -- Spiele aus der Spielliste eines Teams (?p=match&sub=played&tid=…), je Team und Spiel einmal
  CREATE TABLE team_spiel (
    tid INTEGER NOT NULL,
    mid INTEGER NOT NULL,
    datum TEXT NOT NULL,
    zeit TEXT,
    art TEXT NOT NULL,
    wettbewerb TEXT,
    daten_json TEXT NOT NULL,      -- ListenSpiel (Heim, Gast, Ergebnis)
    stand TEXT NOT NULL,           -- Stand der Seite
    PRIMARY KEY (tid, mid)
  );
  CREATE TABLE team (
    tid INTEGER PRIMARY KEY,
    name TEXT,
    geaendert TEXT NOT NULL
  );
  `,
  `
  -- Transfermarktsuche: jede Suche mit allen gelesenen Spielern (Rohantwort steht in rohseite)
  CREATE TABLE markt_suche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zeit TEXT NOT NULL,
    treffer INTEGER NOT NULL,      -- totalHits laut Antwort
    seiten INTEGER NOT NULL
  );
  CREATE TABLE markt_spieler (
    suche_id INTEGER NOT NULL,
    pid INTEGER NOT NULL,
    daten_json TEXT NOT NULL,      -- MarktSpieler
    PRIMARY KEY (suche_id, pid)
  );
  -- abgelehnte Vorschläge, werden nie wieder vorgeschlagen (bis zur Rücknahme)
  CREATE TABLE markt_ablehnung (
    pid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    datum TEXT NOT NULL
  );
  `,
  `
  -- Rahmen wird seit 25.10.2026 wie im Gebotsfenster gespeichert (markt_rahmen)
  DELETE FROM einstellung WHERE schluessel IN ('markt_kapital', 'markt_auslaender_frei');
  `,
  `
  -- Topteams der Managerwertung, deren Spiele als Lernmaterial gespeichert werden
  CREATE TABLE top_team (
    tid INTEGER PRIMARY KEY,
    rang INTEGER NOT NULL,
    name TEXT NOT NULL,
    quelle TEXT NOT NULL,          -- woher die Liste stammt (Rangliste mit Datum oder mz-wissen.md)
    stand TEXT NOT NULL
  );
  `,
  `
  -- Taktik-Archiv: eigene Reiter mit XML aus dem Editor (exportTactic)
  CREATE TABLE taktik (
    reiter TEXT PRIMARY KEY,
    xml TEXT NOT NULL,
    gespeichert TEXT NOT NULL,
    quelle TEXT NOT NULL
  );
  `,
  `
  -- Kader fremder Teams (Kaderseite ?p=players&tid=…): Alter und Marktwert je Spieler
  CREATE TABLE gegner_kader (
    tid INTEGER NOT NULL,
    pid INTEGER NOT NULL,
    name TEXT NOT NULL,
    alter_jahre INTEGER,
    wert INTEGER,
    stand TEXT NOT NULL,
    PRIMARY KEY (tid, pid)
  );
  `,
  `
  -- Wöchentliches Archiv der Top-10-Auswertung (Stand der Erkenntnisse, geht nicht verloren)
  CREATE TABLE top_archiv (
    datum TEXT PRIMARY KEY,        -- JJJJ-MM-TT (Berlin)
    spiele INTEGER NOT NULL,
    auswertung_json TEXT NOT NULL
  );
  `,
  `
  -- Topteam-Spiele als kompaktes Muster ohne Spielernamen (keine komplette Stats-XML)
  CREATE TABLE top_spiel (
    mid INTEGER NOT NULL,
    tid INTEGER NOT NULL,
    datum TEXT,
    art TEXT NOT NULL,             -- liga | weltliga
    muster_json TEXT NOT NULL,     -- SpielMuster (anonym)
    gespeichert TEXT NOT NULL,
    PRIMARY KEY (mid, tid)
  );
  CREATE INDEX top_spiel_tid ON top_spiel(tid, art, datum);
  `,
  `
  -- Muster Version 2 (Rollen nach Vorgabe vom 25.10.2026, Spielstand bei Taktikwechseln, Torverlauf):
  -- alte Muster verwerfen, der nächste Abruf holt die Stats-XML neu
  DELETE FROM top_spiel;
  `,
  `
  -- Von Marcus bestätigte zusätzliche Scoutbericht-Kombinationen (Sterne + Schlüsselwort -> Rang)
  CREATE TABLE scout_kombi (
    hoch INTEGER NOT NULL,
    niedrig INTEGER NOT NULL,
    schluessel TEXT NOT NULL,
    rang INTEGER NOT NULL,
    abzeichen TEXT NOT NULL,
    bestaetigt TEXT NOT NULL,
    PRIMARY KEY (hoch, niedrig, schluessel)
  );
  `,
  `
  -- Chat entfernt (Marcus, 25.10.2026): gespeicherten Gesprächsverlauf löschen
  DELETE FROM einstellung WHERE schluessel = 'chat';
  `,
  `
  -- Login-Verlauf vom 25.10.2026 enthielt die Login-Adresse mit md5 des Passworts: löschen (künftig geschwärzt)
  DELETE FROM rohseite WHERE art IN ('login-verlauf', 'login-ergebnis');
  `,
  `
  -- Spieltag-Automatik (Marcus, 26.10.2026): je Lauf das ausgewertete eigene Ligaspiel und das nächste Ligaspiel
  -- laut Spielplan (Anstoß als UTC), dazu die kommenden Spiele aus dem Spielplan als JSON
  CREATE TABLE spieltag_lauf (
    id INTEGER PRIMARY KEY,
    gestartet TEXT NOT NULL,
    beendet TEXT,
    ok INTEGER,
    letztes_mid INTEGER,
    naechstes_mid INTEGER,
    gegner_tid INTEGER,
    gegner_name TEXT,
    anstoss TEXT,
    heim INTEGER,
    plan_json TEXT,
    meldung TEXT
  );
  `,
  `
  -- Wertbereich-Statistik (Marcus, 26.10.2026): je Spiel Startelf- und gewichteter Feld-Wert beider Teams,
  -- Verhältnis und Ergebnis aus Sicht von Team A, Einstellungen. Quoten je Wertbereich = Abfrage darauf.
  CREATE TABLE wert_spiel (
    mid INTEGER PRIMARY KEY,
    datum TEXT,
    wettbewerb TEXT NOT NULL,
    tid_a INTEGER NOT NULL,
    tid_b INTEGER NOT NULL,
    name_a TEXT,
    name_b TEXT,
    elf_a INTEGER,
    elf_b INTEGER,
    feld_a INTEGER,
    feld_b INTEGER,
    verhaeltnis_elf REAL,
    verhaeltnis_feld REAL,
    tore_a INTEGER,
    tore_b INTEGER,
    ergebnis_a TEXT,
    einstellung_a TEXT,
    einstellung_b TEXT,
    fehlende_werte INTEGER NOT NULL DEFAULT 0,
    gespeichert TEXT NOT NULL
  );
  CREATE INDEX wert_spiel_v ON wert_spiel(verhaeltnis_elf);
  `,
  `
  -- Aufstellungen und Wechsel je Spiel, damit die Werte ohne neuen Abruf neu berechnet werden können. Erster Scan
  -- (26.10.2026) lief ohne Marktwerte der fremden Teams: diese Zeilen verwerfen, der nächste Scan holt sie neu.
  ALTER TABLE wert_spiel ADD COLUMN aufstellung_json TEXT;
  DELETE FROM wert_spiel;
  `,
  `
  -- Bietomat (Marcus, 26.10.2026): Gebotsaufträge für selbst eingegebene oder vorgeschlagene Spieler und
  -- ein Protokoll jedes Schritts (Laden, Gebot, Ergebnis)
  CREATE TABLE gebot_auftrag (
    pid INTEGER PRIMARY KEY,
    name TEXT,
    maximum INTEGER NOT NULL,
    bieten_bis TEXT,
    auktion_ende TEXT,
    spieler_json TEXT,
    status TEXT NOT NULL,
    erstellt TEXT NOT NULL,
    geaendert TEXT NOT NULL
  );
  CREATE TABLE gebot_log (
    id INTEGER PRIMARY KEY,
    pid INTEGER NOT NULL,
    zeit TEXT NOT NULL,
    betrag INTEGER,
    text TEXT NOT NULL
  );
  `,
  // 19: Letzter Verkauf je Spieler aus dem Kasten "Transfers" seiner Spielerseite (Marcus, 26.10.2026)
  `
  CREATE TABLE spieler_verkauf (
    pid INTEGER PRIMARY KEY,
    preis INTEGER,                 -- EUR, NULL = noch nie verkauft
    datum TEXT,                    -- Datum des letzten Verkaufs (JJJJ-MM-TT)
    transfers INTEGER NOT NULL,    -- Zeilen in der Tabelle (inklusive Jugend-Zugang)
    stand TEXT NOT NULL
  );
  `,
  // 20: "bieten bis" abgeschafft (Marcus, 26.10.2026: bieten bis zum Endpreis, egal wie lange sich die Auktion
  // verlängert). Gespeicherte Werte löschen; die Spalte bleibt, wird aber nicht mehr benutzt.
  `
  UPDATE gebot_auftrag SET bieten_bis = NULL;
  `,
  // 21: Watchlist des Transfermarkts (angenommene Vorschläge mit Momentaufnahme des Spielers) und eigene Entscheidung je
  // Jugendspieler behalten/abgeben (Marcus, 31.10.2026)
  `
  CREATE TABLE markt_watch (
    pid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    spieler_json TEXT NOT NULL,    -- MarktSpieler beim Annehmen
    bewertung_json TEXT,           -- Rolle, Gewinn, Preis beim Annehmen
    aufgenommen TEXT NOT NULL
  );
  CREATE TABLE jugend_entscheidung (
    pid INTEGER PRIMARY KEY,
    entscheidung TEXT NOT NULL CHECK (entscheidung IN ('behalten', 'abgeben')),
    geaendert TEXT NOT NULL
  );
  `,
  // 22: Scoutspiele gegen kommende Gegner, automatisch geholt (Marcus, 31.10.2026: mit einem Klick auswerten)
  `
  CREATE TABLE scout_spiel (
    mid INTEGER PRIMARY KEY,
    gegner_tid INTEGER NOT NULL,
    gegner_name TEXT,
    datum TEXT,
    auswertung_json TEXT NOT NULL, -- StatsSpiel
    abgerufen TEXT NOT NULL
  );
  `,
  // 23: Ligatabelle mit Startelf je Team (letztes Ligaspiel laut Tabelle) und Weltrang (Marcus, 31.10.2026)
  `
  CREATE TABLE liga_elf (
    tid INTEGER PRIMARY KEY,
    mid INTEGER NOT NULL,
    datum TEXT,
    elf_json TEXT NOT NULL, -- pids der Startelf
    abgerufen TEXT NOT NULL
  );
  CREATE TABLE liga_rang (
    tid INTEGER PRIMARY KEY,
    rang INTEGER,
    stand TEXT NOT NULL
  );
  `,
];

// Schema auf den neuesten Stand bringen (Migrationen der Reihe nach)
export function migrieren(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  for (let i = version; i < MIGRATIONEN.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONEN[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
