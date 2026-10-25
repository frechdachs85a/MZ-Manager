import type { StatsSpiel } from "@/lib/mz/parser/stats";
import type { Taktik, TaktikRegel } from "@/lib/mz/taktik/xml";

// Aufstellung im Spielverlauf (Vorgabe Marcus, 25.10.2026), ohne die binäre 2D-Datei:
// - Eigenes Team: Start, Alternative 1 und 2 und alle Regeln kommen exakt aus dem Taktik-Export.
//   Verknüpft mit der XML: Wechsel (reason, minute, Spieler-IDs), Tactic-Einträge, Tore und Karten.
// - Gegner: Start aus origin; ein Eingewechselter übernimmt den Platz des Ausgewechselten (abgeleitet).
//   Formationswechsel stehen nicht in der XML und sind beim Gegner nicht erkennbar.

export type Quelle = "xml" | "export" | "abgeleitet";
export type Platz = { slot: number; pid: number; name: string; x: number; y: number; torwart: boolean; quelle: Quelle };
export type Phase = { minute: number; stand: string; text: string; quelle: Quelle; aufstellung: Platz[] };

const ALT = ["Startaufstellung", "Alternative 1", "Alternative 2"];

// Eigene Tordifferenz zu jeder Minute aus den Toren der XML
function differenzAb(spiel: StatsSpiel, tid: number) {
  const heim = spiel.teams.find((t) => t.id === tid)?.heim ?? true;
  const tore = [...spiel.tore].sort((a, b) => a.minute - b.minute);
  return (minute: number) => {
    let d = 0;
    for (const t of tore) if (t.minute <= minute) d += t.teamId === tid ? 1 : -1;
    return { d, heim };
  };
}

// Frühste Minute, ab der alle geprüften Bedingungen einer Regel erfüllt sind (oder null)
export function regelErfuellt(r: TaktikRegel, spiel: StatsSpiel, tid: number): number | null {
  const diff = differenzAb(spiel, tid);
  const ab = r.check_time === "true" ? Number(r.time) : 0;
  const rotEigen = spiel.karten.filter((k) => k.teamId === tid && /red/i.test(k.art)).map((k) => k.minute);
  const kandidaten = [ab, ...spiel.tore.map((t) => t.minute), ...rotEigen].filter((m) => m >= ab).sort((a, b) => a - b);
  const ende = Math.max(90, ...spiel.tore.map((t) => t.minute), ...spiel.karten.map((k) => k.minute));
  for (const m of kandidaten) {
    if (m > ende) break;
    const { d } = diff(m);
    const g = Number(r.goals || 1);
    if (r.check_goal_condition === "true") {
      const ok = r.goal_condition === "tie" ? d === 0 : r.goal_condition === "down_by_at_least" ? d <= -g : r.goal_condition === "ahead_by_at_least" ? d >= g : false;
      if (!ok) continue;
    }
    if (r.check_player_event === "true") {
      // Nur "sent_off" ist aus der XML (Karte red) belegbar; gelbe Karten sind nicht zuverlässig zuzuordnen
      if (r.player_event !== "sent_off" || !rotEigen.some((x) => x <= m)) continue;
    }
    return m;
  }
  return null;
}

const regelText = (r: TaktikRegel) => {
  const b: string[] = [];
  if (r.check_time === "true") b.push(`ab ${r.time}.`);
  if (r.check_goal_condition === "true") b.push(r.goal_condition === "tie" ? "bei Gleichstand" : r.goal_condition === "down_by_at_least" ? `bei ${r.goals}+ Toren Rückstand` : `bei ${r.goals}+ Toren Führung`);
  if (r.check_player_event === "true") b.push(r.player_event === "sent_off" ? "bei Rot" : `bei ${r.player_event}`);
  return b.join(", ") || "ohne Bedingung";
};

