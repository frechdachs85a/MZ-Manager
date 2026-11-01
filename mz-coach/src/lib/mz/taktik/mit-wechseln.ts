import { pruefeTaktikGegenKader } from "@/lib/taktik-check";
import { erzeugeTaktik } from "./erzeugen";
import { MIN_ABSTAND, MIN_Y } from "./pruefer";

// Spielstand-Regeln wie in deinen eigenen Reitern (mz-wissen.md, Abschnitt Taktiken: „Gemeinsame Regeln“; Marcus
// 01.11.2026: „auch Rot-Regelung und Führungsregeln, so wie die Profis wechseln“). Belege aus den Top-10-Spielen:
// Umstellen bei Rückstand in der 65. holt mehr Punkte (0,57 gegen 0,43), bei Führung in der 70. auf normal hält den Sieg
// etwas öfter (88 % gegen 84 %, kleine Stichprobe). Alternative 2 (in deinen Reitern bei 2 Toren Rückstand) wird nicht
// gesetzt, weil Alternative 1 und 2 bei erzeugten Taktiken gleich der Startaufstellung sind.
const SPIELSTAND: { minute: number; lage: "down_by_at_least" | "ahead_by_at_least" | "tie"; tore: number; tactics?: string; playstyle?: string; aggression?: string }[] = [
  { minute: 60, lage: "down_by_at_least", tore: 1, playstyle: "offensive", aggression: "aggressive" },
  { minute: 65, lage: "down_by_at_least", tore: 2, tactics: "shortpass", aggression: "aggressive" },
  { minute: 70, lage: "ahead_by_at_least", tore: 1, playstyle: "normal" },
  { minute: 80, lage: "tie", tore: 1, playstyle: "offensive", aggression: "aggressive" },
];

// Fehlende Spielstand-Regeln ergänzen (nur wenn die Taktik noch keine hat). Regeln ohne Wirkung (Grundeinstellung schon so)
// entfallen. Gibt die neue XML und die ergänzten Regeln in Worten zurück.
export function mitSpielstandRegeln(xml: string): { xml: string; regeln: string[] } {
  if (/check_goal_condition="true"/.test(xml)) return { xml, regeln: [] };
  const team = xml.match(/<Team\b[^>]*>/)?.[0] ?? "";
  const grund = (k: string) => team.match(new RegExp(`${k}="([^"]*)"`))?.[1];
  const zeilen: string[] = [];
  const text: string[] = [];
  for (const r of SPIELSTAND) {
    const tactics = r.tactics && r.tactics !== grund("tactics") ? r.tactics : "no_change";
    const playstyle = r.playstyle && r.playstyle !== grund("playstyle") ? r.playstyle : "no_change";
    const aggression = r.aggression && r.aggression !== grund("aggression") ? r.aggression : "no_change";
    if (tactics === "no_change" && playstyle === "no_change" && aggression === "no_change") continue;
    zeilen.push(
      `\t<TacticRule name="Taktikregel" check_time="true" time="${r.minute}" check_goal_condition="true" goal_condition="${r.lage}" goals="${r.tore}" check_player_event="false" player_event_player_type="anyone" player_event="receives_yellow" out_player="no_change" in_player_id="NULL" tactics="${tactics}" playstyle="${playstyle}" aggression="${aggression}" formation="no_change" />`,
    );
    const lage = r.lage === "tie" ? "Gleichstand" : r.lage === "ahead_by_at_least" ? `Führung` : `${r.tore} Tor${r.tore > 1 ? "en" : ""} Rückstand`;
    text.push(`ab ${r.minute}. bei ${lage}: ${[tactics, playstyle, aggression].filter((x) => x !== "no_change").join(" + ")}`);
  }
  return { xml: zeilen.length ? xml.replace(/<\/SoccerTactics>/, `${zeilen.join("\n")}\n</SoccerTactics>`) : xml, regeln: text };
}

