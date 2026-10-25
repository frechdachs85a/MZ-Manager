import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { pruefeTaktik } from "./pruefer";
import { parseTaktikXml, TaktikXmlFehler } from "./xml";

// außenR nach mz-wissen.md, Abschnitt 8 (Feldkoordinaten und Regeln von dort; Rot seit 25.10.2026 ohne Wechsel).
// Konstruiert, weil dort nicht angegeben: Torwart-Position, Zuordnung der Spieler zu den Plätzen,
// Bank-Koordinaten (x 228, y laut Abschnitt 4). Noch keine echte exportierte Taktik.
const pos = (pid: number, x: number, y: number, goalie = false) =>
  `<Pos pos="${goalie ? "goalie" : "normal"}" pid="${pid}" x="${x}" y="${y}" x1="${x}" y1="${y}" x2="${x}" y2="${y}" pt="" fk="" />`;
const sub = (pid: number, y: number, goalie = false) => `<Sub pos="${goalie ? "subgoalie" : "sub"}" pid="${pid}" x="228" y="${y}" />`;
const regel = (a: Record<string, string>) => {
  const basis: Record<string, string> = {
    name: "Taktikregel", check_time: "false", time: "", check_goal_condition: "false", goal_condition: "tie", goals: "1",
    check_player_event: "false", player_event_player_type: "anyone", player_event: "sent_off", out_player: "no_change",
    in_player_id: "NULL", tactics: "no_change", playstyle: "no_change", aggression: "no_change", formation: "no_change",
  };
  return `<TacticRule ${Object.entries({ ...basis, ...a }).map(([k, v]) => `${k}="${v}"`).join(" ")} />`;
};

const P = {
  liu: 225496434, cytrynski: 225629108, nazarov: 227162857, chille: 229926279, salzer: 227393631, kaupa: 226471405,
  hyuga: 229906765, ishizaki: 230162433, cavalcante: 227653119, pinheiro: 226189000, schobel: 231999845,
  fleur: 229866139, rodekamp: 231999847, zahl: 231091969, vranken: 227322975,
};

const AUSSEN_R = `<SoccerTactics>
<Team tactics="wings" playstyle="offensive" aggression="normal" captain="${P.pinheiro}" />
${pos(P.liu, 104, 300, true)}
${pos(P.chille, 26, 224)}${pos(P.nazarov, 76, 224)}${pos(P.vranken, 125, 224)}${pos(P.zahl, 175, 224)}
${pos(P.cytrynski, 101, 183)}${pos(P.pinheiro, 151, 183)}${pos(P.schobel, 101, 135)}
${pos(P.cavalcante, 129, 95)}${pos(P.salzer, 82, 77)}${pos(P.hyuga, 200, 63)}
${sub(P.fleur, 117, true)}${sub(P.kaupa, 140)}${sub(P.rodekamp, 163)}${sub(P.ishizaki, 186)}${sub(225629999, 209)}
${regel({ check_time: "true", time: "50", out_player: String(P.hyuga), in_player_id: String(P.ishizaki) })}
${regel({ check_time: "true", time: "60", out_player: String(P.nazarov), in_player_id: String(P.kaupa) })}
${regel({ check_time: "true", time: "60", out_player: String(P.cytrynski), in_player_id: String(P.rodekamp) })}
${regel({ check_time: "true", time: "60", check_goal_condition: "true", goal_condition: "down_by_at_least", goals: "1", playstyle: "offensive", aggression: "aggressive" })}
${regel({ check_time: "true", time: "65", check_goal_condition: "true", goal_condition: "down_by_at_least", goals: "2", tactics: "shortpass", formation: "2", aggression: "aggressive" })}
${regel({ check_time: "true", time: "70", check_goal_condition: "true", goal_condition: "ahead_by_at_least", goals: "1", playstyle: "normal" })}
${regel({ check_time: "true", time: "80", check_goal_condition: "true", goal_condition: "tie", playstyle: "offensive", aggression: "aggressive" })}
${regel({ check_player_event: "true", player_event: "sent_off", tactics: "wings", formation: "1" })}
</SoccerTactics>`;

describe("Taktik-XML", () => {
  it("liest Team, 11 Positionen mit drei Aufstellungen, Bank und Regeln", () => {
    const t = parseTaktikXml(AUSSEN_R);
    expect(t.team).toMatchObject({ tactics: "wings", playstyle: "offensive", aggression: "normal" });
    expect(t.pos).toHaveLength(11);
    expect(t.pos[10]).toMatchObject({ pid: P.hyuga, start: { x: 200, y: 63 }, alt2: { x: 200, y: 63 } });
    expect(t.subs).toHaveLength(5);
    expect(t.regeln).toHaveLength(8);
  });

  it("lehnt Text ohne SoccerTactics ab", () => {
    expect(() => parseTaktikXml("<Team />")).toThrow(TaktikXmlFehler);
  });
});

