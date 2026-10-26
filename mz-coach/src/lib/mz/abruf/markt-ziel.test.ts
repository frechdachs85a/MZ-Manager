import { describe, expect, it } from "vitest";
import { mzWert } from "@/lib/mz/formel";
import type { Schwachstelle } from "@/lib/mz/analyse/markt";
import { mitFiltern, sichereUntergrenze, suchZiele } from "./markt-ziel";

describe("gezielte Marktsuche", () => {
  it("ersetzt Formularfelder und hängt fehlende an", () => {
    expect(mitFiltern("&agea=19&s6a=0&s6b=10", { s6a: 8, s0a: 9 })).toBe("&agea=19&s6a=8&s6b=10&s0a=9");
  });

  it("Untergrenze ist sicher: genau darunter kann kein Spieler die Stelle verbessern", () => {
    const alt = 8.3;
    const min = sichereUntergrenze("TW", "torwart", alt);
    const alle10 = (tw: number) => Object.fromEntries(["sprint", "ausdauer", "spieluebersicht", "passen", "schuss", "kopfball", "technik", "zweikampf", "flanken", "erfahrung"].map((s) => [s, { wert: 10 }]).concat([["torwart", { wert: tw }]]));
    const w = (tw: number) => (mzWert(alle10(tw), "TW") as { wert: number }).wert;
    expect(w(min)).toBeGreaterThan(alt);
    expect(w(min - 1)).toBeLessThanOrEqual(alt);
  });

  it("je Rolle ein Ziel, schwächste zuerst, Torwart sucht über den Torwart-Skill", () => {
    const s = (rolle: Schwachstelle["rolle"], wert: number, name: string) => ({ rolle, wert, spieler: { pid: 1, name, skills: {} }, slot: { pid: 1, x: 0, y: 0, torwart: rolle === "TW" } }) as Schwachstelle;
    const z = suchZiele([s("MF", 8.4, "A"), s("TW", 8.1, "B"), s("MF", 8.2, "C"), s("VT", 8.6, "D")]);
    expect(z.map((x) => x.rolle)).toEqual(["TW", "MF", "VT"]);
    expect(z[0].hauptskill).toBe("torwart");
    expect(z[0].filter(9)).toEqual({ s0a: 9, s1a: 9, s6a: 9 });
    expect(z[0].stufen[0]).toBe(10);
  });
});
