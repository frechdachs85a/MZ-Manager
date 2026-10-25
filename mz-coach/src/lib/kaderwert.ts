import type Database from "better-sqlite3";
import { ladeTeamSpiele } from "@/lib/db/gegner";
import { ladeGegnerKader } from "@/lib/db/gegner-kader";
import { ladeKader } from "@/lib/db/kader";
import { startelfAusLetztemSpiel } from "@/lib/db/markt";
import { ladeSpiel } from "@/lib/db/spiele";
import { letzteLigaspiele } from "@/lib/mz/parser/spielliste";

// Kaderwert-Vergleich (mz-wissen.md, Abschnitt 10: "Immer Kaderwert vergleichen: Startelf-Marktwert eigene
// Taktik gegen Gegner"). Eigene Startelf aus dem neuesten eigenen Spiel, gegnerische aus seinem neuesten
// gespeicherten Ligaspiel. Marktwert und Alter aus den Kaderseiten; fehlt ein Wert, wird er gemeldet.
export type ElfWert = { spiel?: { mid: number; datum?: string }; summe: number; alterSchnitt?: number; mitWert: number; spieler: number; fehlt: string[] };

function auswerten(werte: { name: string; wert: number | null | undefined; alter: number | null | undefined }[]): Omit<ElfWert, "spiel"> {
  const mit = werte.filter((w) => typeof w.wert === "number");
  const alter = werte.map((w) => w.alter).filter((a): a is number => typeof a === "number");
  return {
    summe: mit.reduce((n, w) => n + (w.wert as number), 0),
    alterSchnitt: alter.length ? alter.reduce((a, b) => a + b, 0) / alter.length : undefined,
    mitWert: mit.length,
    spieler: werte.length,
    fehlt: werte.filter((w) => typeof w.wert !== "number").map((w) => w.name),
  };
}

export function kaderwertVergleich(db: Database.Database, tid: number): { eigen: ElfWert | null; gegner: ElfWert | null; gegnerKaderStand?: string } {
  const kader = new Map(ladeKader(db).map((s) => [s.pid, s]));
  const start = startelfAusLetztemSpiel(db);
  const eigen: ElfWert | null = start
    ? {
        spiel: start.spiel,
        ...auswerten(start.elf.map((p) => ({ name: kader.get(p.pid)?.name ?? `pid ${p.pid}`, wert: kader.get(p.pid)?.marktwert, alter: kader.get(p.pid)?.alter }))),
      }
    : null;

  const gk = ladeGegnerKader(db, tid);
  const nachPid = new Map(gk.map((s) => [s.pid, s]));
  const letztes = letzteLigaspiele(ladeTeamSpiele(db, tid), 8).map((s) => ladeSpiel(db, s.mid)).find((s) => !!s);
  const gegner: ElfWert | null =
    letztes && gk.length
      ? {
          spiel: { mid: letztes.mid, datum: letztes.datum },
          ...auswerten(
            letztes.spieler
              .filter((p) => p.teamId === tid && p.editor)
              .map((p) => ({ name: p.name, wert: nachPid.get(p.id)?.wert, alter: nachPid.get(p.id)?.alter })),
          ),
        }
      : null;
  return { eigen, gegner, gegnerKaderStand: gk[0]?.stand };
}