describe("Prüfer (Prüfliste mz-wissen.md, Abschnitt 5)", () => {
  it("außenR-Vorlage (Stand 25.10.2026): keine Fehler, keine Wechsel-Hinweise", () => {
    const r = pruefeTaktik(parseTaktikXml(AUSSEN_R));
    expect(r.fehler).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.hinweise.filter((h) => h.regel === 5 || h.regel === 7)).toEqual([]);
  });

  it("Regel 5: ein Spieler in zwei Wechselregeln ist ein Fehler (ein- wie auswechseln)", () => {
    const rotMitWechsel = regel({ check_player_event: "true", player_event: "sent_off", out_player: String(P.schobel), in_player_id: String(P.kaupa) });
    const r = pruefeTaktik(parseTaktikXml(AUSSEN_R.replace("</SoccerTactics>", `${rotMitWechsel}</SoccerTactics>`)));
    expect(r.fehler.some((f) => f.regel === 5 && f.text.includes(`pid ${P.kaupa} kommt in 2 Wechselregeln vor`))).toBe(true);
    const zweimalRaus = regel({ check_time: "true", time: "70", out_player: String(P.hyuga), in_player_id: "225629999" });
    const r2 = pruefeTaktik(parseTaktikXml(AUSSEN_R.replace("</SoccerTactics>", `${zweimalRaus}</SoccerTactics>`)));
    expect(r2.fehler.some((f) => f.text.includes(`pid ${P.hyuga} kommt in 2 Wechselregeln vor`))).toBe(true);
  });

  it("Regel 1: vierter Stürmer und y < 63", () => {
    const xml = AUSSEN_R.replace(`pid="${P.schobel}" x="101" y="135"`, `pid="${P.schobel}" x="101" y="62"`);
    const texte = pruefeTaktik(parseTaktikXml(xml)).fehler.map((f) => f.text).join(" | ");
    expect(texte).toContain("4 Stürmer");
    expect(texte).toContain("y 62, kleiner als 63");
  });

  it("Regel 2: Abstand unter 47", () => {
    const xml = AUSSEN_R.replace(`pid="${P.nazarov}" x="76" y="224"`, `pid="${P.nazarov}" x="66" y="224"`);
    const f = pruefeTaktik(parseTaktikXml(xml)).fehler.filter((x) => x.regel === 2);
    expect(f.length).toBeGreaterThan(0);
    expect(f[0].text).toContain("40.0 auseinander");
  });

  it("Regel 3: genau zwei zentrale Stürmer auf gleicher Höhe sind ein Fehler (Eckstürmer zählt nicht)", () => {
    const xml = AUSSEN_R.replace(`x="82" y="77"`, `x="82" y="95"`);
    const r = pruefeTaktik(parseTaktikXml(xml));
    expect(r.fehler.some((h) => h.regel === 3)).toBe(true);
  });

  it("Regel 3: drei zentrale Stürmer, zwei hinten gleich hoch, einer davor, ist erlaubt (Profi-Muster)", () => {
    const xml = AUSSEN_R.replace(`x="129" y="95"`, `x="131" y="98"`).replace(`x="82" y="77"`, `x="69" y="98"`).replace(`x="200" y="63"`, `x="100" y="63"`);
    const r = pruefeTaktik(parseTaktikXml(xml));
    expect([...r.fehler, ...r.hinweise].some((h) => h.regel === 3)).toBe(false);
  });

  it("Regel 5: vier feste Zeitwechsel", () => {
    const extra = regel({ check_time: "true", time: "75", out_player: String(P.salzer), in_player_id: "225629999" });
    const r = pruefeTaktik(parseTaktikXml(AUSSEN_R.replace("</SoccerTactics>", `${extra}</SoccerTactics>`)));
    expect(r.fehler.some((f) => f.regel === 5 && f.text.startsWith("4 feste"))).toBe(true);
  });

  it("Regel 6: Rückstand mit Absichern", () => {
    const xml = AUSSEN_R.replace('goals="1" check_player_event="false" player_event_player_type="anyone" player_event="sent_off" out_player="no_change" in_player_id="NULL" tactics="no_change" playstyle="offensive" aggression="aggressive"',
      'goals="1" check_player_event="false" player_event_player_type="anyone" player_event="sent_off" out_player="no_change" in_player_id="NULL" tactics="no_change" playstyle="normal" aggression="aggressive"');
    expect(xml).not.toBe(AUSSEN_R);
    expect(pruefeTaktik(parseTaktikXml(xml)).fehler.some((f) => f.regel === 6)).toBe(true);
  });

  it("Regel 7: ohne Rot-Regel Fehler", () => {
    const ohne = AUSSEN_R.split("\n").filter((z) => !z.includes('check_player_event="true"')).join("\n");
    expect(pruefeTaktik(parseTaktikXml(ohne)).fehler.some((f) => f.regel === 7)).toBe(true);
  });

  it("Regel 8: Bankplatz leer und subgoalie als Regel-Einwechsler", () => {
    const xml = AUSSEN_R.replace(sub(225629999, 209), "").replace(`in_player_id="${P.ishizaki}"`, `in_player_id="${P.fleur}"`);
    const f = pruefeTaktik(parseTaktikXml(xml)).fehler.filter((x) => x.regel === 8).map((x) => x.text);
    expect(f.some((t) => t.includes("y 209"))).toBe(true);
    expect(f.some((t) => t.includes("subgoalie"))).toBe(true);
  });

  it("Regel 10: Spieler mit Kegel oder verletzt ist ein Fehler, Sperre ein Hinweis", () => {
    const kader: SpielerDaten[] = Object.values(P).concat(225629999).map((pid) => ({ pid, name: `S${pid}`, skills: {} }));
    const mit = (pid: number, s: Partial<SpielerDaten>) => kader.map((k) => (k.pid === pid ? { ...k, ...s } : k));
    let k = mit(P.chille, { status: { aufstellbar: false }, statusStand: { aufstellbar: "2026-10-24T21:00:12.000Z" } });
    k = k.map((x) => (x.pid === P.salzer ? { ...x, status: { verletzt: true } } : x));
    k = k.map((x) => (x.pid === P.vranken ? { ...x, status: { gesperrt: true }, sperren: [{ karte: "Rote Karte", wettbewerb: "Pokal", spiele: 1, art: "Offizieller Pokal", datum: "2026-10-24" }] } : x));
    const r = pruefeTaktik(parseTaktikXml(AUSSEN_R), k);
    expect(r.fehler.filter((f) => f.regel === 10)).toHaveLength(2);
    expect(r.hinweise.some((h) => h.regel === 10 && h.text.includes("Offizieller Pokal"))).toBe(true);
  });

  it("Spieler, die nicht im Kader sind, sind ein Fehler", () => {
    const kader: SpielerDaten[] = [{ pid: P.liu, name: "Liu", skills: {} }];
    expect(pruefeTaktik(parseTaktikXml(AUSSEN_R), kader).fehler.some((f) => f.text.includes("nicht im gespeicherten Kader"))).toBe(true);
  });
});

