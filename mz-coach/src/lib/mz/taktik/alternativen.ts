import { rolle } from "@/lib/mz/analyse/markt";
import { istAussen, MIN_Y, STURM_Y } from "./pruefer";
import { parseTaktikXml, type Taktik } from "./xml";

// Alternative 1 (Rot, 10 Mann) und Alternative 2 (2 Tore Rückstand) für eine Taktik, deren Alternativen gleich der
// Startaufstellung sind (Marcus, 01.11.2026: „baue Alternative 1 und 2 passend … in Zukunft muss das alles zusammen
// passieren“). Nichts frei erfunden: Vorbild ist dein ähnlichster eigener Reiter mit echten Alternativen (gleich viele
// Verteidiger, nächstliegende Startplätze). Jeder Feldspieler bekommt die Verschiebung des passenden Vorbild-Spielers
// (gleiche Rolle, nächster Startplatz, jeder Vorbildplatz einmal). Torwart bleibt. Abstände und Prüfliste prüft der Aufrufer.

const feld = (t: Taktik) => t.pos.filter((p) => p.pos === "normal");
const rolleVon = (p: { x: number; y: number }) => rolle({ pid: 0, x: p.x, y: p.y, torwart: false });
const gleich = (a?: { x: number; y: number }, b?: { x: number; y: number }) => !!a && !!b && a.x === b.x && a.y === b.y;

// Hat die Taktik echte Alternativen (mindestens ein Feldspieler steht in Alternative 1 oder 2 woanders)?
export function hatAlternativen(t: Taktik): boolean {
  return feld(t).some((p) => (p.alt1 && !gleich(p.alt1, p.start)) || (p.alt2 && !gleich(p.alt2, p.start)));
}

// Zuordnung Zielplatz → Vorbildplatz (gleiche Rolle zuerst, sonst nächster), Summe der Abstände
function zuordnung(ziel: Taktik, vorbild: Taktik) {
  const z = feld(ziel);
  const v = feld(vorbild);
  const paare = z
    .flatMap((a, i) => v.map((b, j) => ({ i, j, d: Math.hypot(a.start.x - b.start.x, a.start.y - b.start.y) + (rolleVon(a.start) === rolleVon(b.start) ? 0 : 1000) })))
    .sort((a, b) => a.d - b.d);
  const zu = new Map<number, number>();
  const belegt = new Set<number>();
  for (const p of paare) {
    if (zu.has(p.i) || belegt.has(p.j)) continue;
    zu.set(p.i, p.j);
    belegt.add(p.j);
  }
  const summe = [...zu.entries()].reduce((n, [i, j]) => n + Math.hypot(z[i].start.x - v[j].start.x, z[i].start.y - v[j].start.y), 0);
  return { zu, summe };
}

const verteidiger = (t: Taktik) => feld(t).filter((p) => rolleVon(p.start) === "VT").length;

// Ähnlichster Vorbild-Reiter mit echten Alternativen (gleich viele Verteidiger bevorzugt)
export function aehnlichsteVorlage(ziel: string, kandidaten: { reiter: string; xml: string }[]): { reiter: string; xml: string } | null {
  const t = parseTaktikXml(ziel);
  let beste: { reiter: string; xml: string; wert: number } | null = null;
  for (const k of kandidaten) {
    let v: Taktik;
    try {
      v = parseTaktikXml(k.xml);
    } catch {
      continue;
    }
    if (!hatAlternativen(v) || feld(v).length !== feld(t).length) continue;
    const wert = zuordnung(t, v).summe + (verteidiger(v) === verteidiger(t) ? 0 : 5000);
    if (!beste || wert < beste.wert) beste = { ...k, wert };
  }
  return beste ? { reiter: beste.reiter, xml: beste.xml } : null;
}

const klemm = (p: { x: number; y: number }) => ({ x: Math.max(0, Math.min(208, Math.round(p.x))), y: Math.max(MIN_Y, Math.min(300, Math.round(p.y))) });

// Alternativen aus dem Vorbild übertragen; Rot-Regel (formation 1) nach der Prüfliste auf Alternative 1 ausrichten:
// 1 Stürmer → Kurzpass, 2 Stürmer mit einem außen → Flügel, 2 Stürmer ohne außen → Kurzpass, sonst Taktik bleibt
export function alternativenUebertragen(zielXml: string, vorbildXml: string): { xml: string; text: string[] } {
  const t = parseTaktikXml(zielXml);
  const v = parseTaktikXml(vorbildXml);
  const { zu } = zuordnung(t, v);
  const z = feld(t);
  const vf = feld(v);
  const neu = new Map<number, { a1: { x: number; y: number }; a2: { x: number; y: number } }>();
  z.forEach((p, i) => {
    const j = zu.get(i);
    if (j === undefined) return;
    const b = vf[j];
    const d1 = b.alt1 ? { x: b.alt1.x - b.start.x, y: b.alt1.y - b.start.y } : { x: 0, y: 0 };
    const d2 = b.alt2 ? { x: b.alt2.x - b.start.x, y: b.alt2.y - b.start.y } : { x: 0, y: 0 };
    neu.set(p.pid, { a1: klemm({ x: p.start.x + d1.x, y: p.start.y + d1.y }), a2: klemm({ x: p.start.x + d2.x, y: p.start.y + d2.y }) });
  });
  let xml = zielXml.replace(/<Pos\b[^>]*\/?>/g, (zeile) => {
    const pid = Number(zeile.match(/\spid="(\d+)"/)?.[1]);
    const n = neu.get(pid);
    if (!n || /pos="goalie"/.test(zeile)) return zeile;
    return zeile
      .replace(/(\sx1=")-?\d+(")/, `$1${n.a1.x}$2`)
      .replace(/(\sy1=")-?\d+(")/, `$1${n.a1.y}$2`)
      .replace(/(\sx2=")-?\d+(")/, `$1${n.a2.x}$2`)
      .replace(/(\sy2=")-?\d+(")/, `$1${n.a2.y}$2`);
  });
  const sturm = [...neu.values()].map((n) => n.a1).filter((p) => p.y <= STURM_Y);
  const rotTaktik = sturm.length === 1 ? "shortpass" : sturm.length === 2 ? (sturm.some((p) => istAussen(p.x)) ? "wings" : "shortpass") : "no_change";
  const basis = t.team.tactics;
  xml = xml.replace(/<TacticRule\b[^>]*player_event="sent_off"[^>]*>/g, (z) =>
    /check_player_event="true"/.test(z) ? z.replace(/\stactics="[^"]*"/, ` tactics="${rotTaktik === basis ? "no_change" : rotTaktik}"`).replace(/\sformation="[^"]*"/, ` formation="1"`) : z,
  );
  // Bei 2 Toren Rückstand auf Alternative 2 umstellen (wie in deinen Reitern)
  xml = xml.replace(/<TacticRule\b[^>]*>/g, (z) =>
    /check_goal_condition="true"/.test(z) && /\sgoal_condition="down_by_at_least"/.test(z) && /\sgoals="2"/.test(z) ? z.replace(/\sformation="[^"]*"/, ` formation="2"`) : z,
  );
  return {
    xml,
    text: [
      `Alternative 1 und 2 nach dem Vorbild übertragen (${neu.size} Feldspieler)`,
      "65. bei 2 Toren Rückstand: Umstellung auf Alternative 2",
      `Rot: ${sturm.length} Stürmer in Alternative 1 → ${rotTaktik === "no_change" || rotTaktik === basis ? "Taktik bleibt" : rotTaktik === "wings" ? "Flügel" : "Kurzpass"}`,
    ],
  };
}
