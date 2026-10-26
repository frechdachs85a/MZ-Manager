import "server-only";
import type Database from "better-sqlite3";
import { speichereRohseite } from "@/lib/db/abruf";
import { ladeTeamSpiele, speichereSpielliste } from "@/lib/db/gegner";
import { spielVorhanden } from "@/lib/db/spiele";
import { ausgewertet, fehlversucheSeitOk, laufBeenden, laufBeginnen, letzterLauf, type LaufDaten } from "@/lib/db/spieltag";
import { faelligAb } from "@/lib/spieltag-zeit";
import { zugangStatus } from "@/lib/mz/zugang";
import { anstoss, istLigaspiel, letzteLigaspiele, parseSpielliste, spiellisteHtmlAus, type ListenSpiel } from "@/lib/mz/parser/spielliste";
import { TEAM } from "@/lib/wissen/startbasis";
import { meldungAus, spielXmlEinlesen, type Ergebnis } from "./kader";
import { liesGegnerKader } from "./fremd";
import { holeStatsXml } from "./spiele";
import { marke, mitMzSitzung, MzFehler, type MzSitzung } from "./sitzung";

// Spieltag-Automatik (Auftrag Marcus, 26.10.2026): 5 Stunden nach jedem Ligaspiel
// 1. Spielplan, eigene Spielliste und die Spielliste des nächsten Ligagegners eingeloggt holen,
// 2. Stats-XML des eigenen Ligaspiels und der letzten 8 Ligaspiele des Gegners ohne Login holen
//    (nacheinander mit Pause, gespeicherte nie erneut).
// Spielbericht, Gegneranalyse und Taktikvorschlag rechnet die Seite aus diesen gespeicherten Daten (lib/spieltag.ts).

const STUNDE = 3600_000;
// Nach einem Fehlschlag frühestens nach 2 Stunden erneut, höchstens 3 Versuche je Spieltag
const PAUSE_NACH_FEHLER = 2 * STUNDE;
const MAX_FEHLVERSUCHE = 3;

const LISTE = "/ajax.php?p=matches&sub=list&sport=soccer";

async function holeListe(db: Database.Database, s: MzSitzung, tid: number, type: "played" | "scheduled", art: string) {
  const a = await s.sendeForm(LISTE, { type, hidescore: "false", tid1: String(tid), tid2: "", offset: "", selectType: "all", limit: type === "played" ? "max" : "default" });
  speichereRohseite(db, { art, url: a.url, status: a.status, htmlRoh: a.text, htmlDom: null });
  const html = spiellisteHtmlAus(a.text);
  if (!html) throw new MzFehler(`Spielliste (${type}, tid ${tid}): Antwort nicht erkannt („${a.text.slice(0, 60)}“). Rohantwort gespeichert.`);
  return parseSpielliste(html, tid);
}

// Nächstes Senioren-Ligaspiel laut Spielplan, das noch nicht angepfiffen ist
export function naechstesLigaspiel(plan: ListenSpiel[], jetzt = new Date()): ListenSpiel | undefined {
  return plan
    .filter((s) => istLigaspiel(s) && (anstoss(s)?.getTime() ?? 0) > jetzt.getTime())
    .sort((a, b) => (anstoss(a)?.getTime() ?? 0) - (anstoss(b)?.getTime() ?? 0))[0];
}

