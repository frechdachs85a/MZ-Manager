import { parse } from "node-html-parser";
import { text } from "./spielerblock";

// Ligatabelle (Reiter "Tabelle" der Ligaseite, ajax.php?p=league…&sub=table; Aufbau an der Weltliga-Tabelle vom
// 30.10.2026 gesehen: Platz, Mannschaft, Sp, G, U, V, +, -, =, Pkt, Letzte 6 Spiele). Keine
// Deutung einzelner Spalten: übernommen wird die erste HTML-Tabelle, in der das eigene Team steht,
// mit Kopfzeile und allen Zeilen so, wie ManagerZone sie zeigt.
export type Tabelle = { kopf: string[]; zeilen: { zellen: string[]; eigen: boolean; tid?: number }[] };

// Ligatabelle lesen (Zeile des eigenen Teams markiert)
export function tabelleAus(html: string, teamName: string): Tabelle | null {
  // Zuerst eine Tabelle mit Spalte "Pkt" (die Rangliste; im selben Reiter stehen auch die Paarungen des Spieltags)
  return tabelleSuchen(html, teamName, true) ?? tabelleSuchen(html, teamName, false);
}

function tabelleSuchen(html: string, teamName: string, nurMitPunkten: boolean): Tabelle | null {
  const doc = parse(html);
  for (const t of doc.querySelectorAll("table")) {
    if (nurMitPunkten && !t.querySelectorAll("th").some((th) => text(th) === "Pkt")) continue;
    if (!text(t).includes(teamName)) continue;
    // Verschachtelte Tabellen überspringen: die innerste mit dem Teamnamen nehmen
    if (t.querySelectorAll("table").some((innen) => text(innen).includes(teamName))) continue;
    const reihen = t.querySelectorAll("tr");
    const kopfReihe = reihen.find((r) => r.querySelectorAll("th").length > 0);
    const kopf = kopfReihe ? kopfReihe.querySelectorAll("th").map((th) => text(th)) : [];
    const zeilen = reihen
      .filter((r) => r !== kopfReihe && r.querySelectorAll("td").length > 1)
      .map((r) => {
        // Leere Zellen (z. B. "Letzte 6 Spiele" als Symbole): Titel der Bilder, sonst leer
        const zellen = r.querySelectorAll("td").map((td) => text(td) || td.querySelectorAll("img, i, span").map((x) => x.getAttribute("title") ?? "").filter(Boolean).join(" "));
        const tid = Number((r.querySelector("a[href*='tid=']")?.getAttribute("href") ?? "").match(/[?&]tid=(\d+)/)?.[1]) || undefined;
        return { zellen, eigen: r.classList.contains("highlight_row") || zellen.some((z) => z.includes(teamName)), tid };
      });
    if (zeilen.length > 1) return { kopf, zeilen };
  }
  return null;
}
