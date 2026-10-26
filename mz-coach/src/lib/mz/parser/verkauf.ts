import { parse } from "node-html-parser";
import { euro } from "./kader";
import { text } from "./spielerblock";

// Kasten "Transfers" der Spielerseite ?p=players&pid=… (an einer echten Seite geprüft am 26.10.2026): h1.win_title
// "Transfers", darunter table.hitlist mit Datum | Team/Aktion | Pfeil | Team | Preis (EUR). Zeilen in zeitlicher
// Reihenfolge, die neueste unten. Preis in Euro als Text, Originalwährung im title; "-" beim Jugend-Zugang.

export type Verkauf = { preis?: number; datum?: string; transfers: number };

export function parseVerkaufshistorie(html: string): Verkauf | null {
  const kasten = parse(html)
    .querySelectorAll("h1.win_title")
    .find((h) => text(h) === "Transfers")
    ?.closest(".baz");
  const tabelle = kasten?.querySelector("table.hitlist");
  if (!tabelle) return null;
  const zeilen = tabelle.querySelectorAll("tbody tr").map((tr) => {
    const zellen = tr.querySelectorAll("td");
    const d = text(zellen[0]).match(/^(\d{2})-(\d{2})-(\d{4})$/);
    const preisText = text(zellen.at(-1));
    // Betrag steht ohne "EUR" in der Zelle (Spaltenkopf "Preis (EUR)")
    return { datum: d ? `${d[3]}-${d[2]}-${d[1]}` : undefined, preis: /\d/.test(preisText) ? euro(`${preisText} EUR`) : undefined };
  });
  const letzter = [...zeilen].reverse().find((z) => z.preis !== undefined);
  return { preis: letzter?.preis, datum: letzter?.datum, transfers: zeilen.length };
}
