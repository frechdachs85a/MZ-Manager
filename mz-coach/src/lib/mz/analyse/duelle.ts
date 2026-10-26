import { STURM_Y } from "@/lib/mz/taktik/pruefer";
import { ABWEHR_Y } from "./gegner";

// Duelle nach Marktwert (Marcus, 26.10.2026): wer steht welchem seiner Stürmer gegenüber? Seine Koordinaten aus
// seiner Sicht werden gespiegelt (x_eigen = 208 − x, mz-wissen.md, Abschnitt 13). Ideal: sein stärkster Stürmer gegen
// deinen stärksten Verteidiger usw.; passt die Lage nicht dazu, steht ein Tauschvorschlag da.
export type DuellSpieler = { name: string; x: number; y: number; wert?: number; torwart?: boolean };
export type Duell = { stuermer: DuellSpieler; xBeiDir: number; gegenueber: DuellSpieler; ideal?: DuellSpieler; tauschen: boolean };

const mio = (n?: number) => (n === undefined ? "Wert n. v." : `${(n / 1_000_000).toFixed(2).replace(".", ",")} Mio`);

export function duelle(eigene: DuellSpieler[], gegner: DuellSpieler[]): { duelle: Duell[]; saetze: string[] } {
  const stuermer = gegner.filter((p) => !p.torwart && p.y <= STURM_Y).sort((a, b) => (b.wert ?? 0) - (a.wert ?? 0));
  const abwehr = eigene.filter((p) => !p.torwart && p.y >= ABWEHR_Y);
  if (!stuermer.length || !abwehr.length) return { duelle: [], saetze: [] };
  const nachWert = [...abwehr].sort((a, b) => (b.wert ?? 0) - (a.wert ?? 0));
  const d: Duell[] = stuermer.map((st, i) => {
    const xBeiDir = 208 - st.x;
    const gegenueber = [...abwehr].sort((a, b) => Math.abs(a.x - xBeiDir) - Math.abs(b.x - xBeiDir))[0];
    const ideal = nachWert[i];
    const tauschen = !!ideal && ideal !== gegenueber && (ideal.wert ?? 0) > (gegenueber.wert ?? 0);
    return { stuermer: st, xBeiDir, gegenueber, ideal, tauschen };
  });
  const saetze = d.map(
    (x, i) =>
      `${i === 0 ? "Sein stärkster Stürmer" : `Sein ${i + 1}.-stärkster Stürmer`} ${x.stuermer.name} (${mio(x.stuermer.wert)}) kommt bei dir bei x ${x.xBeiDir} an; ` +
      `dort steht ${x.gegenueber.name} (${mio(x.gegenueber.wert)}).` +
      (x.tauschen && x.ideal ? ` Stärker wäre ${x.ideal.name} (${mio(x.ideal.wert)}): Plätze von ${x.ideal.name} und ${x.gegenueber.name} tauschen erwägen.` : ""),
  );
  return { duelle: d, saetze };
}
