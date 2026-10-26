import { describe, expect, it } from "vitest";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { parseTaktikXml } from "./xml";
import { pruefeTaktik } from "./pruefer";
import { erzeugeTaktik, zuordnen } from "./erzeugen";

describe("Zuordnung (ungarische Methode)", () => {
  it("findet die beste Gesamtzuordnung, nicht die gierige", () => {
    // gierig: Zeile 0 nimmt Spalte 0 (Kosten 1), Zeile 1 muss Spalte 1 (10) -> 11; optimal 2 + 2 = 4
    expect(zuordnen([[1, 2], [2, 10]])).toEqual([1, 0]);
    expect(zuordnen([[5, 1, 9], [1, 5, 9]])).toEqual([1, 0]);
  });
});

const alle = (w: number) =>
  Object.fromEntries(["sprint", "ausdauer", "spieluebersicht", "passen", "schuss", "kopfball", "torwart", "technik", "zweikampf", "flanken", "erfahrung"].map((s) => [s, { wert: w }]));
const spieler = (pid: number, w: number, extra: Partial<SpielerDaten> = {}): SpielerDaten => ({
  pid, name: `S${pid}`, skills: alle(w), status: { aufstellbar: true }, statusStand: { aufstellbar: "2026-10-26" }, ...extra,
});

describe("Taktik erzeugen", () => {
  const feld = [
    { x: 26, y: 224 }, { x: 76, y: 224 }, { x: 125, y: 224 }, { x: 175, y: 224 },
    { x: 101, y: 183 }, { x: 151, y: 183 }, { x: 101, y: 135 },
    { x: 129, y: 95 }, { x: 82, y: 77 }, { x: 200, y: 63 },
  ];
  const kader = [
    ...Array.from({ length: 16 }, (_, i) => spieler(i + 1, 5 + (i % 5))),
    spieler(90, 9, { status: { aufstellbar: false } }),
    spieler(91, 9, { status: { aufstellbar: true, verletzt: true } }),
  ];
  const t = erzeugeTaktik({ feld, tactics: "wings", playstyle: "offensive", aggression: "normal", kader, spieltag: new Date(2026, 9, 28) });

  it("11 Spieler, 5 auf der Bank, keiner doppelt, Kegel und Verletzte draußen", () => {
    const x = parseTaktikXml(t.xml);
    expect(x.pos).toHaveLength(11);
    expect(x.subs).toHaveLength(5);
    const pids = [...x.pos, ...x.subs].map((p) => p.pid);
    expect(new Set(pids).size).toBe(16);
    expect(pids).not.toContain(90);
    expect(pids).not.toContain(91);
    expect(t.ausgeschlossen.map((a) => a.name).sort()).toEqual(["S90", "S91"]);
  });

  it("Rot-Regel ohne Wechsel, Prüfung ohne Fehler bei Regeln 1, 2, 5, 7, 8", () => {
    const x = parseTaktikXml(t.xml);
    expect(x.regeln).toHaveLength(1);
    expect(x.regeln[0]).toMatchObject({ player_event: "sent_off", out_player: "no_change", formation: "1" });
    const p = pruefeTaktik(x, kader);
    expect(p.fehler.filter((f) => [1, 2, 5, 7, 8].includes(f.regel))).toEqual([]);
  });
});
