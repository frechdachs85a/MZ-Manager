// Datenbank: Kader fremder Teams (Name, Alter, Marktwert).

import type Database from "better-sqlite3";
import type { SpielerBlock } from "@/lib/mz/parser/spielerblock";

export type GegnerSpieler = { pid: number; name: string; alter: number | null; wert: number | null; stand: string };

// Ersetzt den gespeicherten Kader eines Teams durch den neuen Stand
export function speichereGegnerKader(db: Database.Database, tid: number, spieler: SpielerBlock[], zeit = new Date().toISOString()) {
  db.transaction(() => {
    db.prepare("DELETE FROM gegner_kader WHERE tid = ?").run(tid);
    const ins = db.prepare("INSERT INTO gegner_kader (tid, pid, name, alter_jahre, wert, stand) VALUES (?, ?, ?, ?, ?, ?)");
    for (const s of spieler) ins.run(tid, s.pid, s.name, s.alter ?? null, s.wert ?? null, zeit);
  })();
}

// Gespeicherter Kader eines fremden Teams
export function ladeGegnerKader(db: Database.Database, tid: number): GegnerSpieler[] {
  return db.prepare('SELECT pid, name, alter_jahre AS "alter", wert, stand FROM gegner_kader WHERE tid = ?').all(tid) as GegnerSpieler[];
}
