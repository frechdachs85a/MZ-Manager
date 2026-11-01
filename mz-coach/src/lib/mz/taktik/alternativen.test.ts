import { describe, expect, it } from "vitest";
import { aehnlichsteVorlage, alternativenUebertragen, hatAlternativen } from "./alternativen";
import { parseTaktikXml } from "./xml";

// Erfundene Testdaten: Vorbild mit 3 Verteidigern und echten Alternativen, Ziel ohne
const pos = (pid: number, x: number, y: number, a1 = [x, y], a2 = [x, y], art = "normal") =>
  `\t<Pos pos="${art}" pid="${pid}" x="${x}" y="${y}" x1="${a1[0]}" y1="${a1[1]}" x2="${a2[0]}" y2="${a2[1]}" pt="1" fk="1" />`;
const rot = `\t<TacticRule name="Taktikregel" check_time="false" time="5" check_goal_condition="false" goal_condition="tie" goals="1" check_player_event="true" player_event_player_type="anyone" player_event="sent_off" out_player="no_change" in_player_id="NULL" tactics="no_change" playstyle="no_change" aggression="no_change" formation="1" />`;
const rueck2 = `\t<TacticRule name="Taktikregel" check_time="true" time="65" check_goal_condition="true" goal_condition="down_by_at_least" goals="2" check_player_event="false" player_event_player_type="anyone" player_event="receives_yellow" out_player="no_change" in_player_id="NULL" tactics="no_change" playstyle="no_change" aggression="aggressive" formation="no_change" />`;
const taktik = (zeilen: string[], extra = "") =>
  [`<SoccerTactics>`, `\t<Team tactics="shortpass" playstyle="normal" aggression="normal" captain="2" />`, pos(1, 103, 315, undefined, undefined, "goalie"), ...zeilen, rot, extra, `</SoccerTactics>`].join("\n");
const vorbild = taktik([
  pos(2, 50, 240, [50, 240], [40, 200]), pos(3, 104, 240), pos(4, 158, 240, [158, 240], [168, 200]),
  pos(5, 50, 170, [40, 165]), pos(6, 104, 170), pos(7, 158, 170, [168, 165]), pos(8, 104, 130),
  pos(9, 50, 90, [104, 170]), pos(10, 104, 70), pos(11, 158, 90),
]);
const ziel = taktik(
  [pos(2, 55, 235), pos(3, 104, 245), pos(4, 153, 235), pos(5, 55, 175), pos(6, 104, 175), pos(7, 153, 175), pos(8, 104, 135), pos(9, 55, 95), pos(10, 104, 72), pos(11, 153, 95)],
  rueck2,
);

describe("Alternativen nach Vorbild", () => {
  it("erkennt fehlende Alternativen und wählt das Vorbild", () => {
    expect(hatAlternativen(parseTaktikXml(ziel))).toBe(false);
    expect(aehnlichsteVorlage(ziel, [{ reiter: "vorbild", xml: vorbild }])?.reiter).toBe("vorbild");
  });
  it("überträgt die Verschiebungen, richtet Rot und 2 Tore Rückstand aus", () => {
    const r = alternativenUebertragen(ziel, vorbild);
    const t = parseTaktikXml(r.xml);
    const p = (pid: number) => t.pos.find((x) => x.pid === pid)!;
    expect(p(9).alt1).toEqual({ x: 109, y: 175 }); // Stürmer links rückt in Alternative 1 ins Mittelfeld (wie im Vorbild)
    expect(p(2).alt2).toEqual({ x: 45, y: 195 }); // äußerer Verteidiger rückt in Alternative 2 auf
    expect(p(1).alt1).toEqual({ x: 103, y: 315 }); // Torwart bleibt
    expect(hatAlternativen(t)).toBe(true);
    expect(t.regeln.find((x) => x.player_event === "sent_off")!.tactics).toBe("no_change"); // 2 Stürmer zentral → Kurzpass = Grundtaktik
    expect(t.regeln.find((x) => x.goals === "2" && x.check_goal_condition === "true")!.formation).toBe("2");
  });
});
