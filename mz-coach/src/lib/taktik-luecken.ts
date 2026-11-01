import type Database from "better-sqlite3";
import type { Schwachstelle } from "@/lib/mz/analyse/markt";
import { stilDe } from "@/lib/mz/analyse/gegner";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { erzeugeTaktik } from "@/lib/mz/taktik/erzeugen";
import { heuteInBerlin } from "@/lib/format";
import { portfolioAnalyse, type StilEintrag } from "@/lib/portfolio";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

// Fehlende Spielertypen für erfolgreiche Top-10-Taktiken (Marcus, 01.11.2026): Gibt es einen bei den Top 10 bewährten
// Stil, der gegen einen Gegnertyp besser abschneidet als dein bester bewährter Stil dagegen, den du aber nicht als Reiter
// hast? Dann mit deinem Kader (inkl. Zugängen) die beste Elf dafür aufstellen (echte Startaufstellung eines Topteams aus
// einem gewonnenen Spiel, wie beim Portfolio). Ein Platz, den dein bester Spieler dort schwächer besetzt als dein heute
// schwächster Startelf-Platz, ist ein fehlender Spielertyp: zusätzliches Suchziel für den Transfermarkt.

export type TaktikLuecke = {
  stil: StilEintrag;
  klasse: string;
  deinBester?: { schluessel: string; quote: number };
  plaetze: { rolle: Schwachstelle["rolle"]; x: number; y: number; spieler: SpielerDaten; wert: number }[];
};

export const MAX_STILE = 3;

export function taktikLuecken(db: Database.Database, kader: SpielerDaten[], schwelle: number): TaktikLuecke[] {
  const kandidaten = new Map<string, { stil: StilEintrag; klasse: string; deinBester?: { schluessel: string; quote: number } }>();
  for (const k of portfolioAnalyse(db).klassen) {
    const bewaehrt = k.stile.filter((s) => s.bewaehrt);
    const dein = bewaehrt.filter((s) => s.imArchiv.length).sort((a, b) => b.quote - a.quote)[0];
    for (const s of bewaehrt) {
      if (s.imArchiv.length || (dein && s.quote <= dein.quote)) continue;
      const alt = kandidaten.get(s.schluessel);
      if (!alt || s.quote > alt.stil.quote) kandidaten.set(s.schluessel, { stil: s, klasse: k.klasse, deinBester: dein ? { schluessel: dein.schluessel, quote: dein.quote } : undefined });
    }
  }
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const out: TaktikLuecke[] = [];
  for (const c of [...kandidaten.values()].sort((a, b) => b.stil.quote - a.stil.quote)) {
    const m = c.stil.schluessel.match(/^\S+ (\S+)\/(\S+)$/);
    let e;
    try {
      e = erzeugeTaktik({ feld: c.stil.beispiel.feld, torwart: c.stil.beispiel.torwart, tactics: m?.[1], playstyle: m?.[2], kader, spieltag });
    } catch {
      continue;
    }
    const plaetze = e.elf
      .filter((x) => x.wert < schwelle)
      .map((x) => ({ rolle: x.rolle, x: x.platz.x, y: x.platz.y, spieler: x.spieler, wert: x.wert }));
    if (plaetze.length) out.push({ ...c, plaetze });
    if (out.length >= MAX_STILE) break;
  }
  return out;
}

// Als zusätzliche Schwachstellen für die Marktbewertung (mit Vermerk, für welche Taktik)
export function alsSchwachstellen(l: TaktikLuecke[]): Schwachstelle[] {
  return l.flatMap((t) =>
    t.plaetze.map((p) => ({
      slot: { pid: p.spieler.pid, x: p.x, y: p.y, torwart: p.rolle === "TW" },
      rolle: p.rolle,
      spieler: p.spieler,
      wert: p.wert,
      fuer: `${stilDe(t.stil.schluessel)} (Top 10 gegen „${t.klasse}“)`,
    })),
  );
}
