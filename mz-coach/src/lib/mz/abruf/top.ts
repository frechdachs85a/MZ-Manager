import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen, letzterAbruf, speichereRohseite } from "@/lib/db/abruf";
import { ladeTeamSpiele, speichereSpielliste } from "@/lib/db/gegner";
import { spielVorhanden } from "@/lib/db/spiele";
import { ladeTopTeams } from "@/lib/db/top";
import { zugangStatus } from "@/lib/mz/zugang";
import { parseSpielliste, spiellisteHtmlAus } from "@/lib/mz/parser/spielliste";
import { auswahlLernspiele } from "./top-auswahl";
import { meldungAus, spielXmlEinlesen, type Ergebnis } from "./kader";
import { mitMzSitzung, MzFehler } from "./sitzung";
import { TEAM } from "@/lib/wissen/startbasis";
import { letzteLigaspiele, type ListenSpiel } from "@/lib/mz/parser/spielliste";
import { holeStatsXml } from "./spiele";
import { speichereTopSpiel, topSpielVorhanden, type TopArt } from "@/lib/db/top-spiel";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { spielMuster } from "@/lib/mz/analyse/muster";

// Lernmaterial aus den Topteams (Auftrag Marcus, 25.10.2026): je Team die letzten 10 Liga- und 10
// Weltligaspiele. Spiellisten über die eingeloggte Sitzung (ajax.php?p=matches&sub=list, Felder wie
// im Formular #matchListForm), Stats-XML ohne Login. Gespeicherte Spiele werden nie erneut geholt.
//
// Höchstens so viele neue Stats-XML je Lauf (je Spiel bis zu ~1 Minute mit check-match); der Rest folgt am nächsten Tag
export const MAX_XML_JE_LAUF = 60;

const TAG_MS = 24 * 3600_000;

// Top-10-Spiellisten einmal pro Woche: montags (Berlin) oder wenn der letzte erfolgreiche Lauf
// länger als 7 Tage her ist. Eigene Spiele, Tabelle und das Nachholen fehlender Stats-XML täglich.
export function topWocheFaellig(db: Database.Database, jetzt = new Date()): boolean {
  const r = db.prepare("SELECT max(gestartet) AS z FROM abruf_log WHERE art = 'top10-listen' AND ok = 1").get() as { z: string | null };
  if (!r.z) return true;
  const seit = jetzt.getTime() - new Date(r.z).getTime();
  const montag = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" }).format(jetzt) === "Mon";
  return seit > 7 * TAG_MS || (montag && berlinTag(new Date(r.z)) !== berlinTag(jetzt));
}

