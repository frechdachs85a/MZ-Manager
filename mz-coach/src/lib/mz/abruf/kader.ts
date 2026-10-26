import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { ladeKader, speichereKader } from "@/lib/db/kader";
import { scoutKlicker, speichereScoutTexte, type ScoutAntwort } from "./scout";
import { KaderSeiteUnbekannt, parseKaderSeite } from "@/lib/mz/parser/kader";
import {
  istSpielerSeite,
  istTaktikSeite,
  istTrainingslagerSeite,
  istUnavailableSeite,
  parseSpielerSeite,
  parseTaktikSeite,
  parseTrainingslagerSeite,
  parseUnavailableSeite,
} from "@/lib/mz/parser/status";
import { speichereSpielliste } from "@/lib/db/gegner";
import { speichereSpiel } from "@/lib/db/spiele";
import { istSpielliste, ligaspieleDieserSaison, parseSpielliste } from "@/lib/mz/parser/spielliste";
import { istStatsXml, parseStatsXml, statsXmlAus, StatsXmlFehler } from "@/lib/mz/parser/stats";
import { mitMzSitzung, MZ_BASIS, MzFehler } from "./sitzung";
import {
  speichereSpielerSeite,
  speichereTaktik,
  speichereTrainingslager,
  speichereUnavailable,
  StatusFehler,
  type StatusErgebnis,
} from "./status";

// Eigene Seiten, eingeloggt (Aufbau geprüft am 24.10.2026, docs/mz-seiten.md).
export const KADER_PFAD = "/?p=players&sub=alt";
export const UNAVAILABLE_PFAD = "/?p=players&sub=unavailable";
export const TRAININGSLAGER_PFAD = "/?p=training_camp";
export const TAKTIK_PFAD = "/?p=tactics";
export const SPIELER_PFAD = "/?p=players";

export type Ergebnis = { ok: boolean; meldung: string };

const kurz = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";

// Kaderübersicht: Rohseite, Schnappschüsse und Änderungen. Stand = Serverzeit der Seite.
function speichereKaderSeite(db: Database.Database, html: string, url: string, quelle: string, htmlDom: string | null) {
  const { spieler, serverzeit } = parseKaderSeite(html);
  const stand = serverzeit ?? new Date().toISOString();
  // Ältere Seiten nicht über einen neueren Stand legen, sonst entstünden rückwärts gerichtete Änderungen.
  const neuester = (db.prepare("SELECT max(abgerufen) AS z FROM spieler").get() as { z: string | null }).z;
  if (serverzeit && neuester === stand) throw new MzFehler(`Kaderübersicht vom ${kurz(stand)} ist schon eingelesen.`);
  if (neuester && stand < neuester) {
    throw new MzFehler(`Kaderübersicht vom ${kurz(stand)} ist älter als der gespeicherte Stand.`);
  }
  speichereRohseite(db, { art: "kader", url, status: null, htmlRoh: htmlDom ? null : html, htmlDom }, stand);
  const r = speichereKader(db, spieler, quelle, stand);
  return `Kaderübersicht: ${spieler.length} Spieler, ${r.neu} neu, ${r.aenderungen} Änderungen.`;
}

function statusText(titel: string, r: StatusErgebnis) {
  const fehlt = r.nichtImKader.length ? ` Nicht im gespeicherten Kader: ${r.nichtImKader.join(", ")}.` : "";
  return `${titel}: eingelesen (Stand ${kurz(r.stand)}), ${r.aenderungen} Änderungen.${fehlt}`;
}

// Erkennt die Seitenart und wertet sie aus. Wirft bei unbekannter Seite oder unbekanntem Aufbau.
// Stats-XML eines Spiels: einmal speichern (Roh-XML und Auswertung), nie doppelt.
export function spielXmlEinlesen(db: Database.Database, text: string): string {
  const xml = statsXmlAus(text);
  const s = parseStatsXml(xml);
  const heim = s.teams.find((t) => t.heim) ?? s.teams[0];
  const gast = s.teams.find((t) => t !== heim)!;
  const titel = `Spiel ${s.mid} (${heim.name} ${heim.statistik.goals ?? "?"}:${gast.statistik.goals ?? "?"} ${gast.name})`;
  if (speichereSpiel(db, s, xml) === "vorhanden") return `${titel}: schon gespeichert.`;
  return `${titel}: gespeichert.${s.hinweise.length ? ` Hinweise: ${s.hinweise.join(" ")}` : ""}`;
}

