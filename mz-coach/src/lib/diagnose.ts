import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { schwaerzen } from "@/lib/schwaerzen";
import { ladeKombis, scoutEinstufung } from "@/lib/scout";

// Diagnose: Abrufprotokoll, die neuesten Rohantworten, die nach dem Hosting erstmals echt geprüft werden müssen
// (Login-Ergebnis mit Bildschirmfoto und Antwortverlauf, Scoutbericht, transfer.js, challenges.js, Marktsuche), und
// je Spieler Scout-Sterne, wörtlicher Text und Einstufung. Enthält KEINE Zugangsdaten, Cookies oder Schlüssel
// (Tabelle einstellung und geheimnisse.json werden nicht gelesen).
export const ARTEN = ["login-verlauf", "login-ergebnis", "login-bild", "nicht-eingeloggt", "unbekannt", "spielplan", "scoutbericht", "skript-transfer", "skript-challenges", "markt-suche"];

export function diagnose(db: Database.Database) {
  const abrufe = db.prepare("SELECT art, gestartet, beendet, ok, meldung FROM abruf_log ORDER BY id DESC LIMIT 40").all();
  // Unbekannte Seiten: die letzten drei (verschiedene Seiten), sonst je Art die neueste
  const unbekannte = db.prepare("SELECT id FROM rohseite WHERE art = 'unbekannt' ORDER BY id DESC LIMIT 3").all() as { id: number }[];
  const rohseiten = ARTEN.flatMap((art): { art: string; id?: number }[] => (art === "unbekannt" && unbekannte.length > 1 ? unbekannte.map((u) => ({ art, id: u.id })) : [{ art, id: undefined }])).map(({ art, id }) => {
    const r = (id !== undefined
      ? db.prepare("SELECT art, url, abgerufen, status, html_roh AS inhalt FROM rohseite WHERE id = ?").get(id)
      : db.prepare("SELECT art, url, abgerufen, status, html_roh AS inhalt FROM rohseite WHERE art = ? ORDER BY id DESC LIMIT 1").get(art)) as
      | { art: string; url: string; abgerufen: string; status: number | null; inhalt: string | null }
      | undefined;
    if (!r) return { art, fehlt: "noch nicht gespeichert" };
    // Zusätzlich schwärzen (auch für Einträge, die vor dem Schwärzen gespeichert wurden); das Bild bleibt unverändert
    return { ...r, url: schwaerzen(r.url), inhalt: art === "login-bild" || !r.inhalt ? r.inhalt : schwaerzen(r.inhalt) };
  });
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
  };
  return { erstellt: new Date().toISOString(), version: process.env.GIT_COMMIT ?? "unbekannt", bestand, abrufe, rohseiten, scout };
}
