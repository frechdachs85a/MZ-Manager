import type Database from "better-sqlite3";
import { ladeRohseite, letzteRohseite } from "@/lib/db/abruf";
import { ladeGegnerKader } from "@/lib/db/gegner-kader";
import { ladeKader } from "@/lib/db/kader";
import { ladeLigaElfen, ladeLigaRaenge } from "@/lib/db/liga-team";
import { tabelleAus, type Tabelle } from "@/lib/mz/parser/tabelle";
import { TEAM } from "@/lib/wissen/startbasis";

// Ligatabelle mit Startelf-Wert und Weltrang je Team (Marcus, 31.10.2026).
// Startelf = die Elf aus dem letzten Ligaspiel des Teams (neueste mid der Spalte "Letzte 6 Spiele"), Startelf aus der
// Stats-XML. Marktwert je Spieler aus der gespeicherten Kaderseite des Teams (eigenes Team: eigener Kader), also der
// Wert vom Stand der Kaderseite, nicht vom Spieltag. Fehlt ein Wert, zählt er nicht mit und wird gemeldet.

export type TeamWert = { mid: number; datum?: string; summe: number; mitWert: number; spieler: number; kaderStand?: string };
export type TeamZusatz = { wert: TeamWert | null; rang: number | null; rangStand?: string };

// Gespeicherte Ligatabelle (neueste Seite "tabelle")
export function gespeicherteTabelle(db: Database.Database): { tabelle: Tabelle | null; stand?: string; gespeichert: boolean } {
  const roh = letzteRohseite(db, "tabelle");
  const html = roh ? (ladeRohseite(db, roh.id, "dom") ?? ladeRohseite(db, roh.id, "roh")) : null;
  return { tabelle: html ? tabelleAus(html.html, TEAM.name) : null, stand: roh?.abgerufen, gespeichert: !!roh };
}

// Neueste Ligaspiel-mid je Team aus "Letzte 6 Spiele" (größte mid = neuestes Spiel)
export function letzteMidJeTeam(t: Tabelle): Map<number, number> {
  const out = new Map<number, number>();
  for (const z of t.zeilen) {
    const mids = (z.letzte ?? []).map((l) => l.mid).filter((m): m is number => typeof m === "number");
    if (z.tid && mids.length) out.set(z.tid, Math.max(...mids));
  }
  return out;
}

// Startelf-Wert und Weltrang je tid
export function ligaTeamZusatz(db: Database.Database, t: Tabelle): Map<number, TeamZusatz> {
  const elfen = ladeLigaElfen(db);
  const raenge = ladeLigaRaenge(db);
  const letzte = letzteMidJeTeam(t);
  const eigen = new Map(ladeKader(db).map((s) => [s.pid, s.marktwert]));
  const out = new Map<number, TeamZusatz>();
  for (const z of t.zeilen) {
    if (!z.tid) continue;
    const e = elfen.get(z.tid);
    let wert: TeamWert | null = null;
    // Nur die Elf des Spiels zeigen, das die Tabelle als letztes nennt (sonst veraltet)
    if (e && (letzte.get(z.tid) === undefined || letzte.get(z.tid) === e.mid)) {
      const gk = z.tid === TEAM.tid ? [] : ladeGegnerKader(db, z.tid);
      const wertVon = z.tid === TEAM.tid ? (pid: number) => eigen.get(pid) : (pid: number) => gk.find((s) => s.pid === pid)?.wert ?? undefined;
      const werte = e.elf.map(wertVon).filter((w): w is number => typeof w === "number");
      if (z.tid === TEAM.tid || gk.length) {
        wert = { mid: e.mid, datum: e.datum, summe: werte.reduce((a, b) => a + b, 0), mitWert: werte.length, spieler: e.elf.length, kaderStand: gk[0]?.stand };
      }
    }
    const r = raenge.get(z.tid);
    out.set(z.tid, { wert, rang: r?.rang ?? null, rangStand: r?.stand });
  }
  return out;
}

export type TabellenSortierung = "punkte" | "wert" | "rang";

// Zeilen sortieren: Punkte = Reihenfolge von ManagerZone; Wert absteigend; Weltrang aufsteigend (ohne Wert ans Ende)
export function sortiereTabelle<Z extends { tid?: number }>(zeilen: Z[], sort: TabellenSortierung, zusatz: Map<number, TeamZusatz>): Z[] {
  if (sort === "punkte") return zeilen;
  const schluessel = (z: Z): number | undefined => {
    const x = z.tid ? zusatz.get(z.tid) : undefined;
    if (sort === "wert") return x?.wert && x.wert.mitWert > 0 ? -x.wert.summe : undefined;
    return x?.rang ?? undefined;
  };
  return [...zeilen]
    .map((z, i) => ({ z, i, k: schluessel(z) }))
    .sort((a, b) => (a.k === undefined ? 1 : 0) - (b.k === undefined ? 1 : 0) || (a.k ?? 0) - (b.k ?? 0) || a.i - b.i)
    .map((x) => x.z);
}
