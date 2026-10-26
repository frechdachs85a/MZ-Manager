// Datenbank: Marktsuchen, abgelehnte Spieler, Rahmen des Transfermarkts, Startelf des letzten Spiels.

import type Database from "better-sqlite3";
import type { Slot } from "@/lib/mz/analyse/markt";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { TEAM } from "@/lib/wissen/startbasis";

// Ergebnis einer Marktsuche speichern
export function speichereMarktSuche(
  db: Database.Database,
  s: { treffer: number; seiten: number; spieler: MarktSpieler[] },
  zeit = new Date().toISOString(),
): number {
  let id = 0;
  db.transaction(() => {
    id = Number(db.prepare("INSERT INTO markt_suche (zeit, treffer, seiten) VALUES (?, ?, ?)").run(zeit, s.treffer, s.seiten).lastInsertRowid);
    const ins = db.prepare("INSERT OR REPLACE INTO markt_spieler (suche_id, pid, daten_json) VALUES (?, ?, ?)");
    for (const p of s.spieler) ins.run(id, p.pid, JSON.stringify(p));
  })();
  return id;
}

export type MarktStand = { id: number; zeit: string; treffer: number; seiten: number; spieler: MarktSpieler[] };

// Neueste Marktsuche mit allen Spielern
export function ladeLetzteSuche(db: Database.Database): MarktStand | null {
  const s = db.prepare("SELECT id, zeit, treffer, seiten FROM markt_suche ORDER BY id DESC LIMIT 1").get() as
    | Omit<MarktStand, "spieler">
    | undefined;
  if (!s) return null;
  const rows = db.prepare("SELECT daten_json FROM markt_spieler WHERE suche_id = ?").all(s.id) as { daten_json: string }[];
  return { ...s, spieler: rows.map((r) => JSON.parse(r.daten_json) as MarktSpieler) };
}

// Spieler als abgelehnt merken
export function lehneAb(db: Database.Database, pid: number, name: string, zeit = new Date().toISOString()) {
  db.prepare("INSERT OR REPLACE INTO markt_ablehnung (pid, name, datum) VALUES (?, ?, ?)").run(pid, name, zeit);
}

// Ablehnung aufheben
export function nimmAblehnungZurueck(db: Database.Database, pid: number) {
  db.prepare("DELETE FROM markt_ablehnung WHERE pid = ?").run(pid);
}

// Abgelehnte Spieler
export function ladeAblehnungen(db: Database.Database): { pid: number; name: string; datum: string }[] {
  return db.prepare("SELECT pid, name, datum FROM markt_ablehnung ORDER BY datum DESC").all() as {
    pid: number;
    name: string;
    datum: string;
  }[];
}

// Rahmen wie im Gebotsfenster von ManagerZone (Verfügbarer Saldo, Ausländische Spieler n (maximum m),
// Arbeitsbewilligungen n (maximum m)). Trägt Marcus ein, kein Wert wird geschätzt.
export const RAHMEN_FELDER = ["kapital", "auslaender", "auslaenderMax", "bewilligungen", "bewilligungenMax"] as const;
export type RahmenFeld = (typeof RAHMEN_FELDER)[number];
export type MarktRahmenDaten = Record<RahmenFeld, number>;

// Gespeicherter Rahmen des Transfermarkts
export function ladeMarktRahmen(db: Database.Database): { werte: MarktRahmenDaten; geaendert: string } | null {
  const r = db.prepare("SELECT wert, geaendert FROM einstellung WHERE schluessel = 'markt_rahmen'").get() as
    | { wert: string; geaendert: string }
    | undefined;
  return r ? { werte: JSON.parse(r.wert) as MarktRahmenDaten, geaendert: r.geaendert } : null;
}

// Rahmen des Transfermarkts speichern
export function speichereMarktRahmen(db: Database.Database, r: MarktRahmenDaten, zeit = new Date().toISOString()) {
  db.prepare(
    "INSERT INTO einstellung (schluessel, wert, geaendert) VALUES ('markt_rahmen', ?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert",
  ).run(JSON.stringify(r), zeit);
}

// Startelf aus dem neuesten gespeicherten eigenen Spiel. Ligaspiele (laut Spielliste) haben Vorrang,
// weil in Freundschaftsspielen oft andere Spieler beginnen.
export function startelfAusLetztemSpiel(db: Database.Database): { spiel: { mid: number; datum?: string; liga: boolean }; elf: Slot[] } | null {
  const rows = db.prepare("SELECT auswertung_json FROM spiel WHERE auswertung_json IS NOT NULL").all() as { auswertung_json: string }[];
  const liga = new Set(
    (db.prepare("SELECT mid FROM team_spiel WHERE tid = ? AND art = 'Ligaspiel'").all(TEAM.tid) as { mid: number }[]).map((r) => r.mid),
  );
  const eigene = rows
    .map((r) => JSON.parse(r.auswertung_json) as StatsSpiel)
    .filter((s) => s.teams.some((t) => t.id === TEAM.tid))
    .sort((a, b) => Number(liga.has(b.mid)) - Number(liga.has(a.mid)) || (b.datum ?? "").localeCompare(a.datum ?? ""));
  const s = eigene[0];
  if (!s) return null;
  const elf = s.spieler
    .filter((p) => p.teamId === TEAM.tid && p.editor)
    .map((p) => ({ pid: p.id, x: p.editor!.x, y: p.editor!.y, torwart: p.torwart }));
  return { spiel: { mid: s.mid, datum: s.datum, liga: liga.has(s.mid) }, elf };
}
