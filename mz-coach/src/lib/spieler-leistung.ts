import type Database from "better-sqlite3";
import { rolle } from "@/lib/mz/analyse/markt";
import type { Position } from "@/lib/mz/formel";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { TEAM } from "@/lib/wissen/startbasis";

// Leistung je Spieler und Rolle aus gespeicherten Spielen (Marcus, 01.11.2026: Wechselzeit und Aufstellung mit Daten statt
// aus einem einzelnen Spiel entscheiden, z. B. Hyuga gegen Ishizaki als Eckstürmer). Quellen: eigene Ligaspiele und
// Scoutspiele mit Stats-XML. Rolle = Startplatz im Editor (wie überall: Abwehr, Flügel außen, Sturm, Mittelfeld);
// Eingewechselte bekommen die Rolle des Spielers, für den sie kommen. Minuten: Start 0 bzw. Einwechslung, Ende 90 bzw.
// Auswechslung oder Rote Karte. Die Werte der Stats-XML gelten für die Zeit, die er auf dem Platz war.
export type Leistung = {
  rolle: Position;
  spiele: number;
  minuten: number;
  tore: number;
  vorlagen: number;
  schuesseAufsTor: number;
  zkGewonnen: number;
  zkVerloren: number;
  paesse: number; // angekommene Pässe
  quellen: { liga: number; scout: number };
};

// Mindestspielzeit je Rolle, ab der ein Spieler bewertet und verglichen wird: etwa zwei volle Spiele (Festlegung, kein
// Spielwert; bei 90 würde ein einzelnes Spiel zu viel entscheiden, Marcus 01.11.2026: „Mindestmaß an Spielzeit festlegen“)
export const MIN_MINUTEN = 180;

const zahl = (x?: string) => Number(x ?? 0) || 0;

function spieleLaden(db: Database.Database): { spiel: StatsSpiel; quelle: "liga" | "scout" }[] {
  const liga = (db.prepare("SELECT auswertung_json AS j FROM spiel WHERE auswertung_json IS NOT NULL").all() as { j: string }[])
    .map((r) => JSON.parse(r.j) as StatsSpiel)
    .filter((s) => s.typ === "1" && s.teams.some((t) => t.id === TEAM.tid))
    .map((spiel) => ({ spiel, quelle: "liga" as const }));
  const scout = (db.prepare("SELECT auswertung_json AS j FROM scout_spiel").all() as { j: string }[]).map((r) => ({ spiel: JSON.parse(r.j) as StatsSpiel, quelle: "scout" as const }));
  return [...liga, ...scout];
}

// Je pid die Leistung je Rolle (meiste Minuten zuerst)
export function leistungJeRolle(db: Database.Database): Map<number, Leistung[]> {
  const je = new Map<number, Map<Position, Leistung>>();
  for (const { spiel, quelle } of spieleLaden(db)) {
    const eigene = spiel.spieler.filter((p) => p.teamId === TEAM.tid);
    const nachPid = new Map(eigene.map((p) => [p.id, p]));
    const raus = new Map(spiel.wechsel.filter((w) => w.teamId === TEAM.tid).map((w) => [w.raus, w.minute]));
    const rein = new Map(spiel.wechsel.filter((w) => w.teamId === TEAM.tid).map((w) => [w.rein, w]));
    const rot = new Map(spiel.karten.filter((k) => k.teamId === TEAM.tid && k.art === "red").map((k) => [k.spieler, k.minute]));
    for (const p of eigene) {
      let r: Position | undefined;
      let start = 0;
      if (p.origin && p.editor) r = p.torwart ? "TW" : rolle({ pid: p.id, x: p.editor.x, y: p.editor.y, torwart: false });
      else {
        const w = rein.get(p.id);
        if (!w) continue; // nicht eingesetzt
        const fuer = nachPid.get(w.raus);
        if (!fuer?.editor) continue;
        r = fuer.torwart ? "TW" : rolle({ pid: fuer.id, x: fuer.editor.x, y: fuer.editor.y, torwart: false });
        start = w.minute;
      }
      const ende = Math.min(raus.get(p.id) ?? 90, rot.get(p.id) ?? 90, 90);
      const min = Math.max(0, ende - start);
      if (!min || !r) continue;
      const m = je.get(p.id) ?? new Map<Position, Leistung>();
      const l = m.get(r) ?? { rolle: r, spiele: 0, minuten: 0, tore: 0, vorlagen: 0, schuesseAufsTor: 0, zkGewonnen: 0, zkVerloren: 0, paesse: 0, quellen: { liga: 0, scout: 0 } };
      l.spiele++;
      l.minuten += min;
      l.tore += spiel.tore.filter((t) => t.teamId === TEAM.tid && t.schuetze === p.id).length;
      l.vorlagen += spiel.tore.filter((t) => t.teamId === TEAM.tid && t.vorlage === p.id).length;
      l.schuesseAufsTor += zahl(p.statistik.shotsOnGoal);
      l.zkGewonnen += zahl(p.statistik.tacklesWon);
      l.zkVerloren += zahl(p.statistik.tacklesLost);
      l.paesse += zahl(p.statistik.goodPasses);
      l.quellen[quelle]++;
      m.set(r, l);
      je.set(p.id, m);
    }
  }
  return new Map([...je.entries()].map(([pid, m]) => [pid, [...m.values()].sort((a, b) => b.minuten - a.minuten)]));
}

// Pro 90 Minuten
export const je90 = (n: number, minuten: number) => (minuten ? Math.round((n / minuten) * 90 * 100) / 100 : 0);

export type ImVisier = { pid: number; name: string; rolle: Position; minuten: number; besser: string[] };

// Bankspieler (nicht in der Startelf des letzten Spiels), die in ihrer Rolle bei Toren, Vorlagen oder Schüssen aufs Tor
// je 90 Minuten besser sind als jeder bewertbare Startspieler in dieser Rolle. Nur bewertbare Spieler (MIN_MINUTEN).
export function imVisier(leistung: Map<number, Leistung[]>, startelf: Set<number>, namen: Map<number, string>): ImVisier[] {
  const werte = [
    { k: "tore" as const, text: "Tore" },
    { k: "vorlagen" as const, text: "Vorlagen" },
    { k: "schuesseAufsTor" as const, text: "Schüsse aufs Tor" },
  ];
  const zeilen = [...leistung.entries()].flatMap(([pid, l]) => l.filter((x) => x.minuten >= MIN_MINUTEN).map((x) => ({ pid, l: x })));
  const out: ImVisier[] = [];
  for (const z of zeilen) {
    if (startelf.has(z.pid)) continue;
    const stamm = zeilen.filter((x) => startelf.has(x.pid) && x.l.rolle === z.l.rolle);
    if (!stamm.length) continue;
    const besser: string[] = [];
    for (const w of werte) {
      const meins = je90(z.l[w.k], z.l.minuten);
      const best = Math.max(...stamm.map((x) => je90(x.l[w.k], x.l.minuten)));
      if (meins > best && meins > 0) besser.push(`${w.text} ${meins.toFixed(2).replace(".", ",")} je 90 (bester Startspieler ${best.toFixed(2).replace(".", ",")})`);
    }
    if (besser.length) out.push({ pid: z.pid, name: namen.get(z.pid) ?? `pid ${z.pid}`, rolle: z.l.rolle, minuten: z.l.minuten, besser });
  }
  return out.sort((a, b) => b.besser.length - a.besser.length || b.minuten - a.minuten);
}