// Echte außenR von Marcus (25.10.2026), nur lokal vorhanden (nicht im öffentlichen Repo).
const ECHT = new URL("../parser/fixtures/aussenR-2026-10-25.xml", import.meta.url);

describe.skipIf(!existsSync(ECHT))("Echte außenR aus dem Editor", () => {
  const t = parseTaktikXml(readFileSync(ECHT, "utf8"));

  it("wird vollständig gelesen (XML-Kopf, Sub mit Alternativen, pt/fk bleiben erhalten)", () => {
    expect(t.pos).toHaveLength(11);
    expect(t.subs).toHaveLength(5);
    expect(t.regeln).toHaveLength(9);
    expect(t.pos.find((p) => p.pos === "goalie")).toMatchObject({ start: { x: 103, y: 315 } });
    expect(t.pos[0].attrs).toMatchObject({ pt: "1", fk: "10" });
  });

  it("Stand vor dem 25.10.: Kaupa in zwei Wechselregeln ist nach der neuen Regel ein Fehler", () => {
    const r = pruefeTaktik(t);
    expect(r.fehler).toEqual([expect.objectContaining({ regel: 5, text: expect.stringContaining("pid 226471405 kommt in 2 Wechselregeln vor") })]);
  });

  it("ohne die Rot-Wechselregel (Änderung von Marcus am 25.10.) keine Fehler", () => {
    const ohne = readFileSync(ECHT, "utf8").split("\n").filter((z) => !(z.includes('player_event="sent_off"') && z.includes('in_player_id="226471405"'))).join("\n");
    const r = pruefeTaktik(parseTaktikXml(ohne));
    expect(r.fehler).toEqual([]);
    expect(r.hinweise.some((h) => h.regel === 5)).toBe(false);
  });

  it("passt zu mz-wissen.md, Abschnitt 8 (gemeinsame Regeln)", () => {
    const zeit = (m: string) => t.regeln.filter((r) => r.check_time === "true" && r.time === m);
    expect(zeit("50").some((r) => r.out_player === "229906765" && r.in_player_id === "230162433")).toBe(true);
    expect(zeit("65").some((r) => r.goal_condition === "down_by_at_least" && r.goals === "2" && r.tactics === "shortpass" && r.formation === "2")).toBe(true);
    // Stand vor dem 25.10.: zwei Rot-Regeln (Umstellung und Wechsel)
    expect(t.regeln.filter((r) => r.player_event === "sent_off" && r.check_player_event === "true")).toHaveLength(2);
  });
});
