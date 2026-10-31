import "server-only";
import type Database from "better-sqlite3";
import { parse } from "node-html-parser";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { ladeGegnerKader } from "@/lib/db/gegner-kader";
import { ladeLigaElfen, speichereLigaElf, speichereLigaRang } from "@/lib/db/liga-team";
import { ladeSpiel } from "@/lib/db/spiele";
import { gespeicherteTabelle, letzteMidJeTeam } from "@/lib/liga-teams";
import { parseStatsXml, type StatsSpiel } from "@/lib/mz/parser/stats";
import { weltrangAus } from "@/lib/mz/parser/teamseite";
import { TEAM } from "@/lib/wissen/startbasis";
import { liesGegnerKader } from "./fremd";
import { meldungAus, type Ergebnis } from "./kader";
import { holeStatsXml } from "./spiele";
import { marke, mitMzSitzung, type MzSitzung } from "./sitzung";

// Ligatabelle holen (Marcus, 31.10.2026: ändert sich nur nach Ligaspielen, daher nur im Spieltag-Abruf 5 Stunden nach
// jedem Ligaspiel). Die Tabelle steht nicht im Seiten-HTML von ?p=league&type=senior, sondern kommt über den Reiter
// "Tabelle" (a#league_tab_table, ajax.php …&sub=table), wie bei der Weltliga gesehen (30.10.2026).
export async function ligaTabelleHolen(db: Database.Database, s: MzSitzung): Promise<string> {
  const seite = await s.holeSeite("/?p=league&type=senior");
  speichereRohseite(db, { art: "liga-seite", url: seite.url, status: seite.status, htmlRoh: seite.htmlRoh, htmlDom: seite.htmlDom });
  const reiter = parse(seite.htmlDom ?? seite.htmlRoh ?? "").querySelector("a#league_tab_table")?.getAttribute("href");
  if (!reiter) {
    speichereRohseite(db, { art: "tabelle", url: seite.url, status: seite.status, htmlRoh: seite.htmlRoh, htmlDom: seite.htmlDom });
    return "Ligatabelle: Reiter „Tabelle“ nicht gefunden, Seite gespeichert.";
  }
  const t = await s.holeText(reiter.replace(/&amp;/g, "&"));
  speichereRohseite(db, { art: "tabelle", url: t.url, status: t.status, htmlRoh: t.text, htmlDom: null });
  return "Ligatabelle gelesen.";
}

// Kaderseiten der Ligateams für den Startelf-Wert (höchstens alle 3 Tage je Team neu; die Tabelle kommt nach jedem
// Ligaspiel) und Weltrang von der Teamseite jedes Ligateams (Marcus, 31.10.2026: „Rang“ auf ?p=team&tid=).
export const KADER_LIGA_TAGE = 3;
export async function ligaTeamsInSitzung(db: Database.Database, s: MzSitzung, jetzt = Date.now()): Promise<string> {
  const { tabelle } = gespeicherteTabelle(db);
  if (!tabelle) return "Ligateams: keine Tabelle gespeichert.";
  const alle = tabelle.zeilen.map((z) => z.tid).filter((t): t is number => !!t);
  const tids = alle.filter((t) => t !== TEAM.tid);
  let raenge = 0;
  for (const [i, tid] of alle.entries()) {
    try {
      const team = await s.holeText(`/?p=team&tid=${tid}`);
      const rang = weltrangAus(team.text);
      // Erste Seite und jede ohne erkannten Rang für die Diagnose aufheben
      if (i === 0 || rang === null) speichereRohseite(db, { art: "team-seite", url: team.url, status: team.status, htmlRoh: team.text, htmlDom: null });
      if (rang !== null) {
        speichereLigaRang(db, tid, rang);
        raenge++;
      }
    } catch {
      // Rang bleibt beim alten Stand
    }
  }
  let gelesen = 0;
  const fehler: string[] = [];
  for (const tid of tids) {
    const k = ladeGegnerKader(db, tid);
    if (k.length && jetzt - new Date(k[0].stand).getTime() < KADER_LIGA_TAGE * 86_400_000) continue;
    try {
      await liesGegnerKader(db, s, tid);
      gelesen++;
    } catch (e) {
      fehler.push(`tid ${tid}: ${meldungAus(e)}`);
    }
  }
  return `Ligateams: ${raenge} von ${alle.length} Weltrang gelesen, ${gelesen} Kaderseiten gelesen${fehler.length ? `, Fehler: ${fehler.join("; ")}` : ""}.`;
}

// Startelf jedes Ligateams aus seinem letzten Ligaspiel (Stats-XML ohne Login, nacheinander mit Pause; eigene
// gespeicherte Spiele werden nicht neu geholt). Schon gespeicherte Startelfen derselben mid bleiben.
export async function ligaElfenHolen(db: Database.Database, pauseMs = 4000): Promise<string> {
  const { tabelle } = gespeicherteTabelle(db);
  if (!tabelle) return "Startelfen: keine Tabelle gespeichert.";
  const letzte = letzteMidJeTeam(tabelle);
  const vorhanden = ladeLigaElfen(db);
  const mids = [...new Set([...letzte.entries()].filter(([tid, mid]) => vorhanden.get(tid)?.mid !== mid).map(([, mid]) => mid))];
  let geholt = 0;
  const fehler: string[] = [];
  for (const [i, mid] of mids.entries()) {
    let spiel: StatsSpiel | null = ladeSpiel(db, mid);
    if (!spiel) {
      if (i > 0) await new Promise((r) => setTimeout(r, pauseMs));
      const r = await holeStatsXml(mid);
      if (!r.ok) {
        fehler.push(`mid ${mid}: ${r.text}`);
        continue;
      }
      try {
        spiel = parseStatsXml(r.xml);
      } catch (e) {
        fehler.push(`mid ${mid}: ${meldungAus(e)}`);
        continue;
      }
    }
    for (const t of spiel.teams) {
      if (letzte.get(t.id) !== mid) continue;
      const elf = spiel.spieler.filter((p) => p.teamId === t.id && p.origin).map((p) => p.id);
      speichereLigaElf(db, { tid: t.id, mid, datum: spiel.datum, elf });
    }
    geholt++;
  }
  return `Startelfen: ${geholt} von ${mids.length} Spielen gelesen${fehler.length ? `, ${fehler.join("; ")}` : ""}.`;
}

// Nur Ligatabelle mit Kaderseiten und Startelfen (Fernabruf ?art=tabelle; sonst Teil des Spieltag-Abrufs)
export async function ligaTabelleAbrufen(db: Database.Database, opt = { manuell: false }): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "tabelle");
  marke(true);
  const teile: string[] = [];
  let ok = true;
  try {
    await mitMzSitzung(
      db,
      async (s) => {
        await s.holeSeite("/?p=clubhouse");
        teile.push(await ligaTabelleHolen(db, s));
        teile.push(await ligaTeamsInSitzung(db, s));
      },
      opt,
    );
    teile.push(await ligaElfenHolen(db));
  } catch (e) {
    ok = false;
    teile.push(meldungAus(e));
  }
  marke(false);
  const meldung = `Tabelle: ${teile.join(" ")}`;
  abrufBeenden(db, log, ok, meldung);
  return { ok, meldung };
}
