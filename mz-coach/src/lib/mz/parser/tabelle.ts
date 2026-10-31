import { parse } from "node-html-parser";
import { text } from "./spielerblock";

// Ligatabelle (Reiter "Tabelle" der Ligaseite, ajax.php?p=league…&sub=table; Aufbau an der Weltliga-Tabelle vom
// 30.10.2026 gesehen: Platz, Mannschaft, Sp, G, U, V, +, -, =, Pkt, Letzte 6 Spiele). Keine
// Deutung einzelner Spalten: übernommen wird die erste HTML-Tabelle, in der das eigene Team steht,
// mit Kopfzeile und allen Zeilen so, wie ManagerZone sie zeigt.
// letzte: Spalte "Letzte 6 Spiele" (Links mit Titel "A 1 - 0 B" und Bild img/status_green|red|….gif, gesehen 31.10.2026);
// green = Sieg, red = Niederlage, sonst (z. B. yellow) Remis
export type LetztesSpiel = { ergebnis: "S" | "U" | "N"; titel: string; mid?: number };
export type Tabelle = { kopf: string[]; zeilen: { zellen: string[]; eigen: boolean; tid?: number; letzte?: LetztesSpiel[] }[] };

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
        const zellen = r.querySelectorAll("td").map(
          (td) =>
            text(td) ||
            td
              .querySelectorAll("img, i, span")
              .map((x) => x.getAttribute("title") ?? "")
              .filter(Boolean)
              .join(" "),
        );
        const tid = Number((r.querySelector("a[href*='tid=']")?.getAttribute("href") ?? "").match(/[?&]tid=(\d+)/)?.[1]) || undefined;
        const letzte: LetztesSpiel[] = r
          .querySelectorAll("a")
          .filter((a) => /status_\w+\.gif/.test(a.querySelector("img")?.getAttribute("src") ?? ""))
          .map((a) => {
            const farbe = (a.querySelector("img")?.getAttribute("src") ?? "").match(/status_(\w+)\.gif/)?.[1];
            return {
              ergebnis: farbe === "green" ? "S" : farbe === "red" ? "N" : "U",
              titel: a.getAttribute("title") ?? "",
              mid: Number((a.getAttribute("href") ?? "").match(/[?&]mid=(\d+)/)?.[1]) || undefined,
            };
          });
        return { zellen, eigen: r.classList.contains("highlight_row") || zellen.some((z) => z.includes(teamName)), tid, ...(letzte.length ? { letzte } : {}) };
      });
    if (zeilen.length > 1) return { kopf, zeilen };
  }
  return null;
}
