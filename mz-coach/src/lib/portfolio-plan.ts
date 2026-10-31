import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { heuteInBerlin } from "@/lib/format";
import { formation } from "@/lib/mz/analyse/gegner";
import { erzeugeTaktik } from "@/lib/mz/taktik/erzeugen";
import { portfolioAnalyse, stilSchluessel, type StilEintrag } from "@/lib/portfolio";
import { archivLaden } from "@/lib/taktik-archiv";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

// Portfolio-Plan (Marcus, 30.10.2026: die Reiter sollen ein Portfolio sein, optimal für dein Team und abwechslungsreich,
// damit es gegen jeden Gegnertyp eine gute Antwort gibt). Täglich aus dem Archiv und den Top-10-Spielen:
// 1. Doppelte: Reiter mit gleicher Aufstellung und Einstellung (identisch) oder gleichem Stil (Formation, Taktik,
//    Spielweise) wie ein anderer Reiter. Behalten wird der zuerst gespeicherte.
// 2. Lücken: bei den Top 10 bewährte Stile gegen eine Gegnerklasse (portfolio.ts), die kein Reiter abdeckt, oder die dort
//    mindestens BESSER (Punktquote) bringen als der beste Stil, den du schon hast (eigene Setzung, keine MZ-Regel).
// 3. Vorschlag: doppelte Reiter damit füllen. Reihum je Gegnerklasse ein Stil, wichtigste Klasse zuerst (meiste
//    Top-10-Spiele), Lücken vor Verbesserungen, jeder Stil nur einmal. Besetzung: deine beste aufstellbare Elf auf den
//    Plätzen des Topteams (erzeugen.ts).
// Jugend-Reiter (U18, U21, U23) werden nicht überschrieben: dort spielen andere Spieler.
// Übernommen wird nur auf Klick (abruf/liga.ts).

export const JUGEND = /^u(18|21|23)\b/i;
export const BESSER = 0.1;

type StilKurz = { schluessel: string; quote: number; spiele: number };
// reiter: Reiter mit einem bewährten Stil der Klasse; dein: dein bester Stil gegen die Klasse (auch nicht bewährt)
export type Abdeckung = { klasse: string; spiele: number; reiter: string[]; bester?: StilKurz; dein?: StilKurz };
export type PortfolioVorschlag = {
  reiter: string; // wird überschrieben
  grund: string; // warum dieser Reiter frei ist
  klasse: string;
  statt?: StilKurz; // dein bisher bester Stil gegen die Klasse (bei einer Verbesserung)
  stil: string;
  quote: number;
  spiele: number;
  teams: string[];
  xml: string;
  summe: number; // MZ-Wert der Elf
};
export type PortfolioPlan = { doppelt: { reiter: string; wie: string; art: "identisch" | "gleicher Stil" }[]; abdeckung: Abdeckung[]; vorschlaege: PortfolioVorschlag[] };

const prozent = (q: number) => `${Math.round(q * 100)} %`;

