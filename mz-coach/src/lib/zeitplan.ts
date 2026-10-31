import { getDb } from "@/lib/db";
import { abrufBeenden, abrufBeginnen, letzterAbruf } from "@/lib/db/abruf";
import { letzterLauf } from "@/lib/db/spieltag";
import { aufraeumen, sichereDatenbank } from "@/lib/archiv";
import { marktAbrufen, marktFaellig } from "@/lib/mz/abruf/markt";
import { ligaHinterlegen, ligaKontrolle } from "@/lib/mz/abruf/liga";
import { taktikenNachNeuenDaten, taktikenPruefen } from "@/lib/nach-neuen-daten";
import { kaderAbrufen, kaderFaellig } from "@/lib/mz/abruf/kader";
import { spieltagAbrufen, spieltagFaellig } from "@/lib/mz/abruf/spieltag";
import { topAbrufen, topFaellig } from "@/lib/mz/abruf/top";
import { wertScanAbrufen, wertScanFaellig } from "@/lib/mz/abruf/wertscan";
import type Database from "better-sqlite3";
import { bietomatSperrt } from "@/lib/db/gebot";
import { bietomatTakt } from "@/lib/mz/abruf/bietomat-lauf";

// Prüft alle 15 Minuten, was fällig ist. Abrufe laufen nie parallel (mitMzSitzung).
// 5 Uhr: Kader (Spieler, Jugend, Status, Taktikseite)
// 4 Uhr: Top 10 (Listen wöchentlich, Nachholen täglich), eigene Spiele, Tabelle
// 6 Uhr: Transfermarkt
// 5 Stunden nach jedem Ligaspiel: Spieltag (Spielbericht, nächster Gegner, Taktikvorschlag), sonst täglich der Spielplan
// danach: Aufräumen täglich, Sicherung der Datenbank wöchentlich
const TAKT_MS = 15 * 60 * 1000;

// Formation Liga fällig? Nur vor dem Anstoß des nächsten Ligaspiels. nachKader: direkt nach einem Kaderabruf immer;
// sonst nur, wenn der letzte Versuch fehlschlug und mindestens 60 Minuten her ist.
function ligaFaellig(db: Database.Database, nachKader: boolean, jetzt = new Date()): boolean {
  const lauf = letzterLauf(db, true);
  if (!lauf?.anstoss || Date.parse(lauf.anstoss) <= jetzt.getTime()) return false;
  if (nachKader) return true;
  const l = letzterAbruf(db, "liga");
  return !!l && l.ok === 0 && jetzt.getTime() - Date.parse(l.gestartet) >= 60 * 60_000;
}
const TAG_MS = 24 * 3600_000;
let gestartet = false;
let laeuft = false;

const berlinTag = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);

function letzterOk(db: Database.Database, art: string): string | null {
  return (db.prepare("SELECT max(gestartet) AS z FROM abruf_log WHERE art = ? AND ok = 1").get(art) as { z: string | null }).z;
}

async function wartung(db: Database.Database, jetzt = new Date()) {
  const aufger = letzterOk(db, "aufraeumen");
  if (!aufger || berlinTag(new Date(aufger)) !== berlinTag(jetzt)) {
    const log = abrufBeginnen(db, "aufraeumen");
    const m = aufraeumen(db);
    abrufBeenden(db, log, true, m);
    console.log(`[zeitplan] ${m}`);
  }
  const gesichert = letzterOk(db, "sicherung");
  if (!gesichert || jetzt.getTime() - new Date(gesichert).getTime() > 7 * TAG_MS) {
    const log = abrufBeginnen(db, "sicherung");
    try {
      const m = await sichereDatenbank(db, db.name);
      abrufBeenden(db, log, true, m);
      console.log(`[zeitplan] ${m}`);
    } catch (e) {
      abrufBeenden(db, log, false, e instanceof Error ? e.message : String(e));
    }
  }
}

