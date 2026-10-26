import { describe, expect, it } from "vitest";
import { seitenVergleich } from "./seiten";

describe("Seitenvergleich", () => {
  it("Sydney: Roos links 0,85 Mio schwächer als Zhou rechts 1,15 Mio -> deine rechte Angriffsseite", () => {
    const r = seitenVergleich([
      { name: "Guderian", x: 104, y: 318, wert: 1080813, torwart: true },
      { name: "Knapp", x: 103, y: 241, wert: 891600 },
      { name: "Roos", x: 65, y: 215, wert: 852886 },
      { name: "Zhou", x: 142, y: 215, wert: 1148904 },
      { name: "Lopez", x: 103, y: 190, wert: 1176714 },
      { name: "Reifer", x: 62, y: 168, wert: 947764 },
    ]);
    expect(r.seiten.map((s) => s.abwehr.map((p) => p.name))).toEqual([["Roos"], ["Knapp"], ["Zhou"]]);
    expect(r.text).toContain("schwächere Abwehrseite ist links (Roos 0,85 Mio)");
    expect(r.text).toContain("26 % weniger wert als rechts (Zhou 1,15 Mio)");
    expect(r.text).toContain("deine rechte Angriffsseite");
  });
});
