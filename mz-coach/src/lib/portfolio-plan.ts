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
// 2. Lücken: bei den Top 10 bewährte Stile gegen eine Gegnerklasse (portfolio.ts), die kein Reiter abdeckt.
// 3. Vorschlag: doppelte Reiter mit Lücken füllen, wichtigste Gegnerklasse zuerst (meiste Top-10-Spiele), je Klasse
//    höchstens ein Vorschlag. Besetzung: deine beste aufstellbare Elf auf den Plätzen des Topteams (erzeugen.ts).
// Jugend-Reiter (U18, U21, U23) werden nicht überschrieben: dort spielen andere Spieler.
// Übernommen wird nur auf Klick (abruf/liga.ts).

export const JUGEND = /^u(18|21|23)\b/i;

export type Abdeckung = { klasse: string; spiele: number; reiter: string[]; bester?: { schluessel: string; quote: number; spiele: number } };
export type PortfolioVorschlag = {
  reiter: string; // wird überschrieben
  grund: string; // warum dieser Reiter frei ist
  klasse: string;
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
  const abdeckung: Abdeckung[] = p.klassen.map((k) => {
    const bewaehrt = k.stile.filter((s) => s.bewaehrt);
    return {
      klasse: k.klasse,
      spiele: k.spiele,
      reiter: [...new Set(bewaehrt.flatMap((s) => s.imArchiv))],
      bester: bewaehrt[0] ? { schluessel: bewaehrt[0].schluessel, quote: bewaehrt[0].quote, spiele: bewaehrt[0].spiele } : undefined,
    };
  });

  // 3. Freie Reiter (doppelt, keine Jugend) mit Lücken füllen
  const frei = doppelt.filter((d) => !JUGEND.test(d.reiter)).sort((a, b) => (a.art === b.art ? 0 : a.art === "identisch" ? -1 : 1));
  const luecken: (StilEintrag & { klasse: string })[] = [];
  const klassenFertig = new Set(abdeckung.filter((a) => a.reiter.length).map((a) => a.klasse));
  const stileDrin = new Set<string>();
  const nachWichtigkeit = [...abdeckung].sort((a, b) => b.spiele - a.spiele);
  for (const k of nachWichtigkeit) {
    if (klassenFertig.has(k.klasse)) continue;
    const s = p.fehlend.filter((f) => f.klasse === k.klasse && !stileDrin.has(f.schluessel)).sort((a, b) => b.quote - a.quote || b.spiele - a.spiele)[0];
    if (!s) continue;
    luecken.push(s);
    stileDrin.add(s.schluessel);
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
  `${v.reiter} (${v.grund}) überschreiben mit ${v.stil}: bei den Top 10 gegen „${v.klasse}“ ${prozent(v.quote)} Punktquote in ${v.spiele} Spielen`;
