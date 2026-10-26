import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { endeAlsDatum, parseTransferSuche, type MarktSpieler } from "@/lib/mz/parser/transfer";
import { berlinZuUtc } from "@/lib/mz/parser/kader";
import { MARKT_PFAD, suchParameter } from "./markt";
import { mitFiltern } from "./markt-ziel";
import { meldungAus } from "./kader";
import { mitMzSitzung } from "./sitzung";

// Bietomat: Spieler per Spielernummer ODER Name vom Transfermarkt laden (Feld "Name/ID" des Suchformulars, Marcus
// 26.10.2026; sonst die Standardfilter der Marktseite). Mehrere Treffer beim Namen: Auswahlliste. Es wird nicht geboten.
export type MitEnde = MarktSpieler & { endeUtc?: string };
export type Geladen = { ok: true; spieler: MitEnde } | { ok: false; meldung: string; auswahl?: MitEnde[] };

// Auktionsende (Berliner Zeit) als ISO-Zeitpunkt
export function endeUtc(ende?: string): string | undefined {
  const m = endeAlsDatum(ende)?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return m ? berlinZuUtc(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString() : undefined;
}

// Spieler per Nummer oder Name vom Transfermarkt laden
export async function spielerLaden(db: Database.Database, eingabe: string): Promise<Geladen> {
  const suche = eingabe.trim();
  const pid = /^\d+$/.test(suche) ? Number(suche) : undefined;
  const log = abrufBeginnen(db, "bietomat-laden");
  try {
    const liste = await mitMzSitzung(
      db,
      async (s) => {
        const seite = await s.holeSeite(MARKT_PFAD);
        const params = mitFiltern(suchParameter(seite.htmlDom ?? seite.htmlRoh ?? ""), { u: suche });
        const a = await s.holeText(`/ajax.php?p=transfer&sub=transfer-search&sport=soccer${params}&o=0`);
        speichereRohseite(db, { art: "gebot-suche", url: a.url, status: a.status, htmlRoh: a.text, htmlDom: null });
        return parseTransferSuche(a.text).spieler.map((x) => ({ ...x, endeUtc: endeUtc(x.markt.ende) }));
      },
      { manuell: true },
    );
    const treffer = pid !== undefined ? liste.filter((x) => x.pid === pid) : liste;
    if (treffer.length === 1) {
      abrufBeenden(db, log, true, `Bietomat: ${treffer[0].name} (${treffer[0].pid}) geladen.`);
      return { ok: true, spieler: treffer[0] };
    }
    const meldung = treffer.length
      ? `${treffer.length} Spieler für „${suche}“ gefunden: bitte einen auswählen.`
      : `„${suche}“ nicht auf dem Transfermarkt gefunden (Suche mit den Standardfiltern der Marktseite, z. B. Alter 19 bis 37).`;
    abrufBeenden(db, log, treffer.length > 0, `Bietomat: ${meldung}`);
    return { ok: false, meldung, auswahl: treffer.length ? treffer : undefined };
  } catch (e) {
    const meldung = `Bietomat: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}

// Nur lesend, für die Auswertung (Marcus, 26.10.2026: "die Informationen selber holen"): frisch auf dem Transfermarkt
// suchen (Standardfilter der Marktseite), einen Spieler mit laufender Auktion nehmen (möglichst mehr als 1 Stunde Rest)
// und sein Gebotsfenster speichern (Rohseite "gebotsformular"). Es wird nicht geboten.
export async function gebotsformularLesen(db: Database.Database): Promise<{ ok: boolean; meldung: string }> {
  const log = abrufBeginnen(db, "gebotsformular");
  try {
    const meldung = await mitMzSitzung(
      db,
      async (s) => {
        // mz.js/main.js enthalten form_confirm_transfer (Bestätigung "Bist Du sicher??" beim Gebot): mitlesen
        const seite = await s.holeSeite(MARKT_PFAD, { skripte: /\/(mz|main)\.js/ });
        const sk = seite.skripte ?? [];
        if (sk.length) speichereRohseite(db, { art: "skript-mz", url: sk.map((x) => x.url).join(" "), status: null, htmlRoh: sk.map((x) => `/* ==== ${x.url} ==== */\n${x.text}`).join("\n"), htmlDom: null });
        const a = await s.holeText(`/ajax.php?p=transfer&sub=transfer-search&sport=soccer${suchParameter(seite.htmlDom ?? seite.htmlRoh ?? "")}&o=0`);
        speichereRohseite(db, { art: "gebot-suche", url: a.url, status: a.status, htmlRoh: a.text, htmlDom: null });
        const liste = parseTransferSuche(a.text).spieler;
        // Möglichst eine Auktion mit bestehendem Gebot (zeigt die Mindeststeigerung), die noch mindestens 10 Minuten läuft
        const laeuft = (x: (typeof liste)[number]) => {
          const e = endeUtc(x.markt.ende);
          return e !== undefined && new Date(e).getTime() > Date.now() + 10 * 60_000;
        };
        const k = liste.find((x) => laeuft(x) && (x.markt.hoechstgebot ?? 0) > 0) ?? liste.find(laeuft) ?? liste[0];
        if (!k) throw new Error("Marktsuche ohne Spieler.");
        const f = await s.holeText(`/ajax.php?p=transfer&sub=bid-form&pid=${k.pid}&sport=soccer`);
        speichereRohseite(db, { art: "gebotsformular", url: f.url, status: f.status, htmlRoh: f.text, htmlDom: null });
        // Spielerseite (Verkaufshistorie, Marcus 26.10.2026) des ältesten Spielers der Liste: der wurde am ehesten schon
        // verkauft. Nur lesen, Aufbau erst prüfen, dann auswerten.
        const alt = [...liste].sort((x, y) => (y.alter ?? 0) - (x.alter ?? 0))[0] ?? k;
        const sp = await s.holeSeite(`/?p=players&pid=${alt.pid}`);
        speichereRohseite(db, { art: "spieler-fremd", url: sp.url, status: sp.status, htmlRoh: sp.htmlRoh, htmlDom: sp.htmlDom });
        return `Gebotsformular von Spieler ${k.pid} gelesen (Ende ${k.markt.ende ?? "unbekannt"}, Höchstgebot ${k.markt.hoechstgebot ?? "?"} EUR, nicht geboten).`;
      },
      { manuell: true },
    );
    abrufBeenden(db, log, true, meldung);
    return { ok: true, meldung };
  } catch (e) {
    const meldung = `Gebotsformular: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}
