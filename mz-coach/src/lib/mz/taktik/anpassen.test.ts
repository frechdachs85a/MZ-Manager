import { describe, expect, it } from "vitest";
import { anpassen } from "./anpassen";

const XML = `<SoccerTactics>
	<Team tactics="wings" />
	<TacticRule name="Taktikregel" check_time="true" time="50" check_goal_condition="false" out_player="229906765" in_player_id="230162433" formation="no_change" />
	<TacticRule name="Taktikregel" check_time="true" time="60" check_goal_condition="false" out_player="227162857" in_player_id="226471405" formation="no_change" />
	<TacticRule name="Taktikregel" check_time="false" time="5" check_player_event="true" out_player="229906765" in_player_id="NULL" formation="1" />
</SoccerTactics>`;

describe("Archiv-Taktik anpassen", () => {
  it("setzt nur die Zeitregel des genannten Spielers auf die neue Minute", () => {
    const r = anpassen(XML, [{ art: "wechselzeit", reiter: "außenR", outPid: 229906765, name: "Hyuga", ab: 70, grund: "" }]);
    expect(r.geaendert).toEqual(["Wechsel Hyuga: Minute 50 → 70"]);
    expect(r.xml).toContain('time="70" check_goal_condition="false" out_player="229906765"');
    expect(r.xml).toContain('time="60" check_goal_condition="false" out_player="227162857"');
    expect(r.xml).toContain('check_time="false" time="5"');
    expect(r.xml.split("\n").length).toBe(XML.split("\n").length);
  });
});