// Mindestabstand halten (Prüfliste Regel 2: Feldspieler mindestens 47 auseinander, y mindestens 63). Aufstellungen von
// Topteams aus der Stats-XML liegen nach dem Umrechnen manchmal knapp darunter (343kp, 01.11.2026: 46,1 und 46,7).
// Je Aufstellung (x/y, x1/y1, x2/y2) wird der Spieler eines zu engen Paars, der nicht an der Grenze y = 63 steht, um das
// Nötige vom anderen weggeschoben (Ziel 48, ganze Zahlen), bis alle Abstände passen. Torwart bleibt, wie er ist.
export function abstaendeHalten(xml: string): { xml: string; verschoben: string[] } {
  const zeilen = [...xml.matchAll(/<Pos\b[^>]*\/?>/g)].map((m) => m[0]);
  const attr = (z: string, k: string) => Number(z.match(new RegExp(`\\s${k}="(-?\\d+)"`))?.[1]);
  const feld = zeilen.filter((z) => !/pos="goalie"/.test(z));
  const neu = new Map(feld.map((z) => [z, z]));
  const verschoben: string[] = [];
  for (const [kx, ky] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) {
    const p = feld.map((z) => ({ z, x: attr(z, kx), y: attr(z, ky) })).filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
    for (let runde = 0; runde < 60; runde++) {
      let paar: [number, number, number] | null = null;
      for (let i = 0; i < p.length; i++)
        for (let j = i + 1; j < p.length; j++) {
          const d = Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y);
          if (d < MIN_ABSTAND && (!paar || d < paar[2])) paar = [i, j, d];
        }
      if (!paar) break;
      const [i, j, d] = paar;
      // Wer bewegt sich: nicht der an der vorderen Grenze; sonst der zweite
      const [fest, los] = p[j].y <= MIN_Y && p[i].y > MIN_Y ? [j, i] : [i, j];
      const dx = p[los].x - p[fest].x || 1;
      const dy = p[los].y - p[fest].y;
      const len = Math.hypot(dx, dy) || 1;
      const um = 48 - d;
      p[los].x = Math.max(0, Math.min(208, Math.round(p[los].x + (dx / len) * um)));
      p[los].y = Math.max(MIN_Y, Math.round(p[los].y + (dy / len) * um));
      verschoben.push(`${kx === "x" ? "Start" : kx === "x1" ? "Alternative 1" : "Alternative 2"}: pid ${p[los].z.match(/pid="(\d+)"/)?.[1]} → ${p[los].x}/${p[los].y}`);
    }
    for (const q of p) {
      const alt = neu.get(q.z)!;
      neu.set(q.z, alt.replace(new RegExp(`(\\s${kx}=")-?\\d+(")`), `$1${q.x}$2`).replace(new RegExp(`(\\s${ky}=")-?\\d+(")`), `$1${q.y}$2`));
    }
  }
  let out = xml;
  for (const [alt, n] of neu) out = out.replace(alt, n);
  return { xml: out, verschoben };
}

// Neu erzeugte Taktik vollständig (Marcus, 01.11.2026: beim Import von 343kp fehlten die Wechselregeln; „das darfst du
// nicht vergessen“, „die Taktiken müssen immer komplett durchdacht sein“): beste Elf und Bank (erzeugeTaktik, mit
// Rot-Regel), Spielstand-Regeln wie oben, danach die Ausdauer-Wechsel der täglichen Prüfung (Startspieler unter Ausdauer 8
// in der 70. durch den besten passenden Bankspieler, höchstens 3 Wechsel).
export function erzeugeMitWechseln(opt: Parameters<typeof erzeugeTaktik>[0], reiter = "neu") {
  const e = erzeugeTaktik(opt);
  const s = mitSpielstandRegeln(abstaendeHalten(e.xml).xml);
  const c = pruefeTaktikGegenKader(reiter, s.xml, opt.kader, opt.spieltag);
  if (c.fehler) return { ...e, xml: s.xml, spielstand: s.regeln, wechsel: [] as string[], hinweise: [...e.hinweise, `Wechselregeln nicht ergänzt: ${c.fehler}`] };
  return { ...e, xml: c.xml, spielstand: s.regeln, wechsel: c.wechselregeln };
}
