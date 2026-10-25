import { parse, type HTMLElement } from "node-html-parser";
import { KaderSeiteUnbekannt, serverzeit } from "./kader";

// Liste gespielter Spiele eines Teams (?p=match&sub=played&tid=…). Aufbau an der echten Seite
// vom 25.10.2026 geprüft (docs/mz-seiten.md): dl#fixtures-results-list, Datumszeilen dd.group,
// je Spiel dd.odd/dd.even mit Spielart, Wettbewerb, Heim/Gast (tid), Ergebnis und dl#action-panel-<mid>.

export type ListenSpiel = {
  mid: number;
  datum: string; // JJJJ-MM-TT
  zeit?: string; // HH:MM
  art: string; // "Ligaspiel", "Offizieller Pokal", "Freundschaftsspiel", "Scoutspiel" (Text der Seite)
  wettbewerb?: string; // z. B. "div1.1"
  altersklasse: boolean; // Klasse "uxx" an der Zeile (U18/U21/U23)
  heim: { tid?: number; name: string };
  gast: { tid?: number; name: string };
  tore?: { heim: number; gast: number };
};

export type Spielliste = { tid: number; teamName?: string; spiele: ListenSpiel[]; serverzeit?: string };

// Ligaspiele der laufenden Saison: mid > 1 620 000 000 (mz-wissen.md, Abschnitt 2, Stand Saison 100).
export const LIGA_MID_AB = 1_620_000_000;

export function istSpielliste(html: string): boolean {
  return /id="fixtures-results-list"/.test(html);
}

function text(el: HTMLElement | null | undefined): string {
  return (el?.text ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function tidAus(a: HTMLElement | null): number | undefined {
  const m = (a?.getAttribute("href") ?? "").match(/[?&]tid=(\d+)/);
  return m ? Number(m[1]) : undefined;
}

export function parseSpielliste(html: string): Spielliste {
  const doc = parse(html);
  const liste = doc.querySelector("dl#fixtures-results-list");
  if (!liste) throw new KaderSeiteUnbekannt("Spielliste (#fixtures-results-list) nicht gefunden.");
  const tid = Number(doc.querySelector("input#tid1")?.getAttribute("value"));
  if (!tid) throw new KaderSeiteUnbekannt("Team der Spielliste (tid1) nicht gefunden.");

  const spiele: ListenSpiel[] = [];
  let datum: string | undefined;
  for (const dd of liste.childNodes.filter((n): n is HTMLElement => (n as HTMLElement).tagName === "DD")) {
    if (dd.classList.contains("group")) {
      const m = text(dd).match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (!m) throw new KaderSeiteUnbekannt(`Unbekanntes Datum „${text(dd)}“ in der Spielliste.`);
      datum = `${m[3]}-${m[2]}-${m[1]}`;
      continue;
    }
    if (!dd.classList.contains("odd") && !dd.classList.contains("even")) continue;
    const panel = dd.querySelectorAll("dl").find((d) => /^action-panel-\d+$/.test(d.id));
    const mid = panel ? Number(panel.id.replace("action-panel-", "")) : undefined;
    if (!mid || !datum) throw new KaderSeiteUnbekannt("Spiel ohne Spielnummer oder Datum in der Spielliste.");
    const ref = dd.querySelector(".match-reference-text-wrapper");
    const art = text(ref?.querySelector("span"));
    const heimEl = dd.querySelector(".home-team-column");
    const gastEl = dd.querySelector(".away-team-column");
    const team = (el: HTMLElement | null) => ({
      tid: tidAus(el?.querySelector("a") ?? null),
      name: text(el?.querySelector(".full-name")) || text(el),
    });
    const ergebnis = text(dd.querySelector(".score-shown")).match(/^(\d+) - (\d+)$/);
    spiele.push({
      mid,
      datum,
      zeit: text(dd.querySelector(".match-time")) || undefined,
      art,
      wettbewerb: text(ref?.querySelector("a")) || undefined,
      altersklasse: dd.classList.contains("uxx"),
      heim: team(heimEl),
      gast: team(gastEl),
      tore: ergebnis ? { heim: Number(ergebnis[1]), gast: Number(ergebnis[2]) } : undefined,
    });
  }
  const eigen = spiele.flatMap((s) => [s.heim, s.gast]).find((t) => t.tid === tid);
  return { tid, teamName: eigen?.name, spiele, serverzeit: serverzeit(html) };
}

export function ligaspieleDieserSaison(l: Spielliste): ListenSpiel[] {
  return l.spiele.filter((s) => s.art === "Ligaspiel" && s.mid > LIGA_MID_AB);
}

// Für die Gegneranalyse reichen die letzten 8 Ligaspiele der Saison (Marcus, 25.10.2026).
export const ANALYSE_SPIELE = 8;
export function letzteLigaspiele<T extends ListenSpiel>(spiele: T[], n = ANALYSE_SPIELE): T[] {
  return spiele
    .filter((s) => s.art === "Ligaspiel" && s.mid > LIGA_MID_AB)
    .sort((a, b) => `${b.datum} ${b.zeit ?? ""}`.localeCompare(`${a.datum} ${a.zeit ?? ""}`) || b.mid - a.mid)
    .slice(0, n);
}
