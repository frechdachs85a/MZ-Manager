import type { ListenSpiel } from "@/lib/mz/parser/spielliste";

// Je Topteam die letzten 10 Liga- und 10 Weltligaspiele (Auftrag Marcus, 25.10.2026)
export const JE_ART = 10;

// Weltligaspiele erkennt die Seite am Text der Spielart oder des Wettbewerbs. Wie ManagerZone sie in der
// Spielliste beschriftet, ist noch nicht gesehen; erkannt wird "Welt"/"World" in Spielart oder Wettbewerb.
export const istWeltliga = (s: ListenSpiel) => /welt|world/i.test(`${s.art} ${s.wettbewerb ?? ""}`);
export const istLiga = (s: ListenSpiel) => s.art === "Ligaspiel" && !istWeltliga(s);

export function auswahlLernspiele(spiele: ListenSpiel[]): { liga: ListenSpiel[]; weltliga: ListenSpiel[] } {
  const neueste = (l: ListenSpiel[]) =>
    l
      .filter((s) => s.tore !== undefined)
      .sort((a, b) => `${b.datum} ${b.zeit ?? ""}`.localeCompare(`${a.datum} ${a.zeit ?? ""}`) || b.mid - a.mid)
      .slice(0, JE_ART);
  return { liga: neueste(spiele.filter(istLiga)), weltliga: neueste(spiele.filter(istWeltliga)) };
}

