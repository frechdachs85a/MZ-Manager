import type Database from "better-sqlite3";
import type { Verkauf } from "@/lib/mz/parser/verkauf";

// Datenbank: letzter Verkauf je Spieler (Migration 19), aus dem Kasten "Transfers" seiner Spielerseite.

export type GespeicherterVerkauf = Verkauf & { stand: string };

// Letzten Verkauf eines Spielers speichern (ersetzt den alten Stand)
export function speichereVerkauf(db: Database.Database, pid: number, v: Verkauf, zeit = new Date().toISOString()) {
  db.prepare(
    "INSERT INTO spieler_verkauf (pid, preis, datum, transfers, stand) VALUES (?, ?, ?, ?, ?) ON CONFLICT(pid) DO UPDATE SET preis = excluded.preis, datum = excluded.datum, transfers = excluded.transfers, stand = excluded.stand",
  ).run(pid, v.preis ?? null, v.datum ?? null, v.transfers, zeit);
}

// Gespeicherte Verkäufe aller Spieler, nach Spielernummer
export function ladeVerkaeufe(db: Database.Database): Map<number, GespeicherterVerkauf> {
  const rows = db.prepare("SELECT pid, preis, datum, transfers, stand FROM spieler_verkauf").all() as {
    pid: number;
    preis: number | null;
    datum: string | null;
    transfers: number;
    stand: string;
  }[];
  return new Map(rows.map((r) => [r.pid, { preis: r.preis ?? undefined, datum: r.datum ?? undefined, transfers: r.transfers, stand: r.stand }]));
}