export function eigenerVerlauf(spiel: StatsSpiel, taktik: Taktik, tid: number): { phasen: Phase[]; hinweise: string[] } {
  const name = new Map(spiel.spieler.map((p) => [p.id, p.name]));
  const hinweise: string[] = [];
  // Plätze = Pos-Einträge des Exports; Koordinaten je Aufstellung exakt aus x/y, x1/y1, x2/y2
  const slots = taktik.pos.map((p, i) => ({ i, pos: p }));
  const besetzt = new Map<number, number>(slots.map((s) => [s.i, s.pos.pid])); // slot -> pid
  let k: 0 | 1 | 2 = 0;
  const startPids = new Set(spiel.spieler.filter((p) => p.teamId === tid && p.editor).map((p) => p.id));
  const fremd = taktik.pos.filter((p) => !startPids.has(p.pid));
  if (fremd.length) hinweise.push(`${fremd.length} Spieler des Exports standen in diesem Spiel nicht in der Startelf: der Export passt nicht genau zu diesem Spiel.`);

  const bild = (quelle: Quelle): Platz[] =>
    slots.flatMap(({ i, pos }) => {
      const pid = besetzt.get(i);
      if (pid === undefined) return [];
      const p = k === 0 ? pos.start : k === 1 ? pos.alt1 ?? pos.start : pos.alt2 ?? pos.start;
      return [{ slot: i, pid, name: name.get(pid) ?? `pid ${pid}`, x: p.x, y: p.y, torwart: pos.pos === "goalie", quelle: pid === pos.pid ? quelle : "abgeleitet" }];
    });

  const phasen: Phase[] = [{ minute: 0, stand: "0:0", text: `${ALT[0]} laut Export`, quelle: "export", aufstellung: bild("export") }];

  type Ev = { minute: number; stand: string; tun: () => string; quelle: Quelle };
  const evs: Ev[] = [];

  // Wechsel: Regel über Spieler-IDs exakt zuordnen; Eingewechselter auf den Platz des Ausgewechselten
  for (const w of spiel.wechsel.filter((x) => x.teamId === tid)) {
    const regel = taktik.regeln.find((r) => Number(r.in_player_id) === w.rein && Number(r.out_player) === w.raus);
    const extra = Object.entries(w.attrs).filter(([a]) => !["time", "clock", "frame", "playerId", "teamId", "substitutedId", "reason", "minute"].includes(a));
    evs.push({
      minute: w.minute,
      stand: w.stand,
      quelle: "xml",
      tun: () => {
        const slot = [...besetzt.entries()].find(([, pid]) => pid === w.raus)?.[0];
        if (slot !== undefined) besetzt.set(slot, w.rein);
        const grund = w.grund === "preset" ? `Regel${regel ? ` (${regelText(regel)})` : w.regelMinute !== undefined ? ` ab ${w.regelMinute}., im Export nicht gefunden` : ""}` : w.grund === "injury" ? "Verletzung" : w.grund;
        return `Wechsel: ${name.get(w.rein) ?? w.rein} für ${name.get(w.raus) ?? w.raus} (${grund})${extra.length ? ` [${extra.map(([a, v]) => `${a}=${v}`).join(", ")}]` : ""}`;
      },
    });
  }
  // Rote Karte: Spieler verlässt das Feld
  for (const kt of spiel.karten.filter((x) => x.teamId === tid && /red/i.test(x.art))) {
    evs.push({
      minute: kt.minute,
      stand: kt.stand,
      quelle: "xml",
      tun: () => {
        const slot = [...besetzt.entries()].find(([, pid]) => pid === kt.spieler)?.[0];
        if (slot !== undefined) besetzt.delete(slot);
        return `Rote Karte: ${name.get(kt.spieler) ?? kt.spieler}`;
      },
    });
  }
  // Regeln ohne Wechsel: Einstellungen und Formation. Belegt, wenn die XML einen passenden Tactic-Eintrag hat;
  // reine Formationsregeln stehen nie in der XML und sind nur aus Bedingung und Spielstand abgeleitet.
  const tacticXml = spiel.taktikwechsel.filter((t) => t.teamId === tid);
  for (const r of taktik.regeln.filter((x) => !(x.in_player_id && x.in_player_id !== "NULL"))) {
    const aenderungen = (["tactics", "playstyle", "aggression"] as const).filter((f) => r[f] && r[f] !== "no_change");
    const formation = r.formation && r.formation !== "no_change" ? (Number(r.formation) as 1 | 2) : null;
    if (!aenderungen.length && !formation) continue;
    const m = regelErfuellt(r, spiel, tid);
    if (m === null) continue;
    const belegt = aenderungen.length > 0 && aenderungen.every((f) => tacticXml.some((t) => (t.art === f || (f === "tactics" && t.art === "tactic")) && t.neu === r[f] && Math.abs(t.minute - m) <= 2));
    if (aenderungen.length && !belegt) {
      hinweise.push(`Regel (${regelText(r)}) war laut Spielstand ab ${m}. erfüllt, die XML zeigt aber keinen passenden Taktikwechsel: nicht als ausgelöst gewertet.`);
      continue;
    }
    evs.push({
      minute: m,
      stand: (() => {
        const t = [...spiel.tore].filter((x) => x.minute <= m).at(-1);
        return t?.stand ?? "0:0";
      })(),
      quelle: belegt ? "xml" : "abgeleitet",
      tun: () => {
        if (formation) k = formation;
        const teile = [
          ...aenderungen.map((f) => `${f === "tactics" ? "Taktik" : f === "playstyle" ? "Spielweise" : "Härte"} → ${r[f]}`),
          ...(formation ? [`Formation → ${ALT[formation]}`] : []),
        ];
        return `Regel (${regelText(r)}): ${teile.join(", ")}${formation ? (belegt ? " (Formation laut Export, Auslösung durch XML belegt)" : " (nur aus Bedingung und Spielstand abgeleitet, nicht in der XML)") : ""}`;
      },
    });
  }

  for (const e of evs.sort((a, b) => a.minute - b.minute)) {
    const text = e.tun();
    phasen.push({ minute: e.minute, stand: e.stand, text, quelle: e.quelle, aufstellung: bild(e.quelle === "abgeleitet" ? "abgeleitet" : "export") });
  }
  return { phasen, hinweise };
}

