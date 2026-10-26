import type Database from "better-sqlite3";
import type { ListenSpiel } from "@/lib/mz/parser/spielliste";

export type SpieltagLauf = {
  id: number;
  gestartet: string;
  beendet: string | null;
  ok: boolean | null;
  letztesMid: number | null; // ausgewertetes eigenes Ligaspiel
  naechstesMid: number | null;
  gegnerTid: number | null;
  gegnerName: string | null;
  anstoss: string | null; // ISO (UTC)
  heim: boolean | null;
  plan: ListenSpiel[]; // kommende Spiele laut Spielplan
  meldung: string | null;
};

type Zeile = {
  id: number;
  gestartet: string;
  beendet: string | null;
  ok: number | null;
  letztes_mid: number | null;
  naechstes_mid: number | null;
  gegner_tid: number | null;
  gegner_name: string | null;
  anstoss: string | null;
  heim: number | null;
  plan_json: string | null;
  meldung: string | null;
};

const aus = (z: Zeile): SpieltagLauf => ({
  id: z.id,
  gestartet: z.gestartet,
  beendet: z.beendet,
  ok: z.ok === null ? null : z.ok === 1,
  letztesMid: z.letztes_mid,
  naechstesMid: z.naechstes_mid,
  gegnerTid: z.gegner_tid,
  gegnerName: z.gegner_name,
  anstoss: z.anstoss,
  heim: z.heim === null ? null : z.heim === 1,
  plan: z.plan_json ? (JSON.parse(z.plan_json) as ListenSpiel[]) : [],
  meldung: z.meldung,
});

export function laufBeginnen(db: Database.Database, zeit = new Date().toISOString()): number {
  return Number(db.prepare("INSERT INTO spieltag_lauf (gestartet) VALUES (?)").run(zeit).lastInsertRowid);
}

export type LaufDaten = {
  letztesMid?: number;
  naechstesMid?: number;
  gegnerTid?: number;
  gegnerName?: string;
  anstoss?: string;
  heim?: boolean;
  plan?: ListenSpiel[];
};

export function laufBeenden(db: Database.Database, id: number, ok: boolean, meldung: string, d: LaufDaten, zeit = new Date().toISOString()) {
  db.prepare(
    `UPDATE spieltag_lauf SET beendet = ?, ok = ?, meldung = ?, letztes_mid = ?, naechstes_mid = ?, gegner_tid = ?, gegner_name = ?,
       anstoss = ?, heim = ?, plan_json = ? WHERE id = ?`,
  ).run(
    zeit,
    ok ? 1 : 0,
    meldung,
    d.letztesMid ?? null,
    d.naechstesMid ?? null,
    d.gegnerTid ?? null,
    d.gegnerName ?? null,
    d.anstoss ?? null,
    d.heim === undefined ? null : d.heim ? 1 : 0,
    d.plan ? JSON.stringify(d.plan) : null,
    id,
  );
}

export function letzterLauf(db: Database.Database, nurOk = false): SpieltagLauf | null {
  const z = db.prepare(`SELECT * FROM spieltag_lauf ${nurOk ? "WHERE ok = 1" : ""} ORDER BY id DESC LIMIT 1`).get() as Zeile | undefined;
  return z ? aus(z) : null;
}

// Wurde dieses eigene Ligaspiel schon erfolgreich ausgewertet?
export function ausgewertet(db: Database.Database, mid: number): boolean {
  return !!db.prepare("SELECT 1 FROM spieltag_lauf WHERE ok = 1 AND letztes_mid = ?").get(mid);
}

// Fehlversuche seit dem letzten erfolgreichen Lauf
export function fehlversucheSeitOk(db: Database.Database): { anzahl: number; letzter: string | null } {
  const ok = (db.prepare("SELECT max(id) AS id FROM spieltag_lauf WHERE ok = 1").get() as { id: number | null }).id ?? 0;
  const r = db.prepare("SELECT COUNT(*) AS n, max(gestartet) AS z FROM spieltag_lauf WHERE id > ? AND ok = 0").get(ok) as { n: number; z: string | null };
  return { anzahl: r.n, letzter: r.z };
}
