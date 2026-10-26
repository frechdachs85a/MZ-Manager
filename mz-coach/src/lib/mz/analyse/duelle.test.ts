import { describe, expect, it } from "vitest";
import { duelle } from "./duelle";

describe("Duelle Stürmer gegen Verteidiger", () => {
  it("spiegelt seine Stürmer und schlägt einen Tausch vor, wenn der Stärkste gegen einen Schwächeren läuft", () => {
    const eigene = [
      { name: "Chille", x: 26, y: 224, wert: 925612 },
      { name: "Nazarov", x: 76, y: 224, wert: 1307990 },
      { name: "Vranken", x: 125, y: 224, wert: 965281 },
      { name: "Salzer", x: 175, y: 224, wert: 1172011 },
    ];
    const sydney = [
      { name: "Alberts", x: 120, y: 100, wert: 1315488 }, // bei dir x 88: Nazarov
      { name: "Gimenez", x: 74, y: 106, wert: 1081358 }, // bei dir x 134: Vranken
      { name: "Lenz", x: 91, y: 63, wert: 733878 }, // bei dir x 117: Vranken
      { name: "Knapp", x: 103, y: 241, wert: 891600 }, // kein Stürmer
    ];
    const r = duelle(eigene, sydney);
    expect(r.duelle.map((d) => [d.stuermer.name, d.xBeiDir, d.gegenueber.name, d.tauschen])).toEqual([
      ["Alberts", 88, "Nazarov", false],
      ["Gimenez", 134, "Vranken", true],
      ["Lenz", 117, "Vranken", false],
    ]);
    expect(r.saetze[1]).toContain("Stärker wäre Salzer");
  });
});
