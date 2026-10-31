import type Database from "better-sqlite3";
import { ladeAuftraege, ladeProtokoll } from "@/lib/db/gebot";
import { checkKurz, taktikCheck } from "@/lib/taktik-check";
import { parse } from "node-html-parser";
import { spieltagLage } from "@/lib/spieltag";
import { quotenJeBereich } from "@/lib/db/wertspiel";
import { ladeKader } from "@/lib/db/kader";
import { schwaerzen } from "@/lib/schwaerzen";
import { ladeKombis, scoutEinstufung } from "@/lib/scout";

// Diagnose: Abrufprotokoll, die neuesten Rohantworten, die nach dem Hosting erstmals echt geprüft werden müssen
// (Login-Ergebnis mit Bildschirmfoto und Antwortverlauf, Scoutbericht, transfer.js, challenges.js, Marktsuche), und
// je Spieler Scout-Sterne, wörtlicher Text und Einstufung. Enthält KEINE Zugangsdaten, Cookies oder Schlüssel
// (Tabelle einstellung und geheimnisse.json werden nicht gelesen).
export const ARTEN = ["login-verlauf", "login-ergebnis", "login-bild", "nicht-eingeloggt", "unbekannt", "spielplan", "scoutbericht", "skript-transfer", "skript-challenges", "markt-suche", "kader-fremd", "weltliga", "gebotsformular", "gebot-suche", "weltliga-tabelle", "skript-taktik", "liga-xml", "skript-mz", "gebot-antwort", "spieler-fremd"];