export function portfolioPlan(db: Database.Database): PortfolioPlan {
  const archiv = archivLaden(db)
    .filter((a) => a.taktik)
    .sort((a, b) => a.gespeichert.localeCompare(b.gespeichert));
  const p = portfolioAnalyse(db);

  // 1. Doppelte
  const doppelt: PortfolioPlan["doppelt"] = [];
  const signatur = new Map<string, string>();
  const stil = new Map<string, string>();
  for (const a of archiv) {
    const t = a.taktik!;
    const sig = JSON.stringify([t.team.tactics, t.team.playstyle, t.team.aggression, t.pos.map((x) => `${x.pid}@${Math.round(x.start.x / 5)},${Math.round(x.start.y / 5)}`).sort()]);
    const st = stilSchluessel(formation(t.pos.filter((x) => x.pos === "normal").map((x) => x.start)).text, t.team.tactics, t.team.playstyle);
    if (signatur.has(sig)) doppelt.push({ reiter: a.reiter, wie: signatur.get(sig)!, art: "identisch" });
    else if (stil.has(st)) doppelt.push({ reiter: a.reiter, wie: stil.get(st)!, art: "gleicher Stil" });
    if (!signatur.has(sig)) signatur.set(sig, a.reiter);
    if (!stil.has(st)) stil.set(st, a.reiter);
  }

  // 2. Abdeckung je Gegnerklasse (bewährte Stile, die ein Reiter abdeckt)
  const kurzStil = (x?: StilEintrag): StilKurz | undefined => (x ? { schluessel: x.schluessel, quote: x.quote, spiele: x.spiele } : undefined);
  const abdeckung: Abdeckung[] = p.klassen.map((k) => {
    const bewaehrt = k.stile.filter((s) => s.bewaehrt);
    const dein = k.stile.filter((s) => s.imArchiv.length).sort((a, b) => b.quote - a.quote)[0];
    return { klasse: k.klasse, spiele: k.spiele, reiter: [...new Set(bewaehrt.flatMap((s) => s.imArchiv))], bester: kurzStil(bewaehrt[0]), dein: kurzStil(dein) };
  });

  // 3. Freie Reiter (doppelt, keine Jugend) mit Lücken und klar besseren Stilen füllen
  const frei = doppelt.filter((d) => !JUGEND.test(d.reiter)).sort((a, b) => (a.art === b.art ? 0 : a.art === "identisch" ? -1 : 1));
  const kandidaten = abdeckung
    .map((a) => ({
      a,
      stile: p.fehlend.filter((f) => f.klasse === a.klasse && (!a.reiter.length || !a.dein || f.quote >= a.dein.quote + BESSER)).sort((x, y) => y.quote - x.quote || y.spiele - x.spiele),
    }))
    .filter((k) => k.stile.length)
    .sort((x, y) => Number(!!x.a.reiter.length) - Number(!!y.a.reiter.length) || y.a.spiele - x.a.spiele);
  const luecken: (StilEintrag & { klasse: string; statt?: StilKurz })[] = [];
  const stileDrin = new Set<string>();
  for (let runde = 0; luecken.length < frei.length; runde++) {
    let neu = false;
    for (const k of kandidaten) {
      if (luecken.length >= frei.length) break;
      const s = k.stile.filter((x) => !stileDrin.has(x.schluessel))[0];
      if (!s || luecken.filter((l) => l.klasse === k.a.klasse).length > runde) continue;
      luecken.push({ ...s, statt: k.a.reiter.length ? k.a.dein : undefined });
      stileDrin.add(s.schluessel);
      neu = true;
    }
    if (!neu) break;
  }
  const kader = ladeKader(db);
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const vorschlaege: PortfolioVorschlag[] = [];
  for (const [i, d] of frei.entries()) {
    const s = luecken[i];
    if (!s) break;
    const m = s.schluessel.match(/^\S+ (\S+)\/(\S+)$/);
    const kapitaen = Number(archiv.find((a) => a.reiter === d.reiter)?.taktik?.team.captain) || undefined;
    try {
      const e = erzeugeTaktik({ feld: s.beispiel.feld, torwart: s.beispiel.torwart, tactics: m?.[1], playstyle: m?.[2], aggression: s.haerte[0]?.[0], kader, spieltag, kapitaenPid: kapitaen });
      vorschlaege.push({
        reiter: d.reiter,
        grund: d.art === "identisch" ? `identisch mit ${d.wie}` : `gleicher Stil wie ${d.wie}`,
        klasse: s.klasse,
        statt: s.statt,
        stil: s.schluessel,
        quote: s.quote,
        spiele: s.spiele,
        teams: s.teams,
        xml: e.xml,
        summe: e.summe,
      });
    } catch {
      // zu wenige aufstellbare Spieler: kein Vorschlag für diesen Reiter
    }
  }
  return { doppelt, abdeckung, vorschlaege };
}

export const vorschlagText = (v: PortfolioVorschlag) =>
  `${v.reiter} (${v.grund}) überschreiben mit ${v.stil}: bei den Top 10 gegen „${v.klasse}“ ${prozent(v.quote)} Punktquote in ${v.spiele} Spielen` +
  (v.statt ? ` (dein bisher bester Stil dort, ${v.statt.schluessel}: ${prozent(v.statt.quote)} in ${v.statt.spiele})` : " (bisher kein Reiter dafür)");
