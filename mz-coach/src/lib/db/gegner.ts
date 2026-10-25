import type Database from "better-sqlite3";
import type { ListenSpiel, Spielliste } from "@/lib/mz/parser/spielliste";

export function speichereSpielliste(db: Database.Database, l: Spielliste, zeit = new Date().toISOString()): { neu: number } {
  const stand = l.serverzeit ?? zeit;
  const ins = db.prepare(
    `INSERT INTO team_spiel (tid, mid, datum, zeit, art, wettbewerb, daten_json, stand) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tid, mid) DO UPDATE SET daten_json = excluded.daten_json, stand = excluded.stand`,
  );
  const vorher = db.prepare("SELECT 1 FROM team_spiel WHERE tid = ? AND mid = ?");
  let neu = 0;
  db.transaction(() => {
    db.prepare(
      `INSERT INTO team (tid, name, geaendert) VALUES (?, ?, ?)
       ON CONFLICT(tid) DO UPDATE SET name = coalesce(excluded.name, team.name), geaendert = excluded.geaendert`,
    ).run(l.tid, l.teamName ?? null, stand);
    for (const s of l.spiele) {
      if (!vorher.get(l.tid, s.mid)) neu++;
      ins.run(l.tid, s.mid, s.datum, s.zeit ?? null, s.art, s.wettbewerb ?? null, JSON.stringify(s), stand);
    }
  })();
  return { neu };
}

export type GegnerZeile = { tid: number; name: string | null; liga: number; mitXml: number; stand: string };

export function listeGegner(db: Database.Database, ligaAb: number): GegnerZeile[] {
  return db
    .prepare(
      `SELECT t.tid, t.name, t.geaendert AS stand,
         (SELECT count(*) FROM team_spiel ts WHERE ts.tid = t.tid AND ts.art = 'Ligaspiel' AND ts.mid > ?) AS liga,
         (SELECT count(*) FROM team_spiel ts JOIN spiel s ON s.mid = ts.mid
            WHERE ts.tid = t.tid AND ts.art = 'Ligaspiel' AND ts.mid > ? AND s.stats_xml IS NOT NULL) AS mitXml
       FROM team t ORDER BY t.geaendert DESC`,
    )
    .all(ligaAb, ligaAb) as GegnerZeile[];
}

export function ladeTeamSpiele(db: Database.Database, tid: number): (ListenSpiel & { xml: boolean })[] {
  const rows = db
    .prepare(
      `SELECT ts.daten_json, s.stats_xml IS NOT NULL AS xml FROM team_spiel ts LEFT JOIN spiel s ON s.mid = ts.mid
       WHERE ts.tid = ? ORDER BY ts.datum DESC, ts.zeit DESC`,
    )
    .all(tid) as { daten_json: string; xml: number }[];
  return rows.map((r) => ({ ...JSON.parse(r.daten_json), xml: r.xml === 1 }));
}

export function teamName(db: Database.Database, tid: number): string | null {
  return (db.prepare("SELECT name FROM team WHERE tid = ?").get(tid) as { name: string | null } | undefined)?.name ?? null;
}
