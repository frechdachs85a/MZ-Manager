import { describe, expect, it } from "vitest";
import { erzeugeDrossel } from "./drossel";

describe("Drossel", () => {
  it("lässt höchstens maxParallel Aufgaben gleichzeitig laufen", async () => {
    const drossel = erzeugeDrossel({ maxParallel: 2, pauseMinMs: 0, pauseMaxMs: 0, warte: async () => {} });
    let gleichzeitig = 0;
    let max = 0;
    const aufgabe = async () => {
      gleichzeitig++;
      max = Math.max(max, gleichzeitig);
      await new Promise((r) => setTimeout(r, 5));
      gleichzeitig--;
    };
    await Promise.all(Array.from({ length: 6 }, () => drossel(aufgabe)));
    expect(max).toBe(2);
  });

  it("pausiert zwischen den Starts, nicht vor dem ersten", async () => {
    const pausen: number[] = [];
    const drossel = erzeugeDrossel({
      maxParallel: 3,
      pauseMinMs: 2000,
      pauseMaxMs: 4000,
      warte: async (ms) => void pausen.push(ms),
      zufall: () => 0.5,
    });
    await Promise.all([1, 2, 3].map((n) => drossel(async () => n)));
    expect(pausen).toEqual([3000, 3000]);
  });

  it("gibt Ergebnisse und Fehler weiter und blockiert danach nicht", async () => {
    const drossel = erzeugeDrossel({ maxParallel: 1, pauseMinMs: 0, pauseMaxMs: 0, warte: async () => {} });
    await expect(drossel(async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(drossel(async () => 42)).resolves.toBe(42);
  });
});
