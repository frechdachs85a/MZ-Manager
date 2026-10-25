import { describe, expect, it } from "vitest";
import type { ListenSpiel } from "@/lib/mz/parser/spielliste";
import { auswahlLernspiele, istWeltliga } from "./top-auswahl";

const spiel = (i: number, art: string, wettbewerb?: string, gespielt = true): ListenSpiel => ({
  mid: 1_700_000_000 + i,
  datum: `2026-10-${String(i).padStart(2, "0")}`,
  art,
  wettbewerb,
  altersklasse: false,
  heim: { name: "A" },
  gast: { name: "B" },
  tore: gespielt ? { heim: 1, gast: 0 } : undefined,
});

describe("Auswahl der Lernspiele", () => {
  it("je 10 neueste gespielte Liga- und Weltligaspiele, Pokal und Freundschaft nicht", () => {
    const l = [
      ...Array.from({ length: 12 }, (_, i) => spiel(i + 1, "Ligaspiel", "div1")),
      ...Array.from({ length: 3 }, (_, i) => spiel(i + 13, "Ligaspiel", "World League")),
      spiel(20, "Offizieller Pokal"),
      spiel(21, "Freundschaftsspiel"),
      spiel(22, "Ligaspiel", "div1", false),
    ];
    const { liga, weltliga } = auswahlLernspiele(l);
    expect(liga).toHaveLength(10);
    expect(liga[0].datum).toBe("2026-10-12");
    expect(weltliga.map((s) => s.datum)).toEqual(["2026-10-15", "2026-10-14", "2026-10-13"]);
    expect(istWeltliga(spiel(1, "Weltliga"))).toBe(true);
  });
});
