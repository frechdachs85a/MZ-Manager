import type Database from "better-sqlite3";
import { aenderungen, type SpielerDaten } from "@/lib/mz/spieler";

// Speichert einen kompletten Kaderabruf: Schnappschuss je Spieler, Änderungen gegen
// den vorherigen Stand, aktuellen Stand überschreiben. Spieler, die nicht mehr im
// Kader sind (verkauft), werden inaktiv gesetzt, nicht gelöscht.
export function speichereKader(
  db: Database.Database,
  kader: SpielerDaten[],
  quelle: string,
  zeit = new Date().toISOString(),
): { neu: number; aenderungen: number } {
  const alt = db.prepare("SELECT daten_json FROM spieler WHERE pid = ?");
  const snap = db.prepare(
    "INSERT INTO spieler_snapshot (pid, abgerufen, quelle, daten_json) VALUES (?, ?, ?, ?)",
  );
  const aend = db.prepare(
    "INSERT INTO spieler_aenderung (pid, datum, feld, alt, neu, quelle) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const upsert = db.prepare(`
    INSERT INTO spieler (pid, name, nr, alter_jahre, daten_json, quelle, abgerufen, aktiv)
    VALUES (@pid, @name, @nr, @alter, @daten, @quelle, @zeit, 1)
    ON CONFLICT(pid) DO UPDATE SET name=@name, nr=@nr, alter_jahre=@alter,
      daten_json=@daten, quelle=@quelle, abgerufen=@zeit, aktiv=1`);

  let neu = 0;
  let anzahl = 0;
  db.transaction(() => {
    for (const s of kader) {
      const json = JSON.stringify(s);
      const vorher = alt.get(s.pid) as { daten_json: string } | undefined;
      if (vorher) {
        for (const a of aenderungen(JSON.parse(vorher.daten_json), s)) {
          aend.run(s.pid, zeit, a.feld, a.alt, a.neu, quelle);
          anzahl++;
        }
      } else {
        neu++;
      }
      snap.run(s.pid, zeit, quelle, json);
      upsert.run({ pid: s.pid, name: s.name, nr: s.nr ?? null, alter: s.alter ?? null, daten: json, quelle, zeit });
    }
    const pids = kader.map((s) => s.pid);
    db.prepare(
      `UPDATE spieler SET aktiv = 0 WHERE pid NOT IN (${pids.map(() => "?").join(",") || "NULL"})`,
    ).run(...pids);
  })();
  return { neu, aenderungen: anzahl };
}

export type KaderEintrag = SpielerDaten & { quelle: string; abgerufen: string };

export function ladeKader(db: Database.Database): KaderEintrag[] {
  const rows = db
    .prepare("SELECT daten_json, quelle, abgerufen FROM spieler WHERE aktiv = 1 ORDER BY nr, name")
    .all() as { daten_json: string; quelle: string; abgerufen: string }[];
  return rows.map((r) => ({ ...JSON.parse(r.daten_json), quelle: r.quelle, abgerufen: r.abgerufen }));
}

export type AenderungEintrag = {
  pid: number;
  name: string;
  datum: string;
  feld: string;
  alt: string | null;
  neu: string | null;
};

export function letzteAenderungen(db: Database.Database, limit = 50): AenderungEintrag[] {
  return db
    .prepare(
      `SELECT a.pid, s.name, a.datum, a.feld, a.alt, a.neu
       FROM spieler_aenderung a JOIN spieler s ON s.pid = a.pid
       ORDER BY a.datum DESC, a.id DESC LIMIT ?`,
    )
    .all(limit) as AenderungEintrag[];
}
