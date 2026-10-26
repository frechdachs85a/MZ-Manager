import { parse, type HTMLElement } from "node-html-parser";
import { berlinZuUtc, KaderSeiteUnbekannt, serverzeit } from "./kader";

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

// Ist das eine Spielliste?
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

// Antwort von ajax.php?p=matches&sub=list: HTML direkt oder als Text in einer JSON-Antwort (Aufbau
// noch nicht an einer echten Antwort gesehen, daher beides).
export function spiellisteHtmlAus(antwort: string): string | null {
  if (istSpielliste(antwort)) return antwort;
  try {
    const suche = (v: unknown): string | null => {
      if (typeof v === "string") return istSpielliste(v) ? v : null;
      if (v && typeof v === "object") for (const x of Object.values(v)) { const r = suche(x); if (r) return r; }
      return null;
    };
    return suche(JSON.parse(antwort));
  } catch {
    return null;
  }
}

// Zeilen der Liste (dd.group, dd.odd, dd.even). Im Spielplan (type=scheduled) beginnt jede Spielzeile mit
// <dd class="odd"><dl …><dd …>; node-html-parser schließt dabei das äußere dd und hängt den Inhalt flach an die
// Liste (am echten Spielplan vom 26.10.2026 gesehen). Dann wird das HTML an den Zeilenanfängen geteilt und jede
// Zeile einzeln gelesen; die Abfragen unten brauchen nur die Klassen innerhalb der Zeile.
function zeilen(html: string, liste: HTMLElement): HTMLElement[] {
  const direkt = liste.childNodes.filter((n): n is HTMLElement => (n as HTMLElement).tagName === "DD");
  if (direkt.some((d) => d.classList.contains("odd") || d.classList.contains("even"))) return direkt;
  const start = html.indexOf('id="fixtures-results-list"');
  const teile = html.slice(start).split(/(?=<dd class="(?:group|odd|even)[" ])/).slice(1);
  return teile.map((t) => {
    const k = t.match(/^<dd class="([^"]*)"/)![1];
    const wurzel = parse(`<div class="${k}">${t.replace(/^<dd[^>]*>/, "")}</div>`).querySelector("div")!;
    return wurzel;
  });
}

// Spielliste lesen
export function parseSpielliste(html: string, tidVorgabe?: number): Spielliste {
  const doc = parse(html);
  const liste = doc.querySelector("dl#fixtures-results-list");
  if (!liste) throw new KaderSeiteUnbekannt("Spielliste (#fixtures-results-list) nicht gefunden.");
  const tid = Number(doc.querySelector("input#tid1")?.getAttribute("value")) || tidVorgabe;
  if (!tid) throw new KaderSeiteUnbekannt("Team der Spielliste (tid1) nicht gefunden.");

  const spiele: ListenSpiel[] = [];
  let datum: string | undefined;
  for (const dd of zeilen(html, liste)) {
    if (dd.classList.contains("group")) {
      const m = text(dd).match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (!m) throw new KaderSeiteUnbekannt(`Unbekanntes Datum „${text(dd)}“ in der Spielliste.`);
      datum = `${m[3]}-${m[2]}-${m[1]}`;
      continue;
    }
    if (!dd.classList.contains("odd") && !dd.classList.contains("even")) continue;
    // Gespielte Spiele: dl#action-panel-<mid>. Kommende Spiele (type=scheduled, echte Antwort vom 26.10.2026):
    // kein Action-Panel, die Spielnummer steht nur im Link der Ergebniszelle (…&mid=<mid>&tid=…, Text „vs“).
    const panel = dd.querySelectorAll("dl").find((d) => /^action-panel-\d+$/.test(d.id));
    const link = (dd.querySelector(".score-cell-wrapper a")?.getAttribute("href") ?? "").match(/[?&]mid=(\d+)/);
    const mid = panel ? Number(panel.id.replace("action-panel-", "")) : link ? Number(link[1]) : undefined;
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
  // Im Spielplan verlinkt das eigene Team nur auf "/?p=team" ohne tid: fehlt genau einer Seite die tid, ist es das Team der Liste
  for (const s of spiele) {
    if (s.heim.tid === undefined && s.gast.tid !== undefined && s.gast.tid !== tid) s.heim.tid = tid;
    else if (s.gast.tid === undefined && s.heim.tid !== undefined && s.heim.tid !== tid) s.gast.tid = tid;
  }
  const eigen = spiele.flatMap((s) => [s.heim, s.gast]).find((t) => t.tid === tid);
  return { tid, teamName: eigen?.name, spiele, serverzeit: serverzeit(html) };
}

// Ligaspiele der laufenden Saison
export function ligaspieleDieserSaison(l: Spielliste): ListenSpiel[] {
  return l.spiele.filter((s) => s.art === "Ligaspiel" && s.mid > LIGA_MID_AB);
}

// Für die Gegneranalyse reichen die letzten 8 Ligaspiele der Saison (Marcus, 25.10.2026).
export const ANALYSE_SPIELE = 8;
// Die letzten n Ligaspiele
export function letzteLigaspiele<T extends ListenSpiel>(spiele: T[], n = ANALYSE_SPIELE): T[] {
  return spiele
    .filter((s) => s.art === "Ligaspiel" && s.mid > LIGA_MID_AB)
    .sort((a, b) => `${b.datum} ${b.zeit ?? ""}`.localeCompare(`${a.datum} ${a.zeit ?? ""}`) || b.mid - a.mid)
    .slice(0, n);
}

// Senioren-Ligaspiel (U18/U21/U23-Ligen heißen „U18 Liga“ usw. und tragen die Klasse uxx)
export const istLigaspiel = (s: ListenSpiel) => s.art === "Ligaspiel" && !s.altersklasse;

// Anstoß als Zeitpunkt (Datum und Uhrzeit der Liste sind deutsche Zeit, siehe berlinZuUtc)
export function anstoss(s: ListenSpiel): Date | undefined {
  const d = s.datum.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const z = s.zeit?.match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !z) return undefined;
  return berlinZuUtc(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(z[1]), Number(z[2]));
}
