import type Database from "better-sqlite3";
import type { Schwachstelle } from "@/lib/mz/analyse/markt";
import { stilDe } from "@/lib/mz/analyse/gegner";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { erzeugeTaktik } from "@/lib/mz/taktik/erzeugen";
import { heuteInBerlin } from "@/lib/format";
import { portfolioAnalyse, type StilEintrag } from "@/lib/portfolio";
import { JUGEND } from "@/lib/portfolio-plan";
import { FREUND } from "@/lib/freund-check";
import { istAltersreiter, ladeEditorReiter } from "@/lib/db/taktik";
import { archivLaden } from "@/lib/taktik-archiv";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";
import { ligaspieltag } from "@/lib/db/spieltag";

// Fehlende Spielertypen für erfolgreiche Top-10-Taktiken (Marcus, 01.11.2026): Gibt es einen bei den Top 10 bewährten
// Stil, der gegen einen Gegnertyp besser abschneidet als dein bester bewährter Stil dagegen, den du aber nicht als Reiter
// hast? Dann mit deinem Kader (inkl. Zugängen) die beste Elf dafür aufstellen (echte Startaufstellung eines Topteams aus
// einem gewonnenen Spiel, wie beim Portfolio). Ein Platz, den dein bester Spieler dort schwächer besetzt als dein heute
// schwächster Startelf-Platz, ist ein fehlender Spielertyp: zusätzliches Suchziel für den Transfermarkt.

// art "top10": bewährter Top-10-Stil, den du nicht hast; art "reiter": einer deiner Reiter (ohne Liga, freund, U18/Jugend;
// Marcus 01.11.2026: z. B. zu viele Abwehrspieler verkauft, dann fehlen sie für eine Fünferkette)
export type TaktikLuecke = {
  art: "top10" | "reiter";
  name: string; // Stil-Schlüssel oder Reitername
  titel: string; // Anzeige
  stil?: StilEintrag;
  klasse?: string;
  deinBester?: { schluessel: string; quote: number };
  plaetze: { rolle: Schwachstelle["rolle"]; x: number; y: number; spieler: SpielerDaten; wert: number }[];
};

export const MAX_STILE = 3;

export function taktikLuecken(db: Database.Database, kaderEcht: SpielerDaten[], schwelle: number): TaktikLuecke[] {
  // Ob dir ein Spielertyp fehlt, hängt nicht am Trainingslager oder einer Verletzung: alle als einsetzbar rechnen
  const kader = kaderEcht.map((s) => ({ ...s, status: { ...s.status, trainingslager: false, verletzt: false, gesperrt: false, aufstellbar: true } }));
  const spieltag = ligaspieltag(db);
  const besetzen = (feld: { x: number; y: number }[], torwart: { x: number; y: number } | undefined, tactics?: string, playstyle?: string) => {
    try {
      return erzeugeTaktik({ feld, torwart, tactics, playstyle, kader, spieltag })
        .elf.filter((x) => x.wert < schwelle)
        .map((x) => ({ rolle: x.rolle, x: x.platz.x, y: x.platz.y, spieler: kaderEcht.find((k) => k.pid === x.spieler.pid) ?? x.spieler, wert: x.wert }));
    } catch {
      return null;
    }
  };
  const out: TaktikLuecke[] = [];

  // 1. Deine Reiter (ohne Liga, freund und Altersreiter), nur die im Editor
  const editor = ladeEditorReiter(db);
  for (const a of archivLaden(db)) {
    if (!a.taktik || /^liga$/i.test(a.reiter) || FREUND.test(a.reiter) || JUGEND.test(a.reiter)) continue;
    const e = editor?.reiter.find((r) => r.name.toLowerCase() === a.reiter.toLowerCase());
    if (editor && (!e || istAltersreiter(e))) continue;
    const feld = a.taktik.pos.filter((p) => p.pos === "normal").map((p) => p.start);
    const tw = a.taktik.pos.find((p) => p.pos === "goalie")?.start;
    const plaetze = besetzen(feld, tw, a.taktik.team.tactics, a.taktik.team.playstyle);
    if (plaetze?.length) out.push({ art: "reiter", name: a.reiter, titel: `deinen Reiter ${a.reiter}`, plaetze });
  }

  // 2. Bewährte Top-10-Stile, die du nicht hast und die besser sind als dein bester bewährter Stil gegen diesen Typ
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
  let top = 0;
  for (const c of [...kandidaten.values()].sort((a, b) => b.stil.quote - a.stil.quote)) {
    if (top >= MAX_STILE) break;
    const m = c.stil.schluessel.match(/^\S+ (\S+)\/(\S+)$/);
    const plaetze = besetzen(c.stil.beispiel.feld, c.stil.beispiel.torwart, m?.[1], m?.[2]);
    if (plaetze?.length) {
      out.push({ art: "top10", name: c.stil.schluessel, titel: `${stilDe(c.stil.schluessel)} (Top 10 gegen „${c.klasse}“)`, ...c, plaetze });
      top++;
    }
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
      fuer: t.titel,
    })),
  );
}
