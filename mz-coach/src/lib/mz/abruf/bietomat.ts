import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { endeAlsDatum, parseTransferSuche, type MarktSpieler } from "@/lib/mz/parser/transfer";
import { berlinZuUtc } from "@/lib/mz/parser/kader";
import { MARKT_PFAD, suchParameter } from "./markt";
import { mitFiltern } from "./markt-ziel";
import { meldungAus } from "./kader";
import { mitMzSitzung } from "./sitzung";

// Bietomat, Stufe 1: einen Spieler per Spielernummer vom Transfermarkt laden (Suche über das Feld Name/ID des
// Suchformulars, sonst Standardwerte des Formulars). Dazu das Gebotsfenster (transfer.js: buy() öffnet
// ajax.php?p=transfer&sub=bid-form&pid=…) NUR LESEN und speichern, damit das Abschicken eines Gebots erst nach
// Prüfung gebaut wird. Es wird hier nichts geboten.
export type Geladen = { ok: true; spieler: MarktSpieler; endeUtc?: string } | { ok: false; meldung: string };

export function endeUtc(ende?: string): string | undefined {
  const m = endeAlsDatum(ende)?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return m ? berlinZuUtc(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString() : undefined;
}

export async function spielerLaden(db: Database.Database, pid: number): Promise<Geladen> {
  const log = abrufBeginnen(db, "bietomat-laden");
  try {
    const spieler = await mitMzSitzung(
      db,
      async (s) => {
        const seite = await s.holeSeite(MARKT_PFAD);
        const params = mitFiltern(suchParameter(seite.htmlDom ?? seite.htmlRoh ?? ""), { u: pid });
        const a = await s.holeText(`/ajax.php?p=transfer&sub=transfer-search&sport=soccer${params}&o=0`);
        speichereRohseite(db, { art: "gebot-suche", url: a.url, status: a.status, htmlRoh: a.text, htmlDom: null });
        const treffer = parseTransferSuche(a.text).spieler.find((x) => x.pid === pid);
        if (treffer) {
          const f = await s.holeText(`/ajax.php?p=transfer&sub=bid-form&pid=${pid}&sport=soccer`);
          speichereRohseite(db, { art: "gebotsformular", url: f.url, status: f.status, htmlRoh: f.text, htmlDom: null });
        }
        return treffer;
      },
      { manuell: true },
    );
    if (!spieler) {
      const meldung = `Spieler ${pid} nicht auf dem Transfermarkt gefunden (Suche mit den Standardfiltern der Marktseite, z. B. Alter 19 bis 37).`;
      abrufBeenden(db, log, false, meldung);
      return { ok: false, meldung };
    }
    abrufBeenden(db, log, true, `Bietomat: ${spieler.name} (${pid}) geladen.`);
    return { ok: true, spieler, endeUtc: endeUtc(spieler.markt.ende) };
  } catch (e) {
    const meldung = `Bietomat: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}