export function seiteEinlesen(db: Database.Database, html: string, herkunft: { url: string; quelle: string; htmlDom?: string | null }): string {
  if (istStatsXml(html)) return spielXmlEinlesen(db, html);
  if (istSpielliste(html)) {
    const l = parseSpielliste(html);
    const r = speichereSpielliste(db, l);
    return `Spielliste ${l.teamName ?? ""} (tid ${l.tid}): ${l.spiele.length} Spiele, ${r.neu} neu, davon ${ligaspieleDieserSaison(l).length} Ligaspiele dieser Saison.`;
  }
  if (/id="playerAltViewTable"/.test(html)) {
    return speichereKaderSeite(db, html, herkunft.url, herkunft.quelle, herkunft.htmlDom ?? null);
  }
  if (istSpielerSeite(html)) {
    return statusText("Spieleransicht (Scoutbericht)", speichereSpielerSeite(db, parseSpielerSeite(html), { url: herkunft.url, html }, herkunft.quelle));
  }
  if (istUnavailableSeite(html)) {
    return statusText("Verletzt / Gesperrt", speichereUnavailable(db, parseUnavailableSeite(html), { url: herkunft.url, html }, herkunft.quelle));
  }
  if (istTrainingslagerSeite(html)) {
    return statusText("Trainingslager", speichereTrainingslager(db, parseTrainingslagerSeite(html), { url: herkunft.url, html }, herkunft.quelle));
  }
  if (istTaktikSeite(html)) {
    const r = speichereTaktik(db, parseTaktikSeite(html), { url: herkunft.url, html }, herkunft.quelle);
    const unbekannt = r.unbekannt.length ? ` Zustand unbekannt (nicht gewertet): ${r.unbekannt.join(", ")}.` : "";
    return statusText("Taktik (aufstellbar)", r) + unbekannt;
  }
  throw new KaderSeiteUnbekannt(
    "Unbekannte Seite. Erwartet: Kaderübersicht (?p=players&sub=alt), Spieleransicht (?p=players), Verletzt / Gesperrt (?p=players&sub=unavailable), Trainingslager (?p=training_camp), Taktik (?p=tactics), Spielliste (?p=match&sub=played&tid=…) oder Stats-XML eines Spiels.",
  );
}

export function meldungAus(e: unknown): string {
  if (e instanceof MzFehler || e instanceof KaderSeiteUnbekannt || e instanceof StatusFehler || e instanceof StatsXmlFehler) {
    return e.message;
  }
  // Sonstige Fehler (Browser fehlt, Zeitüberschreitung) enthalten nur URLs, erste Zeile reicht.
  return `Technischer Fehler: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`;
}

// Automatischer Abruf: Kaderübersicht zuerst, dann Status-Seiten. Ein Fehler bei einer Seite
// hält die anderen nicht auf, die Meldung nennt jede Seite einzeln.
export async function kaderAbrufen(db: Database.Database, opt = { manuell: false }): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "kader");
  const teile: string[] = [];
  let allesOk = true;
  try {
    await mitMzSitzung(
      db,
      async (s) => {
        for (const pfad of [KADER_PFAD, SPIELER_PFAD, UNAVAILABLE_PFAD, TRAININGSLAGER_PFAD, TAKTIK_PFAD]) {
          // Spieleransicht: zusätzlich die Scoutberichte anklicken (nur fehlende oder mit geänderten Sternen)
          const aufSeite = pfad === SPIELER_PFAD ? scoutKlicker(new Map(ladeKader(db).map((k) => [k.pid, k]))) : undefined;
          try {
            const seite = await s.holeSeite(pfad, aufSeite ? { aufSeite } : undefined);
            const html = seite.htmlDom ?? seite.htmlRoh ?? "";
            teile.push(seiteEinlesen(db, html, { url: seite.url, quelle: `${MZ_BASIS}${pfad}`, htmlDom: seite.htmlDom }));
            if (aufSeite && seite.extra) {
              const { antworten, fehler } = seite.extra as { antworten: ScoutAntwort[]; fehler: string[] };
              const n = speichereScoutTexte(db, antworten, new Date().toISOString(), `${MZ_BASIS}${pfad} (Scoutbericht)`);
              teile.push(`Scoutberichte: ${n} Texte gelesen${fehler.length ? `, nicht lesbar: ${fehler.join("; ")}` : ""}.`);
              if (fehler.length) allesOk = false;
            }
          } catch (e) {
            allesOk = false;
            teile.push(`${pfad}: ${meldungAus(e)}`);
          }
        }
      },
      opt,
    );
  } catch (e) {
    allesOk = false;
    teile.push(meldungAus(e));
  }
  const meldung = teile.join(" ");
  abrufBeenden(db, log, allesOk, meldung);
  return { ok: allesOk, meldung };
}

// Von Hand im Browser gespeicherte Seiten (Strg+S), ohne automatischen Abruf. Mehrere Dateien
// werden nach ihrem Stand sortiert, die Kaderübersicht zuerst.
export function dateienEinlesen(db: Database.Database, dateien: { name: string; html: string }[]): Ergebnis {
  const log = abrufBeginnen(db, "kader");
  const rang = (html: string) => (/id="playerAltViewTable"/.test(html) ? 0 : 1);
  const sortiert = [...dateien].sort((a, b) => rang(a.html) - rang(b.html));
  const teile: string[] = [];
  let allesOk = true;
  for (const d of sortiert) {
    try {
      teile.push(
        seiteEinlesen(db, d.html, { url: `Datei: ${d.name}`, quelle: `von Hand gespeicherte Seite, Datei ${d.name}` }),
      );
    } catch (e) {
      allesOk = false;
      teile.push(`${d.name}: ${meldungAus(e)}`);
    }
  }
  const meldung = teile.join(" ");
  abrufBeenden(db, log, allesOk, meldung);
  return { ok: allesOk, meldung };
}
