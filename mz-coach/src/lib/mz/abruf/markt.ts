import "server-only";
import type Database from "better-sqlite3";
import { parse } from "node-html-parser";
import { abrufBeenden, abrufBeginnen, letzteRohseite, letzterAbruf, speichereRohseite } from "@/lib/db/abruf";
import { speichereMarktRahmen, speichereMarktSuche } from "@/lib/db/markt";
import { ladeFreundTeam } from "@/lib/db/freunde";
import { zugangStatus } from "@/lib/mz/zugang";
import { parseTransferSuche, type MarktSpieler } from "@/lib/mz/parser/transfer";
import { ladeKader } from "@/lib/db/kader";
import { schwachstellenMitZugaengen } from "@/lib/zugaenge";
import { startelfAusLetztemSpiel } from "@/lib/db/markt";
import { mitFiltern, suchZiele } from "./markt-ziel";
import { meldungAus, type Ergebnis } from "./kader";
import { mitMzSitzung, MzFehler } from "./sitzung";
import { verkaufLaden } from "./verkauf";
import { rahmenAusGebotsformular } from "@/lib/mz/parser/rahmen";
import { ladeVerkaeufe } from "@/lib/db/verkauf";
import { marktErgebnis } from "@/lib/markt-ergebnis";

// Tägliche Transfermarktsuche (eingeloggt). Ablauf wie das Userscript Mazyar (siehe parser/transfer.ts):
// Suchformular #searchform der Marktseite lesen, mit genau dessen Feldern und Standardwerten
// ajax.php?p=transfer&sub=transfer-search abfragen, 20 Spieler je Seite über den Versatz o.
// Höflich: Seiten nacheinander mit Pause (Drossel), höchstens MAX_SEITEN.
export const MARKT_PFAD = "/?p=transfer";
export const MAX_SEITEN = 25;
const JE_SEITE = 20;
const JE_ZIEL = 100; // Kandidaten je Rolle, dann nächste Rolle (31.10.2026: 40 war zu wenig, Bietomat-Spieler von Marcus fehlten)
const SEITEN_JE_STUFE = 3;
const VERKAEUFE_JE_SUCHE = 6; // Spielerseiten für den letzten Verkauf je Suche

// Felder des Suchformulars als Parameter, wie Mazyar sie bildet: jedes input/select mit Namen,
// Kontrollkästchen als 1/0, Auswahllisten mit der gewählten Option.
export function suchParameter(html: string): string {
  const form = parse(html).querySelector("#searchform");
  if (!form) throw new MzFehler("Marktseite ohne Suchformular (#searchform).");
  const teile: string[] = [];
  for (const el of form.querySelectorAll("input, select")) {
    const name = el.getAttribute("name");
    if (!name) continue;
    const typ = (el.getAttribute("type") ?? "").toLowerCase();
    let wert: string;
    if (el.tagName === "SELECT") {
      const opts = el.querySelectorAll("option");
      const gewaehlt = opts.find((o) => o.hasAttribute("selected")) ?? opts[0];
      wert = gewaehlt?.getAttribute("value") ?? gewaehlt?.text.trim() ?? "";
    } else if (typ === "checkbox") {
      wert = el.hasAttribute("checked") ? "1" : "0";
    } else if (typ === "radio") {
      if (!el.hasAttribute("checked")) continue;
      wert = el.getAttribute("value") ?? "";
    } else if (typ === "submit" || typ === "button") {
      continue;
    } else {
      wert = el.getAttribute("value") ?? "";
    }
    teile.push(`&${encodeURIComponent(name)}=${encodeURIComponent(wert)}`);
  }
  if (teile.length === 0) throw new MzFehler("Suchformular ohne Felder.");
  return teile.join("");
}

