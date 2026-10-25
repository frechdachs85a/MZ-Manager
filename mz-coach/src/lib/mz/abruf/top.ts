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
import { holeStatsXml } from "./spiele";

// Lernmaterial aus den Topteams (Auftrag Marcus, 25.10.2026): je Team die letzten 10 Liga- und 10
// Weltligaspiele. Spiellisten über die eingeloggte Sitzung (ajax.php?p=matches&sub=list, Felder wie
// im Formular #matchListForm), Stats-XML ohne Login. Gespeicherte Spiele werden nie erneut geholt.
// Höchstens so viele neue Stats-XML je Lauf (je Spiel bis zu ~1 Minute mit check-match); der Rest folgt am nächsten Tag
export const MAX_XML_JE_LAUF = 60;

export async function topAbrufen(db: Database.Database, opt = { manuell: false }): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "top10");
  const teile: string[] = [];
  let ok = true;
  try {
    const teams = ladeTopTeams(db);
    // 1. Spiellisten eingeloggt
    await mitMzSitzung(
      db,
      async (s) => {
        // Rangliste roh sichern (Aufbau noch nicht gesehen; Parser folgt nach Prüfung)
        const rang = await s.holeSeite("/?p=rank");
        speichereRohseite(db, { art: "rangliste", url: rang.url, status: rang.status, htmlRoh: rang.htmlRoh, htmlDom: rang.htmlDom });
        for (const t of teams) {
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
          speichereSpielliste(db, { ...liste, teamName: liste.teamName ?? t.name });
          const { liga, weltliga } = auswahlLernspiele(liste.spiele);
          teile.push(`${t.name}: ${liste.spiele.length} Spiele in der Liste, davon ${liga.length} Liga und ${weltliga.length} Weltliga ausgewählt.`);
        }
      },
      opt,
    );

    // 2. Stats-XML ohne Login, nacheinander mit Pause
    const fehlen = teams
      .flatMap((t) => {
        const { liga, weltliga } = auswahlLernspiele(ladeTeamSpiele(db, t.tid));
        return [...liga, ...weltliga];
      })
      .filter((s, i, alle) => alle.findIndex((x) => x.mid === s.mid) === i && !spielVorhanden(db, s.mid));
    let geholt = 0;
    for (const s of fehlen.slice(0, MAX_XML_JE_LAUF)) {
      if (geholt > 0) await new Promise((r) => setTimeout(r, 4000));
      const r = await holeStatsXml(s.mid);
      if (r.ok) {
        spielXmlEinlesen(db, r.xml);
        geholt++;
      } else {
        teile.push(`mid ${s.mid}: ${r.text}`);
      }
    }
    teile.push(`Stats-XML: ${geholt} neu gespeichert, ${Math.max(0, fehlen.length - MAX_XML_JE_LAUF)} folgen beim nächsten Lauf.`);
  } catch (e) {
    ok = false;
    teile.push(meldungAus(e));
  }
  const meldung = `Top 10: ${teile.join(" ")}`;
  abrufBeenden(db, log, ok, meldung);
  return { ok, meldung };
}

const berlinTag = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
const berlinStunde = (d: Date) =>
  Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(d));

// Einmal am Tag ab 4 Uhr (Berlin), vor der Marktsuche; ein Versuch je Tag.
export function topFaellig(db: Database.Database, jetzt = new Date()): boolean {
  if (!zugangStatus(db).eingerichtet || berlinStunde(jetzt) < 4) return false;
  const letzter = letzterAbruf(db, "top10");
  return !letzter || berlinTag(new Date(letzter.gestartet)) !== berlinTag(jetzt);
}
