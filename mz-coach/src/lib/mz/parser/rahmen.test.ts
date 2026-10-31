import { describe, expect, it } from "vitest";
import { rahmenAusGebotsformular } from "./rahmen";

// Nachgebauter Ausschnitt (Aufbau wie das echte Gebotsfenster, erfundene Zahlen)
const html = `<dl class="transfer_team_stats_list"> <dd>Einheimische Spieler: <span>40</span></dd> <dd>Ausländische Spieler: <span>5</span> (<em>maximum 5</em>)</dd> <dd>Arbeitsbewilligungen: <span>2</span> (<em>maximum 5</em>)</dd></dl>
<dd class="negative"> Verfügbarer Saldo: <span><span id="transfer_available_balance">1 234 567</span> EUR</span> </dd>`;

describe("Rahmen aus dem Gebotsfenster", () => {
  it("liest Ausländer, Arbeitsbewilligungen und verfügbaren Saldo", () => {
    expect(rahmenAusGebotsformular(html)).toEqual({ kapital: 1234567, auslaender: 5, auslaenderMax: 5, bewilligungen: 2, bewilligungenMax: 5 });
  });
  it("ohne Kasten: null", () => {
    expect(rahmenAusGebotsformular("<div></div>")).toBeNull();
  });
});
