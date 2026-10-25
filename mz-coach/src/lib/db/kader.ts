import type Database from "better-sqlite3";
import { aenderungen, type SpielerDaten } from "@/lib/mz/spieler";

// Schnappschuss nur, wenn sich der Stand gegenüber dem letzten Schnappschuss des Spielers geändert hat
// (kein Datenmüll bei unveränderten Abrufen; der Verlauf bleibt vollständig).
function schnappschuss(db: Database.Database) {
  const letzter = db.prepare("SELECT daten_json FROM spieler_snapshot WHERE pid = ? ORDER BY abgerufen DESC, id DESC LIMIT 1");
  const ins = db.prepare("INSERT INTO spieler_snapshot (pid, abgerufen, quelle, daten_json) VALUES (?, ?, ?, ?)");
  return {
    run(pid: number, zeit: string, quelle: string, json: string) {
      const l = letzter.get(pid) as { daten_json: string } | undefined;
      if (l?.daten_json !== json) ins.run(pid, zeit, quelle, json);
    },
  };
}

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
  const snap = schnappschuss(db);
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
    for (const k of kader) {
      const vorher = alt.get(k.pid) as { daten_json: string } | undefined;
      // Status stammt aus anderen Seiten (Verletzt/Gesperrt, Trainingslager) und bleibt erhalten.
      const s = vorher ? behalteStatus(JSON.parse(vorher.daten_json), k) : k;
      const json = JSON.stringify(s);
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

const STATUS_FELDER = [
  "status",
  "statusStand",
  "sperren",
  "trainingslagerInfo",
  "scoutSterne",
  "scoutMarkierung",
  "scoutTraining",
  "nationalitaet",
  "arbeitsbewilligung",
] as const;

function behalteStatus(alt: SpielerDaten, neu: SpielerDaten): SpielerDaten {
  const out = { ...neu };
  for (const f of STATUS_FELDER) {
    if (out[f] === undefined && alt[f] !== undefined) Object.assign(out, { [f]: alt[f] });
  }
  return out;
}

// Ändert alle aktiven Spieler über `aendern` (z. B. Status aus einer Status-Seite):
// Schnappschuss, Änderungsliste und aktueller Stand wie bei speichereKader.
export function aktualisiereSpieler(
  db: Database.Database,
  aendern: (alt: SpielerDaten) => SpielerDaten,
  quelle: string,
  zeit = new Date().toISOString(),
): { spieler: number; aenderungen: number } {
  const rows = db.prepare("SELECT pid, daten_json FROM spieler WHERE aktiv = 1").all() as {
    pid: number;
    daten_json: string;
  }[];
  const snap = schnappschuss(db);
  const aend = db.prepare(
    "INSERT INTO spieler_aenderung (pid, datum, feld, alt, neu, quelle) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const upd = db.prepare("UPDATE spieler SET daten_json = ? WHERE pid = ?");
  let anzahl = 0;
  db.transaction(() => {
    for (const r of rows) {
      const alt = JSON.parse(r.daten_json) as SpielerDaten;
      const neu = aendern(alt);
      for (const a of aenderungen(alt, neu)) {
        aend.run(r.pid, zeit, a.feld, a.alt, a.neu, quelle);
        anzahl++;
      }
      const json = JSON.stringify(neu);
      snap.run(r.pid, zeit, quelle, json);
      upd.run(json, r.pid);
    }
  })();
  return { spieler: rows.length, aenderungen: anzahl };
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
