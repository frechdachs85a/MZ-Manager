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

describe("Ligatabelle aus dem Reiter Tabelle", () => {
  it("liest Zeilen, tid und eigene Zeile (highlight_row)", () => {
    // Nachbau im Aufbau der echten Antwort (Namen und Zahlen erfunden)
    const html = `<table class="nice_table"><thead><tr><th>&nbsp;</th><th>Mannschaft</th><th>Sp</th><th>G</th><th>U</th><th>V</th><th>+</th><th>-</th><th>=</th><th>Pkt</th></tr></thead>
<tbody><tr><td><span>1</span></td><td><a href="/?p=league&type=senior&tid=11">Team A</a></td><td>9</td><td>7</td><td>1</td><td>1</td><td>20</td><td>8</td><td><nobr>12</nobr></td><td>22</td></tr>
<tr class="highlight_row"><td><span>2</span></td><td><a href="/?p=league&type=senior&tid=22">Mein Team</a></td><td>9</td><td>6</td><td>2</td><td>1</td><td>18</td><td>9</td><td><nobr>9</nobr></td><td>20</td></tr></tbody></table>`;
    const t = tabelleAus(html, "Mein Team")!;
    expect(t.kopf).toEqual(["", "Mannschaft", "Sp", "G", "U", "V", "+", "-", "=", "Pkt"]);
    expect(t.zeilen[1]).toEqual({ zellen: ["2", "Mein Team", "9", "6", "2", "1", "18", "9", "9", "20"], eigen: true, tid: 22 });
    expect(t.zeilen[0].eigen).toBe(false);
  });
});

describe("Ligatabelle neben den Paarungen", () => {
  it("nimmt die Tabelle mit Spalte Pkt, nicht die Paarungen", () => {
    const html = `<table><tr><td>Team A</td><td>X - X</td><td>Mein Team</td></tr><tr><td>Team B</td><td>X - X</td><td>Team C</td></tr></table>
<table class="nice_table"><thead><tr><th></th><th>Mannschaft</th><th>Sp</th><th>Pkt</th></tr></thead><tbody>
<tr><td>1</td><td>Team A</td><td>9</td><td>22</td></tr><tr class="highlight_row"><td>2</td><td>Mein Team</td><td>9</td><td>20</td></tr></tbody></table>`;
    const t = tabelleAus(html, "Mein Team")!;
    expect(t.kopf).toEqual(["", "Mannschaft", "Sp", "Pkt"]);
    expect(t.zeilen.find((z) => z.eigen)?.zellen).toEqual(["2", "Mein Team", "9", "20"]);
  });
});

describe("Letzte 6 Spiele", () => {
  it("liest Sieg und Niederlage aus den Ampel-Bildern", () => {
    const html = `<table><thead><tr><th></th><th>Mannschaft</th><th>Pkt</th><th>Letzte 6 Spiele</th></tr></thead><tbody>
<tr><td>1</td><td>Team A</td><td>3</td><td></td></tr>
<tr class="highlight_row"><td>2</td><td>Mein Team</td><td>3</td><td><nobr><a href="/?p=match&sub=result&mid=5" title="Mein Team 1 - 0 X"><img src="img/status_green.gif"></a><a href="/?p=match&sub=result&mid=6" title="Y 2 - 0 Mein Team"><img src="img/status_red.gif"></a></nobr></td></tr></tbody></table>`;
    const z = tabelleAus(html, "Mein Team")!.zeilen.find((x) => x.eigen)!;
    expect(z.letzte).toEqual([
      { ergebnis: "S", titel: "Mein Team 1 - 0 X", mid: 5 },
      { ergebnis: "N", titel: "Y 2 - 0 Mein Team", mid: 6 },
    ]);
  });
});
