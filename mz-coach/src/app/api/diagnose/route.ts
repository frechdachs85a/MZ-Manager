import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { ladeKombis, scoutEinstufung } from "@/lib/scout";

// Diagnose zum Herunterladen (nur mit App-Login, siehe proxy.ts): Abrufprotokoll, die neuesten Rohantworten,
// die nach dem Hosting erstmals echt geprüft werden müssen (Login-Ergebnis mit Bildschirmfoto und Antwortverlauf,
// Scoutbericht, transfer.js, challenges.js, Marktsuche),
// und je Spieler Scout-Sterne, wörtlicher Text und Einstufung. Enthält KEINE Zugangsdaten, Cookies oder Schlüssel
// (Tabelle einstellung und geheimnisse.json werden nicht gelesen).
const ARTEN = ["login-verlauf", "login-ergebnis", "login-bild", "nicht-eingeloggt", "scoutbericht", "skript-transfer", "skript-challenges", "markt-suche"];

export async function GET() {
  const db = getDb();
  const abrufe = db.prepare("SELECT art, gestartet, beendet, ok, meldung FROM abruf_log ORDER BY id DESC LIMIT 40").all();
  const rohseiten = ARTEN.map((art) => {
    const r = db.prepare("SELECT art, url, abgerufen, status, html_roh AS inhalt FROM rohseite WHERE art = ? ORDER BY id DESC LIMIT 1").get(art);
    return r ?? { art, fehlt: "noch nicht gespeichert" };
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
  const datei = { erstellt: new Date().toISOString(), abrufe, rohseiten, scout };
  return new Response(JSON.stringify(datei, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mz-coach-diagnose-${datei.erstellt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
