import type Database from "better-sqlite3";
import { ladeAuftraege } from "@/lib/db/gebot";
import { ladeKader } from "@/lib/db/kader";
import { mzWert } from "@/lib/mz/formel";
import { rolle, schwachstellen, type Slot } from "@/lib/mz/analyse/markt";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { TEAM } from "@/lib/wissen/startbasis";

// Zugänge (Marcus, 01.11.2026): Ein gewonnener Transfer kommt etwa 24 Stunden nach Auktionsende in den Kader. Bis dahin
// zählt er für die Schwachstellen schon mit: er übernimmt den Startplatz, den er am stärksten verbessert, und der
// Transfermarkt sucht danach die nächste Schwachstelle. Gewonnen = laut Gebotsübersicht hält FC Toho das letzte Gebot,
// sonst laut Bietomat zuletzt Höchstbietender. Sobald der Spieler im Kader steht, zählt der echte Kader; nach 7 Tagen
// ohne Ankunft fällt er heraus (dann stimmt etwas nicht, siehe Gebote).
export const ZUGANG_MAX_TAGE = 7;

export type Zugang = { spieler: MarktSpieler; ende?: string; preis?: number };

export function zugaenge(db: Database.Database, kader = ladeKader(db), jetzt = Date.now()): Zugang[] {
  const im = new Set(kader.map((s) => s.pid));
  const out: Zugang[] = [];
  for (const a of ladeAuftraege(db)) {
    if (a.status !== "beendet" || !a.spieler || im.has(a.pid)) continue;
    const ende = a.auktionEnde ? Date.parse(a.auktionEnde) : undefined;
    if (ende !== undefined && jetzt - ende > ZUGANG_MAX_TAGE * 86_400_000) continue;
    const gewonnen =
      a.ende?.tid !== undefined
        ? a.ende.tid === TEAM.tid
        : (db.prepare("SELECT 1 FROM gebot_log WHERE pid = ? AND zeit >= ? AND text LIKE '%du warst zuletzt Höchstbietender%' LIMIT 1").get(a.pid, a.erstellt) ?? null) !== null;
    if (gewonnen) out.push({ spieler: a.spieler, ende: a.auktionEnde, preis: a.ende?.preis });
  }
  return out;
}

const alsKader = (m: MarktSpieler): SpielerDaten => ({ pid: m.pid, name: m.name, alter: m.alter, skills: m.skills, marktwert: m.wert });

// Startelf mit Zugängen: jeder Zugang ersetzt (größter Gewinn zuerst) den Startplatz, den er am stärksten verbessert.
// Gibt die neue Startelf, den erweiterten Kader und je Zugang den ersetzten Spieler zurück.
export function elfMitZugaengen(elf: Slot[], kader: SpielerDaten[], neu: MarktSpieler[]) {
  const nachPid = new Map(kader.map((s) => [s.pid, s]));
  const slots = elf.map((s) => ({ ...s }));
  const belegt = new Set<number>();
  const ersetzt: { zugang: string; statt: string; rolle: string; alt: number; neu: number }[] = [];
  const kandidaten = neu
    .flatMap((z) =>
      slots.map((s, i) => {
        const r = rolle(s);
        const a = nachPid.get(s.pid);
        const w1 = a ? mzWert(a.skills, r) : undefined;
        const w2 = mzWert(z.skills, r);
        return { z, i, r, alt: w1?.ok ? w1.wert : 0, neu: w2.ok ? w2.wert : 0, statt: a?.name ?? `pid ${s.pid}` };
      }),
    )
    .filter((k) => k.neu > k.alt)
    .sort((a, b) => b.neu - b.alt - (a.neu - a.alt));
  const vergeben = new Set<number>();
  for (const k of kandidaten) {
    if (belegt.has(k.i) || vergeben.has(k.z.pid)) continue;
    slots[k.i].pid = k.z.pid;
    belegt.add(k.i);
    vergeben.add(k.z.pid);
    ersetzt.push({ zugang: k.z.name, statt: k.statt, rolle: k.r, alt: k.alt, neu: k.neu });
  }
  return { elf: slots, kader: [...kader, ...neu.map(alsKader)], ersetzt };
}

// Schwachstellen mit eingerechneten Zugängen (für Transfermarkt, Zentrale, Suche)
export function schwachstellenMitZugaengen(db: Database.Database, elf: Slot[], kader = ladeKader(db)) {
  const z = zugaenge(db, kader);
  const m = elfMitZugaengen(elf, kader, z.map((x) => x.spieler));
  return { ...schwachstellen(m.elf, m.kader), zugaenge: z, ersetzt: m.ersetzt };
}

