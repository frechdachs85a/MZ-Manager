import { describe, expect, it } from "vitest";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { sperreGiltFuerLiga } from "./erzeugen";

const mit = (art: string[]) => ({ sperren: art.map((a) => ({ karte: "Rote Karte", wettbewerb: "x", spiele: 1, art: a, datum: "2026-10-24" })) }) as unknown as SpielerDaten;

describe("sperreGiltFuerLiga", () => {
  it("Pokalsperre betrifft die Liga nicht, unbekannte Art schon", () => {
    expect(sperreGiltFuerLiga(mit(["Offizieller Pokal"]))).toBe(false);
    expect(sperreGiltFuerLiga(mit(["Offizieller Pokal", "Liga"]))).toBe(true);
    expect(sperreGiltFuerLiga(mit([]))).toBe(true);
  });
});