export async function topAbrufen(db: Database.Database, opt = { manuell: false }): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "top10");
  const teile: string[] = [];
  let ok = true;
  const woche = opt.manuell || topWocheFaellig(db);
  const listenLog = woche ? abrufBeginnen(db, "top10-listen") : null;
  let listenFertig = false;
  try {
    const teams = woche ? ladeTopTeams(db) : [];
    // 1. Spiellisten eingeloggt
    await mitMzSitzung(
      db,
      async (s) => {
        // Rangliste roh sichern (Aufbau noch nicht gesehen; Parser folgt nach Prüfung), nur wöchentlich
        if (woche) {
          const rang = await s.holeSeite("/?p=rank");
          speichereRohseite(db, { art: "rangliste", url: rang.url, status: rang.status, htmlRoh: rang.htmlRoh, htmlDom: rang.htmlDom });
        }
        // Ligatabelle (Link aus der Navigation von ManagerZone); angezeigt auf der Übersicht
        const tab = await s.holeSeite("/?p=league&type=senior");
        speichereRohseite(db, { art: "tabelle", url: tab.url, status: tab.status, htmlRoh: tab.htmlRoh, htmlDom: tab.htmlDom });
        // Eigenes Team dazu: alle Ligaspiele der Saison für die Saisonstatistik
        for (const t of [...teams, { tid: TEAM.tid, name: TEAM.name, rang: 0, quelle: "", stand: "" }]) {
          const a = await s.sendeForm("/ajax.php?p=matches&sub=list&sport=soccer", {
            type: "played",
            hidescore: "false",
            tid1: String(t.tid),
            tid2: "",
            offset: "",
            selectType: "all",
            limit: "max",
          });
          const html = spiellisteHtmlAus(a.text);
          if (!html) {
            speichereRohseite(db, { art: "top-liste-unbekannt", url: a.url, status: a.status, htmlRoh: a.text, htmlDom: null });
            throw new MzFehler(`Spielliste von ${t.name}: Antwort nicht erkannt („${a.text.slice(0, 60)}“). Rohantwort gespeichert.`);
          }
          const liste = parseSpielliste(html, t.tid);
          const { liga, weltliga } = auswahlLernspiele(liste.spiele);
          // Eigenes Team: ganze Liste (Saisonstatistik). Topteams: nur die ausgewählten Spiele behalten.
          const behalten = t.tid === TEAM.tid ? liste.spiele : [...liga, ...weltliga];
          speichereSpielliste(db, { ...liste, spiele: behalten, teamName: liste.teamName ?? t.name });
          if (t.tid !== TEAM.tid) {
            const mids = behalten.map((x) => x.mid);
            db.prepare(`DELETE FROM team_spiel WHERE tid = ? AND mid NOT IN (${mids.map(() => "?").join(",") || "NULL"})`).run(t.tid, ...mids);
          }
          teile.push(`${t.name}: ${liste.spiele.length} Spiele in der Liste, davon ${liga.length} Liga und ${weltliga.length} Weltliga ausgewählt.`);
        }
      },
      opt,
    );
    if (listenLog) {
      abrufBeenden(db, listenLog, true, "Spiellisten der Top 10 gelesen.");
      listenFertig = true;
    }

    // 2. Stats-XML ohne Login, nacheinander mit Pause
    const eigene: ListenSpiel[] = letzteLigaspiele(ladeTeamSpiele(db, TEAM.tid), 99).filter((s) => s.tore !== undefined);
    // Fehlende Spiele (auch an Tagen ohne Listenabruf: Nachholen bis alles da ist). Eigene Spiele werden
    // komplett gespeichert; von Topteams nur ein Muster ohne Spielernamen, die XML wird nicht aufbewahrt.
    const topTeams = ladeTopTeams(db);
    const topTids = new Set(topTeams.map((t) => t.tid));
    type Auftrag = { mid: number; eigen: boolean; top: { tid: number; art: TopArt }[] };
    const auftraege = new Map<number, Auftrag>();
    for (const s of eigene) if (!spielVorhanden(db, s.mid)) auftraege.set(s.mid, { mid: s.mid, eigen: true, top: [] });
    for (const t of topTeams) {
      const { liga, weltliga } = auswahlLernspiele(ladeTeamSpiele(db, t.tid));
      for (const [art, l] of [["liga", liga], ["weltliga", weltliga]] as const) {
        for (const s of l) {
          if (topSpielVorhanden(db, s.mid, t.tid)) continue;
          const a = auftraege.get(s.mid) ?? { mid: s.mid, eigen: false, top: [] };
          a.top.push({ tid: t.tid, art });
          auftraege.set(s.mid, a);
        }
      }
    }
    const fehlen = [...auftraege.values()];
    let geholt = 0;
    for (const a of fehlen.slice(0, MAX_XML_JE_LAUF)) {
      if (geholt > 0) await new Promise((r) => setTimeout(r, 4000));
      const r = await holeStatsXml(a.mid);
      if (!r.ok) {
        teile.push(`mid ${a.mid}: ${r.text}`);
        continue;
      }
      if (a.eigen) spielXmlEinlesen(db, r.xml);
      if (a.top.length) {
        const spiel = parseStatsXml(r.xml);
        for (const t of a.top) if (topTids.has(t.tid)) speichereTopSpiel(db, t.tid, t.art, spielMuster(spiel, t.tid, { anonym: true }));
      }
      geholt++;
    }
    teile.push(`Stats-XML: ${geholt} Spiele neu ausgewertet, ${Math.max(0, fehlen.length - MAX_XML_JE_LAUF)} folgen beim nächsten Lauf.`);
    // Wöchentliches Archiv der Auswertung, damit Erkenntnisse nicht verloren gehen
    if (woche) {
      const { archiviereTop } = await import("@/lib/archiv");
      teile.push(archiviereTop(db) ? "Top-10-Auswertung archiviert." : "Top-10-Auswertung unverändert, kein neuer Archiv-Eintrag.");
    }
  } catch (e) {
    ok = false;
    teile.push(meldungAus(e));
    if (listenLog && !listenFertig) abrufBeenden(db, listenLog, false, meldungAus(e));
  }
  const meldung = `Top 10: ${teile.join(" ")}`;
  abrufBeenden(db, log, ok, meldung);
  return { ok, meldung };
}

const berlinTag = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
const berlinStunde = (d: Date) =>
  Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(d));

// Täglicher Lauf ab 4 Uhr (Berlin), vor der Marktsuche; ein Versuch je Tag. Die Top-10-Listen darin nur wöchentlich.
export function topFaellig(db: Database.Database, jetzt = new Date()): boolean {
  if (!zugangStatus(db).eingerichtet || berlinStunde(jetzt) < 4) return false;
  const letzter = letzterAbruf(db, "top10");
  return !letzter || berlinTag(new Date(letzter.gestartet)) !== berlinTag(jetzt);
}
