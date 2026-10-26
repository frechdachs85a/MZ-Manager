import { parse } from "node-html-parser";
import { text } from "./spielerblock";

// Ligatabelle von ?p=league&type=senior. Der genaue Aufbau ist noch nicht gesehen, daher keine
// Deutung einzelner Spalten: übernommen wird die erste HTML-Tabelle, in der das eigene Team steht,
// mit Kopfzeile und allen Zeilen so, wie ManagerZone sie zeigt.
export type Tabelle = { kopf: string[]; zeilen: { zellen: string[]; eigen: boolean }[] };

// Ligatabelle lesen (Zeile des eigenen Teams markiert)
export function tabelleAus(html: string, teamName: string): Tabelle | null {
  const doc = parse(html);
  for (const t of doc.querySelectorAll("table")) {
    if (!text(t).includes(teamName)) continue;
    // Verschachtelte Tabellen überspringen: die innerste mit dem Teamnamen nehmen
    if (t.querySelectorAll("table").some((innen) => text(innen).includes(teamName))) continue;
    const reihen = t.querySelectorAll("tr");
    const kopfReihe = reihen.find((r) => r.querySelectorAll("th").length > 0);
    const kopf = kopfReihe ? kopfReihe.querySelectorAll("th").map((th) => text(th)) : [];
    const zeilen = reihen
      .filter((r) => r !== kopfReihe && r.querySelectorAll("td").length > 1)
      .map((r) => {
        const zellen = r.querySelectorAll("td").map((td) => text(td));
        return { zellen, eigen: zellen.some((z) => z.includes(teamName)) };
      });
    if (zeilen.length > 1) return { kopf, zeilen };
  }
  return null;
}