// ziel: das Ligaspiel, das ausgewertet werden soll (aus dem letzten Lauf). Steht es noch nicht mit Ergebnis in der
// eigenen Liste, gilt der Lauf als nicht gelungen und wird später wiederholt.
export async function spieltagAbrufen(db: Database.Database, opt: { manuell: boolean; ziel?: number } = { manuell: false }): Promise<Ergebnis> {
  const lauf = laufBeginnen(db);
  marke(true); // auch während der Stats-XML nach der Sitzung kein automatisches Update
  const teile: string[] = [];
  const daten: LaufDaten = {};
  let ok = true;
  try {
    let gegnerSpiele: ListenSpiel[] = [];
    await mitMzSitzung(
      db,
      async (s) => {
        const plan = await holeListe(db, s, TEAM.tid, "scheduled", "spielplan");
        daten.plan = plan.spiele;
        const eigene = await holeListe(db, s, TEAM.tid, "played", "spielliste-eigen");
        speichereSpielliste(db, { ...eigene, teamName: eigene.teamName ?? TEAM.name });
        const naechstes = naechstesLigaspiel(plan.spiele);
        teile.push(`Spielplan: ${plan.spiele.length} kommende Spiele.`);
        if (!naechstes) {
          teile.push("Kein kommendes Ligaspiel im Spielplan.");
          return;
        }
        const heim = naechstes.heim.tid === TEAM.tid;
        const g = heim ? naechstes.gast : naechstes.heim;
        if (!g.tid) throw new MzFehler(`Nächstes Ligaspiel (mid ${naechstes.mid}): Gegner ohne tid im Spielplan.`);
        Object.assign(daten, { naechstesMid: naechstes.mid, gegnerTid: g.tid, gegnerName: g.name, anstoss: anstoss(naechstes)?.toISOString(), heim });
        teile.push(`Nächstes Ligaspiel: ${naechstes.datum} ${naechstes.zeit ?? ""} ${heim ? "gegen" : "bei"} ${g.name}.`);
        const liste = await holeListe(db, s, g.tid, "played", "spielliste-gegner");
        speichereSpielliste(db, { ...liste, teamName: liste.teamName ?? g.name });
        gegnerSpiele = liste.spiele;
        // Kaderseite des Gegners für den Kaderwert-Vergleich der Startelf (mz-wissen.md, Abschnitt 10)
        try {
          teile.push(`Kaderseite ${g.name}: ${await liesGegnerKader(db, s, g.tid)} Spieler.`);
        } catch (e) {
          teile.push(`Kaderseite ${g.name}: ${meldungAus(e)}`);
        }
      },
      opt,
    );

    // Eigenes letztes Ligaspiel (mit Ergebnis in der Liste)
    const letztes = letzteLigaspiele(ladeTeamSpiele(db, TEAM.tid), 99).find((x) => x.tore !== undefined && istLigaspiel(x));
    daten.letztesMid = letztes?.mid;
    if (opt.ziel && letztes?.mid !== opt.ziel) {
      ok = false;
      teile.push(`Ligaspiel mid ${opt.ziel} steht noch nicht mit Ergebnis in der eigenen Spielliste.`);
    }
    const auftraege = [
      ...(letztes ? [letztes.mid] : []),
      ...(daten.gegnerTid ? letzteLigaspiele(gegnerSpiele.filter(istLigaspiel)).filter((x) => x.tore !== undefined).map((x) => x.mid) : []),
    ].filter((mid, i, a) => a.indexOf(mid) === i && !spielVorhanden(db, mid));
    let geholt = 0;
    for (const [i, mid] of auftraege.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 4000));
      const r = await holeStatsXml(mid);
      if (r.ok) {
        spielXmlEinlesen(db, r.xml);
        geholt++;
      } else {
        teile.push(`mid ${mid}: ${r.text}`);
        if (mid === letztes?.mid) ok = false; // ohne das eigene Spiel kein Spielbericht: später erneut
      }
    }
    teile.push(`Stats-XML: ${geholt} von ${auftraege.length} fehlenden Spielen geholt.`);
    if (letztes && !spielVorhanden(db, letztes.mid)) teile.push(`Spielbericht für mid ${letztes.mid} noch nicht möglich (Stats-XML fehlt).`);
  } catch (e) {
    ok = false;
    teile.push(meldungAus(e));
  }
  const meldung = `Spieltag: ${teile.join(" ")}`;
  marke(false);
  laufBeenden(db, lauf, ok, meldung, daten);
  return { ok, meldung };
}

// Fällig (Rückgabe: was zu tun ist, sonst null):
// - Das im letzten gelungenen Lauf angekündigte Ligaspiel ist seit 5 Stunden vorbei und noch nicht ausgewertet.
// - Sonst einmal täglich, damit Spielplan und nächster Gegner aktuell sind (auch ganz ohne bisherigen Lauf).
// Nach einem Fehlschlag frühestens nach 2 Stunden erneut; nach 3 Fehlschlägen in Folge nur noch einmal am Tag.
export function spieltagFaellig(db: Database.Database, jetzt = new Date()): { ziel?: number } | null {
  if (!zugangStatus(db).eingerichtet) return null;
  const fehl = fehlversucheSeitOk(db);
  const seitFehler = fehl.letzter ? jetzt.getTime() - new Date(fehl.letzter).getTime() : Infinity;
  if (seitFehler < (fehl.anzahl >= MAX_FEHLVERSUCHE ? 24 * STUNDE : PAUSE_NACH_FEHLER)) return null;
  const ok = letzterLauf(db, true);
  if (ok?.anstoss && ok.naechstesMid && jetzt.getTime() >= faelligAb(ok.anstoss).getTime() && !ausgewertet(db, ok.naechstesMid)) {
    return { ziel: ok.naechstesMid };
  }
  if (!ok || jetzt.getTime() - new Date(ok.gestartet).getTime() > 24 * STUNDE) return {};
  return null;
}
