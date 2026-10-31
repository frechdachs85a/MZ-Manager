import type Database from "better-sqlite3";
import { ladeTeamSpiele } from "@/lib/db/gegner";
import { ladeGegnerKader } from "@/lib/db/gegner-kader";
import { ladeKader } from "@/lib/db/kader";
import { startelfAusLetztemSpiel } from "@/lib/db/markt";
import { ladeSpiel } from "@/lib/db/spiele";
import { letzteLigaspiele } from "@/lib/mz/parser/spielliste";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { TEAM } from "@/lib/wissen/startbasis";
import { wertverlauf } from "@/lib/mz/analyse/wertverlauf";

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

// Startelf-Wert von dir und dem Gegner
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

// Startelf-Wert beider Teams in einem bestimmten Spiel: Startelf aus der Stats-XML, Marktwert aus der eigenen
// Kaderseite bzw. der gespeicherten Kaderseite des Gegners (heutiger Stand, nicht der Wert am Spieltag).
export function startelfWerte(db: Database.Database, spiel: StatsSpiel): Record<number, (ElfWert & { stand?: string }) | null> {
  const eigen = new Map(ladeKader(db).map((s) => [s.pid, s]));
  const out: Record<number, (ElfWert & { stand?: string }) | null> = {};
  for (const t of spiel.teams) {
    const elf = spiel.spieler.filter((p) => p.teamId === t.id && p.origin);
    if (t.id === TEAM.tid) {
      out[t.id] = { spiel: { mid: spiel.mid, datum: spiel.datum }, ...auswerten(elf.map((p) => ({ name: p.name, wert: eigen.get(p.id)?.marktwert, alter: eigen.get(p.id)?.alter }))) };
    } else {
      const gk = ladeGegnerKader(db, t.id);
      const nachPid = new Map(gk.map((s) => [s.pid, s]));
      out[t.id] = gk.length
        ? { spiel: { mid: spiel.mid, datum: spiel.datum }, stand: gk[0]?.stand, ...auswerten(elf.map((p) => ({ name: p.name, wert: nachPid.get(p.id)?.wert, alter: nachPid.get(p.id)?.alter }))) }
        : null;
    }
  }
  return out;
}

// Teamwert nach Spielzeit in einem gespielten Spiel (Marcus, 30.10.2026: ein Wert je Team): jeder Spieler zählt mit
// seinen tatsächlich gespielten Minuten (Startelf und Wechsel aus der Stats-XML), Summe ÷ 90 Minuten. Beispiel: 70 Min.
// ein Spieler mit 1 Mio und 20 Min. einer mit 0,5 Mio ergeben 1 × 70/90 + 0,5 × 20/90. Wert, Anzahl mit Marktwert und
// Fehlende wie startelfWerte; summe ist der gewichtete Wert.
export function spielzeitWerte(db: Database.Database, spiel: StatsSpiel): Record<number, (ElfWert & { stand?: string }) | null> {
  const basis = startelfWerte(db, spiel);
  const [a, b] = spiel.teams;
  if (!a || !b) return basis;
  const eigen = new Map(ladeKader(db).map((s) => [s.pid, s.marktwert]));
  const fremd = new Map<number, number | undefined>();
  for (const t of spiel.teams) if (t.id !== TEAM.tid) for (const s of ladeGegnerKader(db, t.id)) fremd.set(s.pid, s.wert ?? undefined);
  const elf = (tid: number) => spiel.spieler.filter((p) => p.teamId === tid && p.origin).map((p) => p.id);
  const wechsel = (tid: number) => spiel.wechsel.filter((w) => w.teamId === tid).map((w) => ({ minute: w.minute, raus: w.raus, rein: w.rein }));
  const v = wertverlauf({
    eigeneElf: elf(a.id),
    gegnerElf: elf(b.id),
    eigeneWechsel: wechsel(a.id),
    gegnerWechsel: wechsel(b.id),
    wert: (pid) => (eigen.has(pid) ? eigen.get(pid) : fremd.get(pid)),
    name: (pid) => spiel.spieler.find((p) => p.id === pid)?.name ?? `pid ${pid}`,
  });
  const out = { ...basis };
  if (out[a.id]) out[a.id] = { ...out[a.id]!, summe: v.gewichtet.eigen };
  if (out[b.id]) out[b.id] = { ...out[b.id]!, summe: v.gewichtet.gegner };
  return out;
}