// Diagnose für den Fernzugriff (ohne Zugangsdaten)
export function diagnose(db: Database.Database) {
  const abrufe = db.prepare("SELECT art, gestartet, beendet, ok, meldung FROM abruf_log ORDER BY id DESC LIMIT 40").all();
  // Unbekannte Seiten: die letzten drei (verschiedene Seiten), sonst je Art die neueste
  const unbekannte = db.prepare("SELECT id FROM rohseite WHERE art = 'unbekannt' ORDER BY id DESC LIMIT 3").all() as { id: number }[];
  const rohseiten = ARTEN.flatMap((art): { art: string; id?: number }[] => (art === "unbekannt" && unbekannte.length > 1 ? unbekannte.map((u) => ({ art, id: u.id })) : [{ art, id: undefined }])).map(({ art, id }) => {
    const r = (id !== undefined
      ? db.prepare("SELECT art, url, abgerufen, status, html_roh AS inhalt FROM rohseite WHERE id = ?").get(id)
      : // Fremde Spielerseite: das DOM nach den Skripten (Verkaufshistorie wird eventuell nachgeladen)
        db.prepare(`SELECT art, url, abgerufen, status, ${art === "spieler-fremd" ? "coalesce(html_dom, html_roh)" : "html_roh"} AS inhalt FROM rohseite WHERE art = ? ORDER BY id DESC LIMIT 1`).get(art)) as
      | { art: string; url: string; abgerufen: string; status: number | null; inhalt: string | null }
      | undefined;
    if (!r) return { art, fehlt: "noch nicht gespeichert" };
    // Zusätzlich schwärzen (auch für Einträge, die vor dem Schwärzen gespeichert wurden); das Bild bleibt unverändert
    return { ...r, url: schwaerzen(r.url), inhalt: art === "login-bild" || !r.inhalt ? r.inhalt : schwaerzen(r.inhalt) };
  });
  // Suchformular der Marktseite (nur #searchform, ohne den Rest der Seite): Belegung der Filterfelder s0..s12 usw.
  const markt = db.prepare("SELECT abgerufen, coalesce(html_dom, html_roh) AS html FROM rohseite WHERE art = 'markt' ORDER BY id DESC LIMIT 1").get() as
    | { abgerufen: string; html: string | null }
    | undefined;
  const formular = markt?.html ? parse(markt.html).querySelector("#searchform")?.outerHTML : undefined;
  const suchformular = markt ? { abgerufen: markt.abgerufen, inhalt: formular ? schwaerzen(formular) : null } : { fehlt: "noch nicht gespeichert" };
  const kombis = ladeKombis(db);
  const scout = ladeKader(db).map((s) => ({
    pid: s.pid,
    name: s.name,
    nr: s.nr,
    loyal: !!s.loyal,
    sterne: s.scoutSterne,
    training: s.scoutTraining,
    markierung: s.scoutMarkierung,
    textSterne: s.scoutTextSterne,
    textStand: s.scoutTextStand,
    text: s.scoutText,
    einstufung: scoutEinstufung(s, kombis),
  }));
  const zahl = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const bestand = {
    spieler: zahl("SELECT COUNT(*) AS n FROM spieler WHERE aktiv = 1"),
    spiele: zahl("SELECT COUNT(*) AS n FROM spiel"),
    topSpiele: zahl("SELECT COUNT(*) AS n FROM top_spiel"),
    marktSuchen: zahl("SELECT COUNT(*) AS n FROM markt_suche"),
    wertSpiele: zahl("SELECT COUNT(*) AS n FROM wert_spiel"),
    verkaeufe: zahl("SELECT COUNT(*) AS n FROM spieler_verkauf"),
    marktRahmen: zahl("SELECT COUNT(*) AS n FROM einstellung WHERE schluessel = 'markt_rahmen'"),
    auftraege: zahl("SELECT COUNT(*) AS n FROM gebot_auftrag"),
  };
  // Spieltag-Automatik: die letzten Läufe ohne Spielplan-JSON
  const spieltag = db
    .prepare("SELECT id, gestartet, beendet, ok, letztes_mid, naechstes_mid, gegner_tid, gegner_name, anstoss, heim, meldung FROM spieltag_lauf ORDER BY id DESC LIMIT 10")
    .all();
  // Ergebnis der Spieltag-Analyse (zum Abgleich mit ManagerZone): Vorschlag, Kurzfassung, Kaderwerte
  let analyse: unknown = null;
  try {
    const l = spieltagLage(db);
    analyse = {
      vorschlag: l.vorschlag,
      anpassungen: l.anpassungen,
      taktikCode: l.taktikCode ? { art: l.taktikCode.art, geaendert: l.taktikCode.geaendert } : null,
      kurzfassung: l.kurzfassung,
      quoten: { elf: quotenJeBereich(db, "elf"), feld: quotenJeBereich(db, "feld") },
      verlauf: l.verlauf ? { fenster: l.verlauf.fenster, gewichtet: l.verlauf.gewichtet, fehlend: l.verlauf.fehlend, quelleEigen: l.verlauf.quelleEigen } : null,
      elfWerte: l.elfWerte,
      taktikCheck: taktikCheck(db).map((c) => ({ reiter: c.reiter, ok: c.ok, gewinn: c.gewinn, punkte: checkKurz(c), fehler: c.fehler })),
      liga: l.liga ? { reiter: l.liga.reiter, kurz: l.liga.kurz, bank: l.liga.bank, feld: l.liga.feld.map((p) => `${p.label} ${p.x}/${p.y}`), hinweise: l.liga.hinweise } : null,
      ligaStatus: l.ligaStatus,
      formationen: l.gegner?.analyse?.spiele.map((x) => ({ mid: x.mid, datum: x.datum, formation: x.formation.text })),
      kaderwert: l.kaderwert ? { eigen: l.kaderwert.eigen?.summe, gegner: l.kaderwert.gegner?.summe } : null,
      belege: l.belege,
    };
  } catch (e) {
    analyse = { fehler: e instanceof Error ? e.message : String(e) };
  }
  // Bietomat: Aufträge (ohne Spielerdaten) und die letzten Protokolleinträge, um Läufe aus der Ferne zu prüfen
  const bietomat = {
    auftraege: ladeAuftraege(db).map((x) => ({ pid: x.pid, name: x.name, maximum: x.maximum, auktionEnde: x.auktionEnde, status: x.status, geaendert: x.geaendert })),
    protokoll: ladeProtokoll(db, undefined, 40),
  };
  return { bietomat, analyse, erstellt: new Date().toISOString(), version: process.env.GIT_COMMIT ?? "unbekannt", bestand, abrufe, spieltag, suchformular, rohseiten, scout };
}
