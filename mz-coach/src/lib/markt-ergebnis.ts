import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { ladeFreundTeam } from "@/lib/db/freunde";
import { ladeAblehnungen, ladeLetzteSuche, ladeMarktRahmen, startelfAusLetztemSpiel } from "@/lib/db/markt";
import { bewerteMarkt, schwachstellen } from "@/lib/mz/analyse/markt";

// Bewertung der letzten Marktsuche gegen deine Schwachstellen, mit deinem Rahmen. Gemeinsam für die Seite
// Transfermarkt und den Marktabruf (der danach für die besten Kandidaten den letzten Verkauf holt).
export function marktErgebnis(db: Database.Database) {
  const kader = ladeKader(db);
  const start = startelfAusLetztemSpiel(db);
  const suche = ladeLetzteSuche(db);
  const rahmen = ladeMarktRahmen(db);
  const freund = ladeFreundTeam(db);
  const abgelehnt = ladeAblehnungen(db);
  const schwach = start ? schwachstellen(start.elf, kader) : null;
  const r = rahmen?.werte;
  const ergebnis =
    schwach && suche && r
      ? bewerteMarkt(suche.spieler, schwach.liste, {
          kapital: r.kapital,
          auslaenderFrei: r.auslaenderMax - r.auslaender,
          bewilligungenFrei: r.bewilligungenMax - r.bewilligungen,
          abgelehnt: new Set(abgelehnt.map((a) => a.pid)),
          eigene: new Set(kader.map((s) => s.pid)),
          gesperrteTeams: new Set(freund ? [freund.tid] : []),
        })
      : null;
  return { kader, start, suche, rahmen, freund, abgelehnt, schwach, r, ergebnis };
}
