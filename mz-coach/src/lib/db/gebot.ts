import type Database from "better-sqlite3";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";

// Bietomat: Aufträge und Protokoll (Migration 18)
export type GebotStatus = "aktiv" | "beendet" | "abgebrochen";
export type GebotAuftrag = {
  pid: number;
  name?: string;
  maximum: number;
  bietenBis?: string; // ISO: spätestens bis dann bieten (sonst bis Auktionsende)
  auktionEnde?: string; // ISO (UTC)
  spieler?: MarktSpieler;
  status: GebotStatus;
  erstellt: string;
  geaendert: string;
};

type Zeile = { pid: number; name: string | null; maximum: number; bieten_bis: string | null; auktion_ende: string | null; spieler_json: string | null; status: GebotStatus; erstellt: string; geaendert: string };
const aus = (z: Zeile): GebotAuftrag => ({
  pid: z.pid,
  name: z.name ?? undefined,
  maximum: z.maximum,
  bietenBis: z.bieten_bis ?? undefined,
  auktionEnde: z.auktion_ende ?? undefined,
  spieler: z.spieler_json ? (JSON.parse(z.spieler_json) as MarktSpieler) : undefined,
  status: z.status,
  erstellt: z.erstellt,
  geaendert: z.geaendert,
});

export function speichereAuftrag(db: Database.Database, a: Omit<GebotAuftrag, "erstellt" | "geaendert">, zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO gebot_auftrag (pid, name, maximum, bieten_bis, auktion_ende, spieler_json, status, erstellt, geaendert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(pid) DO UPDATE SET name = excluded.name, maximum = excluded.maximum, bieten_bis = excluded.bieten_bis, auktion_ende = excluded.auktion_ende,
       spieler_json = excluded.spieler_json, status = excluded.status, geaendert = excluded.geaendert`,
  ).run(a.pid, a.name ?? null, a.maximum, a.bietenBis ?? null, a.auktionEnde ?? null, a.spieler ? JSON.stringify(a.spieler) : null, a.status, zeit, zeit);
}

export function ladeAuftraege(db: Database.Database): GebotAuftrag[] {
  return (db.prepare("SELECT * FROM gebot_auftrag ORDER BY status = 'aktiv' DESC, auktion_ende").all() as Zeile[]).map(aus);
}

export function setzeStatus(db: Database.Database, pid: number, status: GebotStatus, zeit = new Date().toISOString()) {
  db.prepare("UPDATE gebot_auftrag SET status = ?, geaendert = ? WHERE pid = ?").run(status, zeit, pid);
}

export function loescheAuftrag(db: Database.Database, pid: number) {
  db.prepare("DELETE FROM gebot_auftrag WHERE pid = ?").run(pid);
}

export function protokolliere(db: Database.Database, pid: number, text: string, betrag?: number, zeit = new Date().toISOString()) {
  db.prepare("INSERT INTO gebot_log (pid, zeit, betrag, text) VALUES (?, ?, ?, ?)").run(pid, zeit, betrag ?? null, text);
}

export function ladeProtokoll(db: Database.Database, pid?: number, n = 50): { pid: number; zeit: string; betrag: number | null; text: string }[] {
  return db
    .prepare(`SELECT pid, zeit, betrag, text FROM gebot_log ${pid ? "WHERE pid = ?" : ""} ORDER BY id DESC LIMIT ?`)
    .all(...(pid ? [pid, n] : [n])) as { pid: number; zeit: string; betrag: number | null; text: string }[];
}
