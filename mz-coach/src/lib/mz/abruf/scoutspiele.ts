import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { bekannteScoutMids, speichereScoutSpiel } from "@/lib/db/scout-spiel";
import { letzterLauf } from "@/lib/db/spieltag";
import { parseSpielliste, spiellisteHtmlAus } from "@/lib/mz/parser/spielliste";
import { parseStatsXml, statsXmlAus } from "@/lib/mz/parser/stats";
import { TEAM } from "@/lib/wissen/startbasis";
import { scoutAbDatum } from "@/lib/scout-auswertung";
import { meldungAus, type Ergebnis } from "./kader";
import { mitMzSitzung, MzFehler } from "./sitzung";

// Scoutspiele gegen den nächsten Ligagegner holen (Marcus, 31.10.2026: mit einem Klick alle Scoutspiele auswerten).
// Nur lesen. Wege aus mz-wissen.md: Spielliste per POST ajax.php?p=matches&sub=list mit selectType=scout_match
// (Abschnitt 13); Stats-XML über check-match und getMatchFiles.php?type=stats (Abschnitt 2), eingeloggt, weil
// ManagerZone Scoutspiele sonst sperrt ("blocked"). Bereits gespeicherte Spiele werden nicht noch einmal geholt.
const PAUSE_MS = 6000;
const VERSUCHE = 10;
const schlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function scoutspieleAbrufen(db: Database.Database, opt: { manuell: boolean; gegnerTid?: number } = { manuell: true }): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "scoutspiele");
  try {
    const lauf = letzterLauf(db, true);
    const tid = opt.gegnerTid ?? lauf?.gegnerTid ?? undefined;
    if (!tid) throw new MzFehler("Kein nächster Ligagegner bekannt (Spieltag-Analyse fehlt).");
    const name = opt.gegnerTid ? undefined : (lauf?.gegnerName ?? undefined);
    const meldung = await mitMzSitzung(
      db,
      async (s) => {
        // Erst eine Seite laden: nur holeSeite meldet bei abgelaufener Sitzung neu an; die Spielliste (ajax) allein
        // antwortet dann "You need to be logged in" (beobachtet beim Spieltag-Abruf 27. bis 30.10.2026)
        await s.holeSeite("/?p=clubhouse");
        const a = await s.sendeForm("/ajax.php?p=matches&sub=list&sport=soccer", {
          type: "played",
          hidescore: "false",
          tid1: String(TEAM.tid),
          tid2: "",
          offset: "",
          selectType: "scout_match",
          limit: "max",
        });
        speichereRohseite(db, { art: "scoutspiele-liste", url: a.url, status: a.status, htmlRoh: a.text, htmlDom: null });
        const html = spiellisteHtmlAus(a.text);
        if (!html) throw new MzFehler("Liste der Scoutspiele: Antwort nicht erkannt (gespeichert als scoutspiele-liste).");
        // Nur Scoutspiele seit dem eigenen letzten Ligaspiel (Marcus, 31.10.2026), ältere werden nicht geladen
        const ab = scoutAbDatum(db);
        const liste = parseSpielliste(html, TEAM.tid).spiele.filter((x) => (x.heim.tid === tid || x.gast.tid === tid) && (!ab || x.datum >= ab));
        const bekannt = bekannteScoutMids(db);
        const neu = liste.filter((x) => !bekannt.has(x.mid));
        let geholt = 0;
        const fehler: string[] = [];
        for (const sp of neu) {
          const statsPfad = `/matchviewer/getMatchFiles.php?type=stats&mid=${sp.mid}&sport=soccer`;
          const hatXml = (t: string) => /<SoccerStatistics[\s>]/.test(t) && /<\/SoccerStatistics>/.test(t);
          let t = (await s.holeText(statsPfad)).text;
          for (let i = 0; !hatXml(t) && i < VERSUCHE; i++) {
            const c = (await s.holeText(`/ajax.php?p=matchViewer&sub=check-match&type=2d&mid=${sp.mid}&sport=soccer`)).text;
            let antwort = "";
            try {
              antwort = (JSON.parse(c) as { response?: string }).response ?? "";
            } catch {
              antwort = "";
            }
            if (antwort === "ok") {
              await schlafen(3000);
              t = (await s.holeText(statsPfad)).text;
              break;
            }
            await schlafen(PAUSE_MS);
          }
          if (!hatXml(t)) {
            fehler.push(`${sp.mid}: XML leer`);
            continue;
          }
          try {
            const spiel = parseStatsXml(statsXmlAus(t));
            const gegner = sp.heim.tid === tid ? sp.heim : sp.gast;
            speichereScoutSpiel(db, { mid: sp.mid, gegnerTid: tid, gegnerName: gegner.name, datum: sp.datum, spiel });
            geholt++;
          } catch (e) {
            fehler.push(`${sp.mid}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        return `Scoutspiele gegen ${name ?? `tid ${tid}`}: ${liste.length} in der Liste, ${liste.length - neu.length} schon gespeichert, ${geholt} neu geholt${fehler.length ? `; nicht lesbar: ${fehler.join(", ")}` : ""}.`;
      },
      { manuell: opt.manuell },
    );
    abrufBeenden(db, log, true, meldung);
    return { ok: true, meldung };
  } catch (e) {
    const meldung = `Scoutspiele: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}