// Marktsuche (gezielt je Schwachstelle) abrufen und speichern
export async function marktAbrufen(db: Database.Database, opt = { manuell: false }): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "markt");
  const ziel: string[] = [];
  try {
    const r = await mitMzSitzung(
      db,
      async (s) => {
        // transfer.js enthält buy() (Gebotsfenster). Die Seite lädt sie ohnehin; sie wird zum Auswerten
        // für den Biet-Automaten mitgespeichert.
        const seite = await s.holeSeite(MARKT_PFAD, { skripte: /\/transfer[^/]*\.js/ });
        const html = seite.htmlDom ?? seite.htmlRoh ?? "";
        speichereRohseite(db, { art: "markt", url: seite.url, status: seite.status, htmlRoh: seite.htmlRoh, htmlDom: seite.htmlDom });
        for (const sk of seite.skripte ?? []) {
          speichereRohseite(db, { art: "skript-transfer", url: sk.url, status: null, htmlRoh: sk.text, htmlDom: null });
        }
        const params = suchParameter(html);
        const spieler = new Map<number, MarktSpieler>();
        let treffer = 0;
        let seiten = 0;
        const lies = async (p: string, o: number) => {
          const a = await s.holeText(`/ajax.php?p=transfer&sub=transfer-search&sport=soccer${p}&o=${o}`);
          // Erste Antwort immer roh speichern, damit der Aufbau geprüft werden kann
          if (seiten === 0) speichereRohseite(db, { art: "markt-suche", url: a.url, status: a.status, htmlRoh: a.text, htmlDom: null });
          seiten++;
          return parseTransferSuche(a.text);
        };
        // Gezielt (Marcus, 26.10.2026): je schwächster Rolle der Startelf mit den Filtern von ManagerZone suchen,
        // Hauptskill der Rolle Stufe für Stufe von 10 abwärts, bis genug Kandidaten da sind; sonst wie bisher den Markt durchgehen
        const start = startelfAusLetztemSpiel(db);
        const ziele = start ? suchZiele(schwachstellenMitZugaengen(db, start.elf, ladeKader(db)).liste) : [];
        if (ziele.length) {
          // Seiten gleichmäßig auf die Rollen verteilen
          const jeZielSeiten = Math.floor(MAX_SEITEN / ziele.length);
          for (const z of ziele) {
            const vorher = spieler.size;
            const grenze = seiten + jeZielSeiten;
            for (const stufe of z.stufen) {
              if (seiten >= grenze || spieler.size - vorher >= JE_ZIEL) break;
              const p = mitFiltern(params, z.filter(stufe));
              for (let o = 0; seiten < grenze && spieler.size - vorher < JE_ZIEL && o < SEITEN_JE_STUFE * JE_SEITE; o += JE_SEITE) {
                const suche = await lies(p, o);
                for (const x of suche.spieler) spieler.set(x.pid, x);
                if (o === 0) treffer += suche.treffer;
                if (suche.spieler.length < JE_SEITE || o + JE_SEITE >= suche.treffer) break;
              }
            }
            ziel.push(`${z.text}: ${spieler.size - vorher} Kandidaten`);
          }
        } else {
          for (let o = 0; seiten < MAX_SEITEN; o += JE_SEITE) {
            const suche = await lies(params, o);
            treffer = suche.treffer;
            for (const x of suche.spieler) spieler.set(x.pid, x);
            if (suche.spieler.length < JE_SEITE || o + JE_SEITE >= treffer) break;
          }
        }
        const id = speichereMarktSuche(db, { treffer, seiten, spieler: [...spieler.values()] });
        // Rahmen (Saldo, Ausländer, Arbeitsbewilligungen) selbst aus dem Gebotsfenster eines gefundenen Spielers lesen
        // (Marcus, 31.10.2026: Ausländer über freie Arbeitsbewilligungen waren möglich). Nur lesen, es wird nicht geboten.
        const erster = [...spieler.values()][0];
        if (erster) {
          try {
            const f = await s.holeText(`/ajax.php?p=transfer&sub=bid-form&pid=${erster.pid}&sport=soccer`);
            speichereRohseite(db, { art: "gebotsformular", url: f.url, status: f.status, htmlRoh: f.text, htmlDom: null });
            const rahmen = rahmenAusGebotsformular(f.text);
            if (rahmen) {
              speichereMarktRahmen(db, rahmen);
              ziel.push(`Rahmen aus dem Gebotsfenster: Saldo ${rahmen.kapital} EUR, Ausländer ${rahmen.auslaender}/${rahmen.auslaenderMax}, Arbeitsbewilligungen ${rahmen.bewilligungen}/${rahmen.bewilligungenMax}`);
            } else ziel.push("Rahmen im Gebotsfenster nicht gefunden");
          } catch (e) {
            ziel.push(`Rahmen nicht gelesen: ${meldungAus(e)}`);
          }
        }
        // Letzter Verkauf (Spielerseite, Kasten "Transfers") für die Empfehlung und die nächsten Kandidaten, höchstens
        // VERKAEUFE_JE_SUCHE Seiten; was in den letzten 7 Tagen gelesen wurde, nicht noch einmal
        const e = marktErgebnis(db).ergebnis;
        const bekannt = ladeVerkaeufe(db);
        const frisch = (pid: number) => {
          const v = bekannt.get(pid);
          return v && Date.now() - new Date(v.stand).getTime() < 7 * 24 * 3600_000;
        };
        const fuer = (e ? [e.empfehlung, ...e.weitere] : []).filter((b): b is NonNullable<typeof b> => !!b).map((b) => b.kandidat.pid);
        let verkaeufe = 0;
        for (const pid of fuer.filter((p) => !frisch(p)).slice(0, VERKAEUFE_JE_SUCHE)) {
          if (await verkaufLaden(db, s, pid)) verkaeufe++;
        }
        if (verkaeufe) ziel.push(`letzter Verkauf von ${verkaeufe} Kandidaten gelesen`);
        // Für die automatischen Einladungen: Herausforderungsseite samt challenges.js einmal sichern
        // (enthält challengeButtonAction, also wie eine Einladung abgeschickt wird). Nur lesen.
        const freund = ladeFreundTeam(db);
        if (freund && !letzteRohseite(db, "skript-challenges")) {
          const ch = await s.holeSeite(`/?p=challenges&challenge-tid=${freund.tid}`, { skripte: /\/challenges[^/]*\.js/ });
          speichereRohseite(db, { art: "challenges", url: ch.url, status: ch.status, htmlRoh: ch.htmlRoh, htmlDom: ch.htmlDom });
          for (const sk of ch.skripte ?? []) speichereRohseite(db, { art: "skript-challenges", url: sk.url, status: null, htmlRoh: sk.text, htmlDom: null });
        }
        return { id, treffer, seiten, anzahl: spieler.size };
      },
      opt,
    );
    const meldung = `Transfermarkt: ${r.anzahl} Spieler auf ${r.seiten} Seiten gelesen (laut Suche ${r.treffer} Treffer).${ziel.length ? ` Gezielt: ${ziel.join(" · ")}.` : ""}`;
    abrufBeenden(db, log, true, meldung);
    return { ok: true, meldung };
  } catch (e) {
    const meldung = `Transfermarkt: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}

const berlinTag = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
const berlinStunde = (d: Date) =>
  Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(d));

// Einmal am Tag ab STUNDE Uhr (Berlin), nur mit eingerichtetem Zugang. Ein fehlgeschlagener Versuch
// zählt auch: kein zweiter Versuch am selben Tag (keine Login-Wiederholung, Sperrgefahr).
export const STUNDE = 6;
// Ist die tägliche Marktsuche fällig?
export function marktFaellig(db: Database.Database, jetzt = new Date()): boolean {
  if (!zugangStatus(db).eingerichtet) return false;
  if (berlinStunde(jetzt) < STUNDE) return false;
  const letzter = letzterAbruf(db, "markt");
  return !letzter || berlinTag(new Date(letzter.gestartet)) !== berlinTag(jetzt);
}
