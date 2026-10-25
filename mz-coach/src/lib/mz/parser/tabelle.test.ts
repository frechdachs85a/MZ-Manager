import { describe, expect, it } from "vitest";
import { tabelleAus } from "./tabelle";

// Nachbau, keine echte Seite: prüft nur, dass die Tabelle mit dem eigenen Team übernommen wird
describe("Ligatabelle (Nachbau)", () => {
  it("nimmt die Tabelle mit dem eigenen Team und markiert die eigene Zeile", () => {
    const html = `<table><tr><td>Menü</td></tr></table>
      <table><tr><th>#</th><th>Team</th><th>Pkt</th></tr>
      <tr><td>1</td><td>Andere</td><td>30</td></tr>
      <tr><td>2</td><td>FC Toho</td><td>28</td></tr></table>`;
    const t = tabelleAus(html, "FC Toho")!;
    expect(t.kopf).toEqual(["#", "Team", "Pkt"]);
    expect(t.zeilen.map((z) => z.eigen)).toEqual([false, true]);
    expect(tabelleAus("<p>nichts</p>", "FC Toho")).toBeNull();
  });
});
