import { ABWEHR_Y } from "./gegner";

// Seitenvergleich nach Marktwert (Marcus, 26.10.2026): über welche Seite angreifen? Editor-x 8 bis 200, Mitte 104.
// Links/rechts aus Sicht des Gegners (sein Tor unten). Gegenüber liegt jeweils deine andere Seite
// (Spiegelung x_eigen = 208 − x, mz-wissen.md, Abschnitt 13): seine linke Seite = deine rechte Angriffsseite.
export const LINKS_BIS = 80;
export const RECHTS_AB = 128;

export type SeitenSpieler = { name: string; x: number; y: number; wert?: number; torwart?: boolean };
export type Seite = { seite: "links" | "mitte" | "rechts"; abwehr: SeitenSpieler[]; alle: SeitenSpieler[]; abwehrSchnitt?: number; alleSumme: number };

const seiteVon = (x: number): Seite["seite"] => (x < LINKS_BIS ? "links" : x > RECHTS_AB ? "rechts" : "mitte");
const mio = (n?: number) => (n === undefined ? "Wert n. v." : `${(n / 1_000_000).toFixed(2).replace(".", ",")} Mio`);

export function seitenVergleich(elf: SeitenSpieler[]): { seiten: Seite[]; text?: string; kurz?: string[] } {
  const feld = elf.filter((p) => !p.torwart);
  const seiten: Seite[] = (["links", "mitte", "rechts"] as const).map((seite) => {
    const alle = feld.filter((p) => seiteVon(p.x) === seite);
    const abwehr = alle.filter((p) => p.y >= ABWEHR_Y);
    const mitWert = abwehr.filter((p) => p.wert !== undefined);
    return {
      seite,
      abwehr,
      alle,
      abwehrSchnitt: mitWert.length ? mitWert.reduce((n, p) => n + p.wert!, 0) / mitWert.length : undefined,
      alleSumme: alle.reduce((n, p) => n + (p.wert ?? 0), 0),
    };
  });
  const l = seiten[0];
  const r = seiten[2];
  if (l.abwehrSchnitt === undefined || r.abwehrSchnitt === undefined) return { seiten };
  const schwach = l.abwehrSchnitt <= r.abwehrSchnitt ? l : r;
  const stark = schwach === l ? r : l;
  const deine = schwach.seite === "links" ? "rechte" : "linke";
  const unterschied = Math.round((1 - schwach.abwehrSchnitt! / stark.abwehrSchnitt!) * 100);
  return {
    seiten,
    kurz: [
      `Schwächer: ${schwach.seite} (${schwach.abwehr.map((p) => `${p.name} ${mio(p.wert)}`).join(", ")})`,
      `Stärker: ${stark.seite} (${stark.abwehr.map((p) => `${p.name} ${mio(p.wert)}`).join(", ")})`,
      `→ Über deine ${deine} Seite angreifen`,
    ],
    text:
      `Seine schwächere Abwehrseite ist ${schwach.seite} (${schwach.abwehr.map((p) => `${p.name} ${mio(p.wert)}`).join(", ")}), ` +
      `${unterschied} % weniger wert als ${stark.seite} (${stark.abwehr.map((p) => `${p.name} ${mio(p.wert)}`).join(", ")}). ` +
      `Ihr gegenüber liegt deine ${deine} Angriffsseite.`,
  };
}
