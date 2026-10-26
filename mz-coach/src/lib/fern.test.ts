import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrieren } from "@/lib/db/schema";
import { ABRUF_PAUSE_MIN, FERN_BIS, fernAbrufFrei, fernErlaubt } from "./fern";

// Der echte Schlüssel steht nicht im Repo (nur sein Hash), deshalb hier nur die Ablehnungsfälle und die Bremse.
const aus = process.env.FERN_AUS;
afterEach(() => {
  if (aus === undefined) delete process.env.FERN_AUS;
  else process.env.FERN_AUS = aus;
});

describe("Fernzugang", () => {
  it("lehnt fehlenden, falsch geformten und falschen Schlüssel ab", () => {
    delete process.env.FERN_AUS;
    expect(fernErlaubt(null)).toBe(false);
    expect(fernErlaubt("Basic abc")).toBe(false);
    expect(fernErlaubt("Bearer falsch")).toBe(false);
  });

  it("ist nach Ablauf und mit FERN_AUS aus", () => {
    expect(fernErlaubt("Bearer egal", new Date(new Date(FERN_BIS).getTime() + 1000))).toBe(false);
    process.env.FERN_AUS = "1";
    expect(fernErlaubt("Bearer egal")).toBe(false);
  });

  it("bremst je Abrufart", () => {
    const db = new Database(":memory:");
    migrieren(db);
    const t = new Date("2026-10-26T10:00:00Z");
    expect(fernAbrufFrei(db, "kader", t).frei).toBe(true);
    expect(fernAbrufFrei(db, "kader", new Date(t.getTime() + 60_000)).frei).toBe(false);
    expect(fernAbrufFrei(db, "markt", new Date(t.getTime() + 60_000)).frei).toBe(true);
    expect(fernAbrufFrei(db, "kader", new Date(t.getTime() + ABRUF_PAUSE_MIN * 60_000 + 1)).frei).toBe(true);
  });
});