async function takt() {
  if (laeuft) return;
  laeuft = true;
  try {
    const db = getDb();
    // Bietomat hat Vorrang: dann diesen Takt auslassen, fällige Abrufe kommen im nächsten Takt dran
    const sperre = bietomatSperrt(db);
    if (sperre) {
      console.log(`[zeitplan] ausgesetzt: ${sperre}`);
      return;
    }
    // Kader (Spieler, Jugend, Status, Trainingslager, Taktikseite, Scoutberichte) täglich ab 5 Uhr
    if (kaderFaellig(db)) {
      const r = await kaderAbrufen(db);
      console.log(`[zeitplan] ${r.meldung.slice(0, 300)}`);
      // Im selben Zug die Liga prüfen (Marcus, 31.10.2026): mit dem neuen Kaderstand (Verletzung, Sperre, Trainingslager,
      // Skills) neu berechnen; geschrieben wird nur, wenn sich etwas ändert
      if (r.ok && ligaFaellig(db, true)) {
        const l = await ligaKontrolle(db);
        console.log(`[zeitplan] ${l.meldung.slice(0, 300)}`);
      }
      // Und alle anderen Reiter prüfen (Marcus, 31.10.2026): Ergebnis ins Protokoll, Vorschläge auf der Taktikseite
      if (r.ok) console.log(`[zeitplan] ${taktikenPruefen(db, "Kaderabruf")}`);
    }
    // Liga darf nie leer oder veraltet bleiben: nach einem Fehler stündlich erneut versuchen
    if (ligaFaellig(db, false)) {
      const l = await ligaHinterlegen(db);
      console.log(`[zeitplan] ${l.meldung.slice(0, 300)}`);
    }
    const spieltag = spieltagFaellig(db);
    if (spieltag) {
      const r = await spieltagAbrufen(db, { manuell: false, ziel: spieltag.ziel });
      console.log(`[zeitplan] ${r.meldung.slice(0, 300)}`);
      // Direkt danach die Formation Liga gegen den nächsten Gegner in ManagerZone hinterlegen (Marcus, 26.10.2026)
      if (r.ok) {
        const l = await ligaHinterlegen(db);
        console.log(`[zeitplan] ${l.meldung.slice(0, 300)}`);
        // Mit den neuen Gegnerdaten auch alle anderen Reiter prüfen (Marcus, 31.10.2026)
        console.log(`[zeitplan] ${taktikenPruefen(db, "Spieltag-Analyse")}`);
      }
    }
    if (topFaellig(db)) {
      const r = await topAbrufen(db);
      console.log(`[zeitplan] ${r.meldung.slice(0, 300)}`);
    }
    if (wertScanFaellig(db) && !topFaellig(db)) {
      const r = await wertScanAbrufen(db);
      console.log(`[zeitplan] ${r.meldung.slice(0, 300)}`);
    }
    if (marktFaellig(db)) {
      const r = await marktAbrufen(db);
      console.log(`[zeitplan] ${r.meldung}`);
    }
    await wartung(db);
  } catch (e) {
    console.error("[zeitplan]", e instanceof Error ? e.message : e);
  } finally {
    laeuft = false;
  }
}

// Zeitplan starten (Abrufe alle 15 Minuten, Bietomat alle 20 Sekunden)
export function starteZeitplan() {
  if (gestartet) return;
  gestartet = true;
  console.log("[zeitplan] aktiv: 5 h nach jedem Ligaspiel Spieltag, 4 Uhr Top 10 (Listen wöchentlich) und eigene Spiele, 6 Uhr Transfermarkt, täglich Aufräumen, wöchentlich Sicherung");
  setTimeout(takt, 60_000).unref();
  setInterval(takt, TAKT_MS).unref();
  // Bietomat: alle 20 Sekunden prüfen, ob eine Auktion mit aktivem Auftrag in die heiße Phase kommt
  setInterval(() => void bietomatTakt(getDb()).catch((e) => console.error("[bietomat]", e instanceof Error ? e.message : e)), 20_000).unref();
}
