import "server-only";
import type Database from "better-sqlite3";
import { parse } from "node-html-parser";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { speichereGegnerKader } from "@/lib/db/gegner-kader";
import { KaderSeiteUnbekannt } from "@/lib/mz/parser/kader";
import { parseSpielerBlock } from "@/lib/mz/parser/spielerblock";
import { meldungAus, type Ergebnis } from "./kader";
import { mitMzSitzung, type MzSitzung } from "./sitzung";

// Kaderseite in einer laufenden Sitzung lesen und speichern (auch für den Spieltag-Abruf)
export async function liesGegnerKader(db: Database.Database, s: MzSitzung, tid: number): Promise<number> {
  const seite = await s.holeSeite(`/?p=players&tid=${tid}`);
  const html = seite.htmlDom ?? seite.htmlRoh ?? "";
  speichereRohseite(db, { art: "gegner-kader", url: seite.url, status: seite.status, htmlRoh: seite.htmlRoh, htmlDom: seite.htmlDom });
  const bloecke = parse(html).querySelectorAll("div").filter((d) => /^thePlayers_\d+$/.test(d.id));
  if (bloecke.length === 0) throw new KaderSeiteUnbekannt("Keine Spielerblöcke (thePlayers_…) auf der Kaderseite.");
  const spieler = bloecke.map(parseSpielerBlock);
  speichereGegnerKader(db, tid, spieler);
  return spieler.length;
}

// Kaderseite eines fremden Teams (?p=players&tid=…; Blöcke div[id^="thePlayers_"] laut mz-wissen.md, Abschnitt 2).
// Gelesen werden nur Name, pid, Alter und Marktwert; Skills sind dort meist nicht sichtbar.
export async function gegnerKaderAbrufen(db: Database.Database, tid: number): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "gegner-kader");
  try {
    const anzahl = await mitMzSitzung(
      db,
      (s) => liesGegnerKader(db, s, tid),
      { manuell: true },
    );
    const meldung = `Kaderseite tid ${tid}: ${anzahl} Spieler mit Alter und Marktwert gespeichert.`;
    abrufBeenden(db, log, true, meldung);
    return { ok: true, meldung };
  } catch (e) {
    const meldung = `Kaderseite tid ${tid}: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}