// Gegner: Start aus origin (Editor-Koordinaten); Eingewechselter übernimmt den Platz (abgeleitet)
export function gegnerVerlauf(spiel: StatsSpiel, tid: number): { phasen: Phase[]; hinweise: string[] } {
  const start = spiel.spieler.filter((p) => p.teamId === tid && p.editor);
  const besetzt = new Map(start.map((p, i) => [i, { pid: p.id, quelle: "xml" as Quelle }]));
  const name = new Map(spiel.spieler.map((p) => [p.id, p.name]));
  const bild = (): Platz[] =>
    start.flatMap((p, i) => {
      const b = besetzt.get(i);
      return b ? [{ slot: i, pid: b.pid, name: name.get(b.pid) ?? `id ${b.pid}`, x: p.editor!.x, y: p.editor!.y, torwart: p.torwart, quelle: b.quelle }] : [];
    });
  const phasen: Phase[] = [{ minute: 0, stand: "0:0", text: "Startaufstellung aus der XML (origin)", quelle: "xml", aufstellung: bild() }];
  const evs = [
    ...spiel.wechsel.filter((w) => w.teamId === tid).map((w) => ({ minute: w.minute, stand: w.stand, w })),
    ...spiel.taktikwechsel.filter((t) => t.teamId === tid).map((t) => ({ minute: t.minute, stand: t.stand, t })),
    ...spiel.karten.filter((k) => k.teamId === tid && /red/i.test(k.art)).map((k) => ({ minute: k.minute, stand: k.stand, k })),
  ].sort((a, b) => a.minute - b.minute);
  for (const e of evs) {
    if ("w" in e) {
      const slot = [...besetzt.entries()].find(([, b]) => b.pid === e.w.raus)?.[0];
      if (slot !== undefined) besetzt.set(slot, { pid: e.w.rein, quelle: "abgeleitet" });
      phasen.push({ minute: e.minute, stand: e.stand, quelle: "abgeleitet", text: `Wechsel (${e.w.grund === "preset" ? `Regel${e.w.regelMinute !== undefined ? ` ab ${e.w.regelMinute}.` : ""}` : e.w.grund === "injury" ? "Verletzung" : e.w.grund}): ${name.get(e.w.rein)} für ${name.get(e.w.raus)}, übernimmt dessen Platz (abgeleitet)`, aufstellung: bild() });
    } else if ("t" in e) {
      phasen.push({ minute: e.minute, stand: e.stand, quelle: "xml", text: `${e.t.art === "playstyle" ? "Spielweise" : e.t.art === "aggression" ? "Härte" : e.t.art} → ${e.t.neu}`, aufstellung: bild() });
    } else {
      const slot = [...besetzt.entries()].find(([, b]) => b.pid === e.k.spieler)?.[0];
      if (slot !== undefined) besetzt.delete(slot);
      phasen.push({ minute: e.minute, stand: e.stand, quelle: "xml", text: `Rote Karte: ${name.get(e.k.spieler)}`, aufstellung: bild() });
    }
  }
  return { phasen, hinweise: ["Umstellung der Formation nicht erkennbar: die XML enthält keine Formationswechsel, nur Taktik, Spielweise und Härte."] };
}
