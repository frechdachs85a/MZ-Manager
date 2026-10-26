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

// Auftrag anlegen oder ersetzen
export function speichereAuftrag(db: Database.Database, a: Omit<GebotAuftrag, "erstellt" | "geaendert">, zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO gebot_auftrag (pid, name, maximum, bieten_bis, auktion_ende, spieler_json, status, erstellt, geaendert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(pid) DO UPDATE SET name = excluded.name, maximum = excluded.maximum, bieten_bis = excluded.bieten_bis, auktion_ende = excluded.auktion_ende,
       spieler_json = excluded.spieler_json, status = excluded.status, geaendert = excluded.geaendert`,
  ).run(a.pid, a.name ?? null, a.maximum, a.bietenBis ?? null, a.auktionEnde ?? null, a.spieler ? JSON.stringify(a.spieler) : null, a.status, zeit, zeit);
}

// Alle Aufträge, aktive zuerst, nach Auktionsende
export function ladeAuftraege(db: Database.Database): GebotAuftrag[] {
  return (db.prepare("SELECT * FROM gebot_auftrag ORDER BY status = 'aktiv' DESC, auktion_ende").all() as Zeile[]).map(aus);
}

// Endpreis ändern (Marcus, 26.10.2026: Gebot bearbeitbar). Ein wegen Endpreis beendeter Auftrag wird
// wieder aktiv, solange die Auktion nicht vorbei ist; ob sie vorbei ist, prüft der Bietomat selbst.
export function aendereAuftrag(db: Database.Database, pid: number, maximum: number, zeit = new Date().toISOString()) {
  db.prepare("UPDATE gebot_auftrag SET maximum = ?, bieten_bis = NULL, status = 'aktiv', geaendert = ? WHERE pid = ?").run(maximum, zeit, pid);
}

// Status eines Auftrags setzen
export function setzeStatus(db: Database.Database, pid: number, status: GebotStatus, zeit = new Date().toISOString()) {
  db.prepare("UPDATE gebot_auftrag SET status = ?, geaendert = ? WHERE pid = ?").run(status, zeit, pid);
}

// Auftrag löschen
export function loescheAuftrag(db: Database.Database, pid: number) {
  db.prepare("DELETE FROM gebot_auftrag WHERE pid = ?").run(pid);
}

// Eintrag im Bietomat-Protokoll
export function protokolliere(db: Database.Database, pid: number, text: string, betrag?: number, zeit = new Date().toISOString()) {
  db.prepare("INSERT INTO gebot_log (pid, zeit, betrag, text) VALUES (?, ?, ?, ?)").run(pid, zeit, betrag ?? null, text);
}

// Neueste Protokolleinträge (alle oder eines Spielers)
export function ladeProtokoll(db: Database.Database, pid?: number, n = 50): { pid: number; zeit: string; betrag: number | null; text: string }[] {
  return db
    .prepare(`SELECT pid, zeit, betrag, text FROM gebot_log ${pid ? "WHERE pid = ?" : ""} ORDER BY id DESC LIMIT ?`)
    .all(...(pid ? [pid, n] : [n])) as { pid: number; zeit: string; betrag: number | null; text: string }[];
}

// Vorrang des Bietomats (Marcus, 26.10.2026): kurz vor und während einer Auktion mit aktivem Auftrag starten keine
// anderen Abrufe. VORLAUF deckt den längsten Abruf ab (Wertscan bis ca. 26 Minuten, gemessen 26.10.2026); NACHLAUF
// deckt Verlängerungen ab (jedes Gebot in den letzten 3 Minuten verlängert um 3 Minuten).
export const VORLAUF_MIN = 45;
export const NACHLAUF_MIN = 60;
let bietomatLaeuft = false;
export const setzeBietomatLaeuft = (an: boolean) => {
  bietomatLaeuft = an;
};
// Grund, warum gerade keine anderen Abrufe laufen dürfen, sonst null
export function bietomatSperrt(db: Database.Database, jetzt = new Date()): string | null {
  if (bietomatLaeuft) return "Bietomat bietet gerade";
  const von = new Date(jetzt.getTime() - NACHLAUF_MIN * 60_000).toISOString();
  const bis = new Date(jetzt.getTime() + VORLAUF_MIN * 60_000).toISOString();
  const a = db
    .prepare("SELECT name, pid, auktion_ende FROM gebot_auftrag WHERE status = 'aktiv' AND auktion_ende BETWEEN ? AND ? ORDER BY auktion_ende LIMIT 1")
    .get(von, bis) as { name: string | null; pid: number; auktion_ende: string } | undefined;
  return a ? `Auktion von ${a.name ?? a.pid} endet ${a.auktion_ende}` : null;
}
