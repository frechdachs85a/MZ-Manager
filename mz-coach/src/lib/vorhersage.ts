import { gegnerKlasse, spielMuster } from "@/lib/mz/analyse/muster";
import type { Steckbrief } from "@/lib/mz/analyse/steckbrief";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { TEAM } from "@/lib/wissen/startbasis";

// Wie stellt der Gegner gegen DICH auf? (Marcus, 01.11.2026: „wie Schere, Stein, Papier … du sollst berechnen, wie er
// gegen mich spielen wird“). Reihenfolge:
// 1. Trend: Hat er zuletzt mindestens zweimal hintereinander gleich aufgestellt, macht er es wieder so.
// 2. Gegen Gegner wie dich: Er wechselt. Dann die Aufstellung, die er zuletzt gegen Teams gewählt hat, die so spielen wie
//    du zuletzt (Gegnertyp aus deinen letzten Ligaspielen: Fünferkette, enge Mitte oder mit Außenspielern).
// 3. Sonst seine häufigste Aufstellung (bei Gleichstand die neueste).
export type Vorhersage = { mid: number; grund: "trend" | "wie-du" | "haeufigste"; text: string; deinTyp?: string };

const datum = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join(".").slice(0, 6) : "?");

export function vorhersage(tid: number, stats: StatsSpiel[], brief: Steckbrief, unsere: StatsSpiel[]): Vorhersage | null {
  if (!brief.spiele.length) return null;
  const neueste = brief.spiele.at(-1)!;
  if (brief.stammElf?.trend) {
    return { mid: neueste.mid, grund: "trend", text: `Trend: die letzten ${brief.stammElf.trend} Ligaspiele gleich aufgestellt (${neueste.formation}, ${neueste.einstellung}) → so erwartet.` };
  }
  // Dein Typ aus deinen letzten 3 Ligaspielen (häufigster, bei Gleichstand der neueste)
  const meine = [...unsere].sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? "")).slice(0, 3);
  const typen = meine.map((s) => gegnerKlasse(spielMuster(s, TEAM.tid, { anonym: true }).eigen));
  const zaehl = new Map<(typeof typen)[number], number>();
  for (const t of typen) zaehl.set(t, (zaehl.get(t) ?? 0) + 1);
  const deinTyp = typen.length ? [...zaehl.entries()].sort((a, b) => b[1] - a[1] || typen.indexOf(a[0]) - typen.indexOf(b[0]))[0][0] : undefined;
  if (deinTyp) {
    const gegenSolche = stats
      .filter((s) => s.teams.some((t) => t.id === tid))
      .filter((s) => gegnerKlasse(spielMuster(s, tid, { anonym: true }).gegner) === deinTyp)
      .sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
    if (gegenSolche.length) {
      const juengstes = brief.spiele.find((x) => x.mid === gegenSolche[0].mid);
      if (juengstes) {
        const gleicheFormation = gegenSolche.filter((s) => brief.spiele.find((x) => x.mid === s.mid)?.formation === juengstes.formation).length;
        return {
          mid: juengstes.mid,
          grund: "wie-du",
          deinTyp,
          text: `Er stellt wechselnd auf. Gegen Gegner wie dich („${deinTyp}“, aus deinen letzten Ligaspielen) spielte er zuletzt am ${datum(juengstes.datum)} gegen ${juengstes.gegner} ${juengstes.formation} (${juengstes.einstellung}); so in ${gleicheFormation} von ${gegenSolche.length} solchen Spielen → so erwartet.`,
        };
      }
    }
  }
  const haeufig = brief.stammElf ? brief.spiele.find((x) => x.elf === brief.stammElf!.elf) : undefined;
  const ziel = haeufig ?? neueste;
  return {
    mid: ziel.mid,
    grund: "haeufigste",
    deinTyp,
    text: `Er stellt wechselnd auf${deinTyp ? ` und hat noch nicht gegen einen Gegner wie dich („${deinTyp}“) gespielt` : ""}: seine häufigste Aufstellung (${ziel.formation}, ${ziel.einstellung}) → so erwartet.`,
  };
}
