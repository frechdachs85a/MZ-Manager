import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ladeKader, letzteAenderungen } from "@/lib/db/kader";
import { migrieren } from "@/lib/db/schema";
import { dateienEinlesen } from "./kader";

vi.mock("server-only", () => ({}));

// Echte Seiten vom 24.10.2026, nur lokal vorhanden (nicht im öffentlichen Repo).
// Fehlt eine, werden die Tests dazu übersprungen.
const lies = (name: string) => {
  const url = new URL(`../parser/fixtures/${name}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : null;
};
const TABELLE = lies("kader-alt-2026-10-24.html");
const UNAVAILABLE = lies("unavailable-2026-10-24.html");
const TRAININGSLAGER = lies("trainingslager-2026-10-24.html");
const TAKTIK = lies("taktik-2026-10-24.html");

// Die echte Kaderseite enthält die Serverzeit in einem Skript, die Fixture nur die Tabelle.
const kader = (zeit: string) => ({ name: "kader.html", html: `<script>server_time = new Date(${zeit});</script>${TABELLE}` });

function frischeDb() {
  const db = new Database(":memory:");
  migrieren(db);
  return db;
}

describe.skipIf(!TABELLE)("Kaderübersicht aus Datei", () => {
  it("speichert alle Spieler mit Stand aus der Serverzeit", () => {
    const db = frischeDb();
    expect(dateienEinlesen(db, [kader("2026, 9, 24, 22, 48, 40")])).toEqual({
      ok: true,
      meldung: "Kaderübersicht: 47 Spieler, 47 neu, 0 Änderungen.",
    });
    const peschke = ladeKader(db).find((s) => s.pid === 229926290)!;
    expect(peschke.abgerufen).toBe("2026-10-24T20:48:40.000Z");
  });

  it("dieselbe Seite nicht doppelt, ältere nicht über neuere", () => {
    const db = frischeDb();
    dateienEinlesen(db, [kader("2026, 9, 24, 22, 48, 40")]);
    expect(dateienEinlesen(db, [kader("2026, 9, 24, 22, 48, 40")]).meldung).toContain("schon eingelesen");
    expect(dateienEinlesen(db, [kader("2026, 9, 23, 10, 0, 0")]).meldung).toContain("älter");
    expect(db.prepare("SELECT count(*) AS n FROM spieler_snapshot").get()).toEqual({ n: 47 });
  });

  it("erkennt Änderungen gegenüber dem letzten Stand", () => {
    const db = frischeDb();
    dateienEinlesen(db, [kader("2026, 9, 24, 22, 48, 40")]);
    // Kaupa Sprint 6 -> 5 (konstruiert für den Test)
    const k = kader("2026, 9, 25, 9, 0, 0");
    const html = k.html.replace(/(pid=226471405[\s\S]*?<td align="right">67<\/td><td align="right" class="maxed">)6</, "$15<");
    expect(html).not.toBe(k.html);
    expect(dateienEinlesen(db, [{ name: "b.html", html }]).meldung).toContain("1 Änderungen");
  });

  it("unbekannte Datei: klare Meldung, nichts gespeichert", () => {
    const db = frischeDb();
    const r = dateienEinlesen(db, [{ name: "x.html", html: "<html><title>Logout - Managerzone</title></html>" }]);
    expect(r.ok).toBe(false);
    expect(r.meldung).toContain("Unbekannte Seite");
    expect(ladeKader(db)).toHaveLength(0);
  });
});

describe.skipIf(!TABELLE || !UNAVAILABLE || !TRAININGSLAGER || !TAKTIK)("Status-Seiten", () => {
  const alleVier = () => [
    { name: "taktik.html", html: TAKTIK! },
    { name: "tl.html", html: TRAININGSLAGER! },
    { name: "unav.html", html: UNAVAILABLE! },
    kader("2026, 9, 24, 22, 48, 40"),
  ];

  it("liest alle vier Seiten in einem Rutsch, Kader zuerst", () => {
    const db = frischeDb();
    const r = dateienEinlesen(db, alleVier());
    expect(r.ok).toBe(true);
    expect(r.meldung.startsWith("Kaderübersicht: 47 Spieler")).toBe(true);
    const nach = (pid: number) => ladeKader(db).find((s) => s.pid === pid)!;

    // Rote Karte, nur im Pokal gesperrt
    expect(nach(227322975).status?.gesperrt).toBe(true);
    expect(nach(227322975).sperren).toEqual([
      { karte: "Rote Karte", wettbewerb: "Tag der Deutschen Einheit Pokal 2026", spiele: 1, art: "Offizieller Pokal", datum: "2026-10-24" },
    ]);
    // Keine Verletzten laut Seite
    expect(ladeKader(db).every((s) => s.status?.verletzt === false)).toBe(true);

    // Im Trainingslager, aber aufstellbar (kein Kegel auf der Taktikseite)
    expect(nach(230162433).status).toMatchObject({ trainingslager: true, aufstellbar: true });
    expect(nach(230162433).trainingslagerInfo).toMatchObject({ paket: "Torjägerpaket Nr. 5", ende: "2026-11-03" });
    // Trainingslager mit Kegel = nicht aufstellbar
    expect(nach(229926290).status).toMatchObject({ trainingslager: true, aufstellbar: false });
    // Jugendaufbau-Trainingslager, aufstellbar
    expect(nach(237476811).status).toMatchObject({ trainingslager: true, aufstellbar: true });

    // 7 Kegel auf der Taktikseite, alle im Trainingslager; 12 im Trainingslager insgesamt
    const kaderJetzt = ladeKader(db);
    const nichtAufstellbar = kaderJetzt.filter((s) => s.status?.aufstellbar === false);
    expect(nichtAufstellbar).toHaveLength(7);
    expect(nichtAufstellbar.every((s) => s.status?.trainingslager)).toBe(true);
    expect(kaderJetzt.filter((s) => s.status?.trainingslager)).toHaveLength(12);
    expect(nach(225496434).statusStand).toEqual({
      verletzt: "2026-10-24T20:57:36.000Z",
      gesperrt: "2026-10-24T20:57:36.000Z",
      trainingslager: "2026-10-24T20:57:52.000Z",
      aufstellbar: "2026-10-24T21:00:12.000Z",
    });
  });

  it("Status bleibt beim nächsten Kader-Upload erhalten, Status-Änderungen landen im Verlauf", () => {
    const db = frischeDb();
    dateienEinlesen(db, alleVier());
    dateienEinlesen(db, [kader("2026, 9, 25, 9, 0, 0")]);
    expect(ladeKader(db).find((s) => s.pid === 229926290)!.status?.aufstellbar).toBe(false);

    // Spieler ohne Kegel (konstruiert): Änderung "Aufstellbar nein -> ja"
    const taktik = TAKTIK!.replace('<dd class="tc ui-draggable" id="n_229926290">', '<dd class="draggable ui-draggable" id="n_229926290">')
      .replace("server_time = new Date(2026, 9, 24, 23, 0, 12)", "server_time = new Date(2026, 9, 25, 9, 5, 0)");
    expect(dateienEinlesen(db, [{ name: "t2.html", html: taktik }]).ok).toBe(true);
    expect(letzteAenderungen(db, 5)).toContainEqual(
      expect.objectContaining({ pid: 229926290, feld: "Aufstellbar", alt: "nein", neu: "ja" }),
    );
  });

  it("Status-Seite ohne Kader: klare Meldung", () => {
    const db = frischeDb();
    expect(dateienEinlesen(db, [{ name: "unav.html", html: UNAVAILABLE! }]).meldung).toContain("Erst die Kaderübersicht");
  });
});
