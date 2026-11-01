import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { ladeFreundTeam } from "@/lib/db/freunde";
import { ladeAblehnungen, ladeLetzteSuche, ladeMarktRahmen, startelfAusLetztemSpiel } from "@/lib/db/markt";
import { bewerteMarkt } from "@/lib/mz/analyse/markt";
import { schwachstellenMitZugaengen } from "@/lib/zugaenge";
import { alsSchwachstellen, taktikLuecken } from "@/lib/taktik-luecken";
import { mzWert } from "@/lib/mz/formel";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";

// Bewertung der letzten Marktsuche gegen deine Schwachstellen, mit deinem Rahmen. Gemeinsam für die Seite
// Transfermarkt und den Marktabruf (der danach für die besten Kandidaten den letzten Verkauf holt).
export function marktErgebnis(db: Database.Database) {
  const kader = ladeKader(db);
  const start = startelfAusLetztemSpiel(db);
  const suche = ladeLetzteSuche(db);
  const rahmen = ladeMarktRahmen(db);
  const freund = ladeFreundTeam(db);
  const abgelehnt = ladeAblehnungen(db);
  // Gewonnene Transfers, die noch nicht im Kader sind, zählen schon mit (Marcus, 01.11.2026)
  const schwach = start ? schwachstellenMitZugaengen(db, start.elf, kader) : null;
  // Fehlende Spielertypen für erfolgreiche Top-10-Taktiken als zusätzliche Ziele (Marcus, 01.11.2026)
  const luecken = schwach?.liste.length ? taktikLuecken(db, schwach.kaderMitZugaengen, Math.min(...schwach.liste.map((x) => x.wert))) : [];
  const r = rahmen?.werte;
  // Ohne Rahmen trotzdem bewerten (Marcus 31.10.2026: es gibt sicher Verstärkungen), Grenzen dann als Vorbehalt
  const basis = { abgelehnt: new Set(abgelehnt.map((a) => a.pid)), eigene: new Set([...kader.map((s) => s.pid), ...(schwach?.zugaenge.map((z) => z.spieler.pid) ?? [])]), gesperrteTeams: new Set(freund ? [freund.tid] : []) };
  const ergebnis =
    schwach && suche
      ? bewerteMarkt(
          suche.spieler,
          [...schwach.liste, ...alsSchwachstellen(luecken)],
          r ? { ...basis, kapital: r.kapital, auslaenderFrei: r.auslaenderMax - r.auslaender, bewilligungenFrei: r.bewilligungenMax - r.bewilligungen } : { ...basis, ohneRahmen: true },
        )
      : null;
  return { kader, start, suche, rahmen, freund, abgelehnt, schwach, luecken, r, ergebnis };
}

// Verbesserung eines einzelnen Spielers gegen deine Startelf (Watchlist und Gebote, Marcus 31.10.2026: dort alle Infos)
export function verbesserungFuer(db: Database.Database, s: MarktSpieler): { rolle: string; statt: string; alt: number; neu: number; gewinn: number } | null {
  const start = startelfAusLetztemSpiel(db);
  if (!start) return null;
  const liste = schwachstellenMitZugaengen(db, start.elf).liste;
  let best: { rolle: string; statt: string; alt: number; neu: number; gewinn: number } | null = null;
  for (const x of liste) {
    const w = mzWert(s.skills, x.rolle);
    if (!w.ok) continue;
    const g = Math.round((w.wert - x.wert) * 100) / 100;
    if (!best || g > best.gewinn) best = { rolle: x.rolle, statt: x.spieler.name, alt: x.wert, neu: w.wert, gewinn: g };
  }
  return best;
}
