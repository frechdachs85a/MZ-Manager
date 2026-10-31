import { describe, expect, it } from "vitest";
import { weltrangAus } from "./teamseite";

// Erfundenes Beispiel im Aufbau der Teamseite (auch das fehlerhafte </strong> vor der Zahl kommt so vor)
const html = `<dd><span class="teamExpText clippable" style="padding-top: 3px">Rang:</span>
<span title="1234 Punkte" style="padding-top: 3px;"></strong>4321</strong></span><img src="x.gif"></dd>
<strong>Rang:</strong><span>55</span>`;

describe("Weltrang von der Teamseite", () => {
  it("liest den Teamrang, nicht den Verbandsrang", () => {
    expect(weltrangAus(html)).toBe(4321);
  });
  it("gibt null, wenn kein Rang da ist", () => {
    expect(weltrangAus("<strong>Rang:</strong><span>55</span>")).toBeNull();
  });
});
