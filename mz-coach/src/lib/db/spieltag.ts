// Datenbank: Läufe der Spieltag-Automatik (Spielplan, nächster Gegner, Anstoß).

import type Database from "better-sqlite3";
import type { ListenSpiel } from "@/lib/mz/parser/spielliste";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

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

// Lauf der Spieltag-Automatik beginnen
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

// Lauf abschließen mit Ergebnis und Daten
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

// Neuester Lauf (wahlweise nur erfolgreiche)
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

// Datum des nächsten Ligaspiels (Kalendertag in Berlin, 0 Uhr lokal wie naechsterLigaspieltag). Zuerst der Anstoß aus dem
// Spielplan (letzter erfolgreicher Spieltag-Lauf), solange er nicht vorbei ist. Sonst die Regel „mittwochs und sonntags“,
// aber nicht der heutige Tag, wenn das heutige Ligaspiel schon ausgewertet ist. Fehler bis 01.11.2026: am Sonntagabend galt
// noch der Sonntag als nächster Spieltag, Rückkehrer aus dem Trainingslager am Di 03.11. zählten fürs Mittwochsspiel nicht.
export function ligaspieltag(db: Database.Database, jetzt = new Date()): Date {
  const berlinTag = (d: Date) => {
    const t = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((p) => [p.type, p.value]));
    return new Date(Number(t.year), Number(t.month) - 1, Number(t.day));
  };
  const l = letzterLauf(db, true);
  if (l?.anstoss && Date.parse(l.anstoss) > jetzt.getTime() - 2 * 3600_000) return berlinTag(new Date(l.anstoss));
  const heute = berlinTag(jetzt);
  const regel = naechsterLigaspieltag(heute);
  if (regel.getTime() === heute.getTime() && l && berlinTag(new Date(l.gestartet)).getTime() === heute.getTime()) {
    const morgen = new Date(heute);
    morgen.setDate(morgen.getDate() + 1);
    return naechsterLigaspieltag(morgen);
  }
  return regel;
}
