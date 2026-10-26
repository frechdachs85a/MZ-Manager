import { ABWEHR_Y } from "@/lib/mz/analyse/gegner";
import { istAussen, STURM_Y } from "./pruefer";

// Besetzung gegen einen bestimmten Gegner (Regeln von Marcus, 26.10.2026):
// 1. Spielt er über außen (Einstellung Flügel oder Stürmer/Flügelspieler außen), stehen in der Innenverteidigung die
//    Spieler mit dem besten Kopfball. Spielt er eng, zählt hinten nur die Stärke.
// 2. Wo seine stärksten Angreifer stehen, stehen deine stärksten Verteidiger.
// 3. Angreifen dort, wo seine Abwehr schwächer ist: ist deine Formation einseitig, wird sie dafür gespiegelt.
// Die Gewichte (bis +15 % für den Platz gegenüber seinem stärksten Angreifer, Kopfball × 0,08) sind eigene
// Setzungen, keine MZ-Regel: Sie sollen bei ähnlich starken Spielern entscheiden, nicht einen klar Besseren verdrängen.

export type GegnerFeld = { x: number; y: number; wert?: number; torwart?: boolean; label?: string }; // seine Sicht
export const spiegelX = (x: number) => 208 - x;
const MAX_WERT = 1_500_000; // ab hier dunkelrot in der Heatmap
const DROHUNG_PLUS = 0.15;
export const KOPFBALL_GEWICHT = 0.08;

export type GegnerGewichte = {
  feld: { x: number; y: number }[]; // ggf. gespiegelt
  faktor: number[];
  kopfball: boolean[];
  ueberAussen: boolean;
  gespiegelt: boolean;
  kurz: string[];
};

const mio = (n: number) => `${(n / 1_000_000).toFixed(2).replace(".", ",")} Mio`;

export function gegnerGewichte(opt: {
  feld: { x: number; y: number }[]; // deine 10 Feldspieler-Plätze (Editor)
  gegner: GegnerFeld[];
  seinStil?: string; // häufigste Einstellung, z. B. "Flügel / offensiv / normal"
  angriffUeber?: "links" | "rechts"; // deine Seite laut Seitenvergleich
}): GegnerGewichte {
  const kurz: string[] = [];
  // Seine Angreifer in deiner Sicht: Sturm (y ≤ 110) und Außenspieler vor der Abwehr
  const angreifer = opt.gegner
    .filter((p) => !p.torwart && (p.y <= STURM_Y || (istAussen(p.x) && p.y < ABWEHR_Y)))
    .map((p) => ({ ...p, x: spiegelX(p.x) }));
  const fluegelStil = /^Flügel/i.test(opt.seinStil ?? "");
  const aussenAngreifer = angreifer.filter((p) => istAussen(p.x));
  const ueberAussen = fluegelStil || aussenAngreifer.length > 0;
  kurz.push(
    ueberAussen
      ? `Er spielt über außen (${[fluegelStil ? "Einstellung Flügel" : "", aussenAngreifer.length ? `${aussenAngreifer.length} Angreifer außen` : ""].filter(Boolean).join(", ")}) → Innenverteidiger nach Kopfball`
      : "Er spielt eng → hinten die stärksten Verteidiger, Kopfball nachrangig",
  );

  // Einseitige Formation zur schwächeren Seite drehen: Außen vor der Abwehr links gegen rechts zählen
  let feld = opt.feld;
  let gespiegelt = false;
  const vorne = feld.filter((p) => p.y < ABWEHR_Y && istAussen(p.x));
  const rechts = vorne.filter((p) => p.x >= 104).length;
  const links = vorne.length - rechts;
  if (opt.angriffUeber && rechts !== links) {
    const lastig = rechts > links ? "rechts" : "links";
    if (lastig !== opt.angriffUeber) {
      feld = feld.map((p) => ({ x: spiegelX(p.x), y: p.y }));
      gespiegelt = true;
      kurz.push(`Formation gespiegelt: Angriff über deine ${opt.angriffUeber === "rechts" ? "rechte" : "linke"} Seite (seine schwächere)`);
    } else kurz.push(`Angriff schon über deine ${lastig === "rechts" ? "rechte" : "linke"} Seite (seine schwächere)`);
  }

  // Bedrohung je Abwehrplatz: Wert seines nächsten Angreifers (gespiegelt)
  const faktor = feld.map((p) => {
    if (p.y < ABWEHR_Y || !angreifer.length) return 1;
    const naechster = [...angreifer].sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    return 1 + DROHUNG_PLUS * Math.min(1, (naechster.wert ?? 0) / MAX_WERT);
  });
  const staerkster = angreifer.filter((p) => p.wert !== undefined).sort((a, b) => b.wert! - a.wert!)[0];
  if (staerkster) kurz.push(`Sein stärkster Angreifer: ${staerkster.label ?? "?"} ${mio(staerkster.wert!)} → dort dein stärkster Verteidiger`);
  const kopfball = feld.map((p) => ueberAussen && p.y >= ABWEHR_Y && !istAussen(p.x));
  return { feld, faktor, kopfball, ueberAussen, gespiegelt, kurz };
}
