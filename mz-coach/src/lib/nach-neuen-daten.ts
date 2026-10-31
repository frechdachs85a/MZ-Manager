import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen } from "@/lib/db/abruf";
import { letzterLauf } from "@/lib/db/spieltag";
import { ligaKontrolle } from "@/lib/mz/abruf/liga";
import { hatVorschlag, reiterUebersicht } from "@/lib/reiter-uebersicht";
import { spieltagLage } from "@/lib/spieltag";

// Regel (Marcus, 31.10.2026): Sobald neue Infos da sind (Kader, Spieltag, Scoutspiele, Ligatabelle), die Taktiken
// kontrollieren: die empfohlene Taktik gegen den nächsten Gegner neu berechnen, die Formation Liga prüfen (geschrieben
// wird nur bei einer Änderung, nur vor dem Anstoß) und alle anderen Reiter prüfen (nur Vorschläge, nichts übernommen).

// Alle Reiter außer Liga prüfen; Ergebnis ins Protokoll "taktik-pruefung"
export function taktikenPruefen(db: Database.Database, anlass?: string): string {
  const log = abrufBeginnen(db, "taktik-pruefung");
  try {
    const karten = reiterUebersicht(db).karten.filter((k) => k.art !== "leer" && k.art !== "liga");
    const mit = karten.filter(hatVorschlag);
    const meldung = `${anlass ? `Nach ${anlass}: ` : ""}${karten.length} Reiter geprüft: ${mit.length ? `Vorschläge für ${mit.map((k) => k.name).join(", ")}` : "keine Änderung nötig"}.`;
    abrufBeenden(db, log, true, meldung);
    return meldung;
  } catch (e) {
    const meldung = `Taktikprüfung: ${e instanceof Error ? e.message : String(e)}`;
    abrufBeenden(db, log, false, meldung);
    return meldung;
  }
}

// Liga nur bis zum Anstoß des nächsten Ligaspiels prüfen
function vorAnstoss(db: Database.Database, jetzt = Date.now()): boolean {
  const lauf = letzterLauf(db, true);
  return !!lauf?.anstoss && Date.parse(lauf.anstoss) > jetzt;
}

// Nach neuen Daten: empfohlene Taktik, Liga, übrige Reiter. Gibt eine Meldung für Knopf und Protokoll zurück.
export async function taktikenNachNeuenDaten(db: Database.Database, anlass: string): Promise<string> {
  const teile: string[] = [];
  try {
    const lage = spieltagLage(db);
    const v = lage.vorschlag;
    if (v) teile.push(`Empfohlene Taktik: ${v.taktik} (${v.quelle}).`);
    // Portfolio-Lücke gegen den nächsten Gegner (nur Hinweis, übernommen wird auf Klick)
    if (lage.luecke) teile.push(`Lücke: gegen „${lage.luecke.klasse}“ ist ${lage.luecke.stil.schluessel} bei den Top 10 bewährt, fehlt dir.`);
  } catch (e) {
    teile.push(`Empfehlung: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (vorAnstoss(db)) teile.push((await ligaKontrolle(db)).meldung);
  teile.push(taktikenPruefen(db, anlass));
  return teile.join(" ");
}
