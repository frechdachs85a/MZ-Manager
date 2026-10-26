import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { de, formation } from "./gegner";

// Steckbrief eines Gegners aus seinen Ligaspielen (Vorbild: Sydney-Übersicht von Marcus, 26.10.2026).
// Alles aus den Stats-XML: Ergebnisse, Schüsse aufs Tor, Torschützen und Vorlagen, Minuten der Gegentore,
// Startelf mit Namen und Editor-Koordinaten und wie oft sie gleich war.

export type SteckbriefSpiel = {
  mid: number;
  datum?: string;
  heim: boolean;
  gegner: string;
  tore: { eigen: number; gegner: number };
  ergebnis: "S" | "U" | "N";
  schuesseTor?: number;
  gegentorMinuten: number[];
  einstellung: string;
  formation: string;
  elf: { name: string; x: number; y: number; torwart: boolean }[];
};

export type Steckbrief = {
  spiele: SteckbriefSpiel[]; // ältestes zuerst, wie in der Saison
  bilanz: { S: number; U: number; N: number; tore: number; gegentore: number };
  einstellungen: [string, number][];
  torschuetzen: [string, number][];
  vorlagen: [string, number][];
  // Häufigste Startelf (gleiche Spieler auf gleichen Plätzen, ±2 Punkte) und in wie vielen Spielen sie stand
  // positionen = Spiele mit denselben Plätzen (egal wer dort stand), spiele = zusätzlich dieselben Spieler
  stammElf: { spiele: number; positionen: number; von: number; elf: SteckbriefSpiel["elf"]; abweichungen: { mid: number; datum?: string; text: string }[] } | null;
  breite?: { min: number; max: number }; // äußerste x der Feldspieler in der Stammelf
};

const zaehle = (xs: string[]): [string, number][] => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

// Gleiche Plätze (±2 Punkte), unabhängig davon, wer dort stand
const gleichePlaetze = (a: SteckbriefSpiel["elf"], b: SteckbriefSpiel["elf"]) => {
  if (a.length !== b.length) return false;
  const frei = [...b];
  for (const p of a) {
    const i = frei.findIndex((q) => q.torwart === p.torwart && Math.abs(q.x - p.x) <= 2 && Math.abs(q.y - p.y) <= 2);
    if (i < 0) return false;
    frei.splice(i, 1);
  }
  return true;
};

const gleich = (a: SteckbriefSpiel["elf"], b: SteckbriefSpiel["elf"]) =>
  a.length === b.length && a.every((p) => b.some((q) => q.name === p.name && Math.abs(q.x - p.x) <= 2 && Math.abs(q.y - p.y) <= 2));

export function steckbrief(tid: number, stats: StatsSpiel[]): Steckbrief {
  const spiele: SteckbriefSpiel[] = stats
    .filter((s) => s.teams.some((t) => t.id === tid))
    .sort((a, b) => (a.datum ?? "").localeCompare(b.datum ?? "") || a.mid - b.mid)
    .map((s) => {
      const t = s.teams.find((x) => x.id === tid)!;
      const g = s.teams.find((x) => x.id !== tid)!;
      const eigen = Number(t.statistik.goals ?? NaN);
      const gegner = Number(g.statistik.goals ?? NaN);
      const elf = s.spieler
        .filter((p) => p.teamId === tid && p.editor)
        .map((p) => ({ name: p.name, x: p.editor!.x, y: p.editor!.y, torwart: p.torwart }))
        .sort((a, b) => Number(b.torwart) - Number(a.torwart) || b.y - a.y || a.x - b.x);
      return {
        mid: s.mid,
        datum: s.datum,
        heim: t.heim,
        gegner: g.name,
        tore: { eigen, gegner },
        ergebnis: eigen > gegner ? "S" : eigen < gegner ? "N" : "U",
        schuesseTor: t.statistik.shotsOnGoal !== undefined ? Number(t.statistik.shotsOnGoal) : undefined,
        gegentorMinuten: s.tore.filter((x) => x.teamId !== tid).map((x) => x.minute),
        einstellung: `${de(t.tactic)} / ${de(t.playstyle)} / ${de(t.aggression)}`,
        formation: formation(elf.filter((p) => !p.torwart)).text,
        elf,
      };
    });

  const torschuetzen: string[] = [];
  const vorlagen: string[] = [];
  for (const s of stats.filter((x) => x.teams.some((t) => t.id === tid))) {
    const name = new Map(s.spieler.map((p) => [p.id, p.name]));
    for (const t of s.tore.filter((x) => x.teamId === tid)) {
      torschuetzen.push(name.get(t.schuetze) ?? `id ${t.schuetze}`);
      if (t.vorlage) vorlagen.push(name.get(t.vorlage) ?? `id ${t.vorlage}`);
    }
  }

  // Stammelf: die Startelf, die in den meisten Spielen gleich war
  let stammElf: Steckbrief["stammElf"] = null;
  for (const kandidat of spiele) {
    const gleiche = spiele.filter((s) => gleich(s.elf, kandidat.elf));
    if (!stammElf || gleiche.length > stammElf.spiele) {
      stammElf = {
        spiele: gleiche.length,
        positionen: spiele.filter((s) => gleichePlaetze(s.elf, kandidat.elf)).length,
        von: spiele.length,
        elf: kandidat.elf,
        abweichungen: spiele
          .filter((s) => !gleich(s.elf, kandidat.elf))
          .map((s) => {
            const neu = s.elf.filter((p) => !kandidat.elf.some((q) => q.name === p.name)).map((p) => p.name);
            const fehlt = kandidat.elf.filter((p) => !s.elf.some((q) => q.name === p.name)).map((p) => p.name);
            const umgestellt = s.elf.filter((p) => {
              const q = kandidat.elf.find((x) => x.name === p.name);
              return q && (Math.abs(q.x - p.x) > 2 || Math.abs(q.y - p.y) > 2);
            }).length;
            const teile = [
              neu.length ? `${neu.join(", ")} statt ${fehlt.join(", ")}` : "",
              umgestellt ? `${umgestellt} Spieler auf anderen Plätzen (${s.formation})` : "",
            ].filter(Boolean);
            return { mid: s.mid, datum: s.datum, text: `gegen ${s.gegner}: ${teile.join("; ")}` };
          }),
      };
    }
  }
  const feld = stammElf?.elf.filter((p) => !p.torwart) ?? [];
  return {
    spiele,
    bilanz: {
      S: spiele.filter((s) => s.ergebnis === "S").length,
      U: spiele.filter((s) => s.ergebnis === "U").length,
      N: spiele.filter((s) => s.ergebnis === "N").length,
      tore: spiele.reduce((n, s) => n + s.tore.eigen, 0),
      gegentore: spiele.reduce((n, s) => n + s.tore.gegner, 0),
    },
    einstellungen: zaehle(spiele.map((s) => s.einstellung)),
    torschuetzen: zaehle(torschuetzen),
    vorlagen: zaehle(vorlagen),
    stammElf,
    breite: feld.length ? { min: Math.min(...feld.map((p) => p.x)), max: Math.max(...feld.map((p) => p.x)) } : undefined,
  };
}
