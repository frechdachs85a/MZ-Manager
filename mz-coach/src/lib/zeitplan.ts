import { getDb } from "@/lib/db";
import { abrufBeenden, abrufBeginnen } from "@/lib/db/abruf";
import { aufraeumen, sichereDatenbank } from "@/lib/archiv";
import { marktAbrufen, marktFaellig } from "@/lib/mz/abruf/markt";
import { topAbrufen, topFaellig } from "@/lib/mz/abruf/top";
import type Database from "better-sqlite3";

// Prüft alle 15 Minuten, was fällig ist. Abrufe laufen nie parallel (mitMzSitzung).
// 4 Uhr: Top 10 (Listen wöchentlich, Nachholen täglich), eigene Spiele, Tabelle
// 6 Uhr: Transfermarkt
// danach: Aufräumen täglich, Sicherung der Datenbank wöchentlich
const TAKT_MS = 15 * 60 * 1000;
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
    if (topFaellig(db)) {
      const r = await topAbrufen(db);
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

export function starteZeitplan() {
  if (gestartet) return;
  gestartet = true;
  console.log("[zeitplan] aktiv: 4 Uhr Top 10 (Listen wöchentlich) und eigene Spiele, 6 Uhr Transfermarkt, täglich Aufräumen, wöchentlich Sicherung");
  setTimeout(takt, 60_000).unref();
  setInterval(takt, TAKT_MS).unref();
}
