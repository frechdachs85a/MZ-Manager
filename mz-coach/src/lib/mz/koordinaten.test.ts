import { describe, expect, it } from "vitest";
import { originZuEditor } from "./koordinaten";

describe("originZuEditor", () => {
  it("Torwart bei y=1000: x bleibt, d = 1000 − y", () => {
    // x: 0.2555*100+8.4 = 33.95 -> 34 ; d = 300 -> 318-93 = 225
    expect(originZuEditor({ x: 100, y: 700 }, 1000)).toEqual({ x: 34, y: 225 });
  });

  it("Torwart bei y=0: x wird gespiegelt, d = y", () => {
    // x' = 750-650 = 100 -> 34 ; d = 300 -> 225
    expect(originZuEditor({ x: 650, y: 300 }, 0)).toEqual({ x: 34, y: 225 });
  });

  it("beide Seiten liefern für gespiegelte Positionen dasselbe Ergebnis", () => {
    for (const [x, y] of [[375, 500], [120, 880], [600, 150]]) {
      expect(originZuEditor({ x, y }, 1000)).toEqual(originZuEditor({ x: 750 - x, y: 1000 - y }, 0));
    }
  });

  it("y wird vorne auf 63 begrenzt", () => {
    expect(originZuEditor({ x: 375, y: 0 }, 1000).y).toBe(63);
    expect(originZuEditor({ x: 375, y: 1000 }, 0).y).toBe(63);
  });

  // Vorgabe aus dem Auftrag: Spiel 1625669278 (Torwart bei origin-y 1000),
  // Cavalcante ≈ 103/63, Chille ≈ 33/223. Braucht die echte Stats-XML dieses Spiels,
  // die origin-Werte werden nicht erfunden.
  it.todo("Spiel 1625669278: Cavalcante ≈ 103/63, Chille ≈ 33/223 (wartet auf echte XML)");
});
