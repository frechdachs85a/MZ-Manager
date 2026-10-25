import type { SpielerDaten } from "@/lib/mz/spieler";
import { aufstellung, type Taktik } from "./xml";

// Prüfliste aus mz-wissen.md, Abschnitt 5. "fehler" = Regel eindeutig verletzt, die Taktik darf so
// nicht ausgegeben werden. "hinweis" = Regel ohne genaue Grenze oder nur teilweise prüfbar.

export type Befund = { regel: number; text: string };
export type Pruefung = { ok: boolean; fehler: Befund[]; hinweise: Befund[] };

// Grenzen aus mz-wissen.md, Abschnitt 4
export const STURM_Y = 110; // y <= 110 = Sturm
export const MIN_Y = 63;
export const MIN_ABSTAND = 47;
export const MAX_STUERMER = 3;
export const MAX_WECHSEL = 3;
export const BANK_Y = [117, 140, 163, 186, 209]; // subgoalie, Abwehr, Mittelfeld, Sturm, X
// Außen = x <= 40 oder x >= 170 (Arbeitsdefinition von Marcus, 25.10.2026; Grenze unscharf)
export const AUSSEN_X_LINKS = 40;
export const AUSSEN_X_RECHTS = 170;
export const istAussen = (x: number) => x <= AUSSEN_X_LINKS || x >= AUSSEN_X_RECHTS;

const AUFSTELLUNG = ["Startaufstellung", "Alternative 1", "Alternative 2"] as const;
const PLAYSTYLE = ["defensive", "normal", "offensive"];
const AGGRESSION = ["passive", "normal", "aggressive"];

const ja = (v?: string) => v === "true";
const istWechsel = (r: Record<string, string>) =>
  !!r.in_player_id && r.in_player_id !== "NULL" && !!r.out_player && r.out_player !== "no_change";

export function pruefeTaktik(t: Taktik, kader: SpielerDaten[] = []): Pruefung {
  const fehler: Befund[] = [];
  const hinweise: Befund[] = [];
  const name = new Map(kader.map((s) => [s.pid, s.name]));
  const wer = (pid: number | string) => name.get(Number(pid)) ?? `pid ${pid}`;

  // Grundaufbau
  const torwarte = t.pos.filter((p) => p.pos === "goalie");
  if (t.pos.length !== 11) fehler.push({ regel: 0, text: `${t.pos.length} statt 11 Spieler aufgestellt.` });
  if (torwarte.length !== 1) fehler.push({ regel: 0, text: `${torwarte.length} statt 1 Torwart aufgestellt.` });
  const allePids = [...t.pos.map((p) => p.pid), ...t.subs.map((s) => s.pid)];
  const doppelt = allePids.filter((p, i) => allePids.indexOf(p) !== i);
  for (const p of new Set(doppelt)) fehler.push({ regel: 0, text: `${wer(p)} steht mehrfach in der Taktik.` });
  if (kader.length) {
    for (const p of allePids) if (!name.has(p)) fehler.push({ regel: 0, text: `pid ${p} ist nicht im gespeicherten Kader.` });
  }

  // 1 und 2: je Aufstellung Stürmerzahl, y >= 63, Abstände >= 47 (nur Feldspieler)
  for (const k of [0, 1, 2] as const) {
    const feld = aufstellung(t, k).filter((s) => s.pos === "normal");
    const fehlen = feld.filter((s) => !s.p);
    if (fehlen.length === feld.length && k > 0) {
      hinweise.push({ regel: 1, text: `${AUFSTELLUNG[k]} ist nicht gesetzt.` });
      continue;
    }
    for (const s of fehlen) fehler.push({ regel: 1, text: `${AUFSTELLUNG[k]}: ${wer(s.pid)} ohne Koordinaten.` });
    const mit = feld.filter((s) => s.p) as { pid: number; p: { x: number; y: number } }[];
    const stuermer = mit.filter((s) => s.p.y <= STURM_Y);
    if (stuermer.length > MAX_STUERMER) {
      fehler.push({ regel: 1, text: `${AUFSTELLUNG[k]}: ${stuermer.length} Stürmer (y ≤ ${STURM_Y}), erlaubt sind ${MAX_STUERMER}.` });
    }
    for (const s of mit) {
      if (s.p.y < MIN_Y) fehler.push({ regel: 1, text: `${AUFSTELLUNG[k]}: ${wer(s.pid)} auf y ${s.p.y}, kleiner als ${MIN_Y}.` });
    }
    for (let i = 0; i < mit.length; i++) {
      for (let j = i + 1; j < mit.length; j++) {
        const d = Math.hypot(mit[i].p.x - mit[j].p.x, mit[i].p.y - mit[j].p.y);
        if (d < MIN_ABSTAND) {
          fehler.push({
            regel: 2,
            text: `${AUFSTELLUNG[k]}: ${wer(mit[i].pid)} (${mit[i].p.x}/${mit[i].p.y}) und ${wer(mit[j].pid)} (${mit[j].p.x}/${mit[j].p.y}) nur ${d.toFixed(1)} auseinander, mindestens ${MIN_ABSTAND}.`,
          });
        }
      }
    }
    // 3: Gilt bei genau zwei zentralen Stürmern (Marcus, 25.10.2026). Bei drei zentralen ist "zwei hinten
    // gleich hoch, einer davor" das Profi-Muster (z. B. 69/98, 131/98, 100/63) und erlaubt.
    const zentral = stuermer.filter((s) => !istAussen(s.p.x));
    if (zentral.length === 2 && zentral[0].p.y === zentral[1].p.y) {
      fehler.push({
        regel: 3,
        text: `${AUFSTELLUNG[k]}: die zwei zentralen Stürmer ${wer(zentral[0].pid)} und ${wer(zentral[1].pid)} stehen auf gleicher Höhe (y ${zentral[0].p.y}). Versetzt aufstellen.`,
      });
    }
  }

  // 5: Wechsel. Feste Zeitwechsel ohne weitere Bedingung zählen sicher, bedingte nur möglicherweise.
  const wechsel = t.regeln.filter(istWechsel);
  const fest = wechsel.filter((r) => !ja(r.check_goal_condition) && !ja(r.check_player_event));
  if (fest.length > MAX_WECHSEL) {
    fehler.push({ regel: 5, text: `${fest.length} feste Zeitwechsel, höchstens ${MAX_WECHSEL} möglich.` });
  } else if (wechsel.length > MAX_WECHSEL) {
    hinweise.push({ regel: 5, text: `${wechsel.length} Wechselregeln, davon ${fest.length} fest. Es dürfen nie mehr als ${MAX_WECHSEL} gleichzeitig greifen.` });
  }
  const bank = new Set(t.subs.map((s) => s.pid));
  const feldPids = new Set(t.pos.map((p) => p.pid));
  const subgoalie = t.subs.filter((s) => s.pos === "subgoalie").map((s) => s.pid);
  // Kein Spieler darf in zwei Wechselregeln vorkommen, weder als Ein- noch als Auswechsler (Marcus, 25.10.2026)
  const vorkommen = new Map<number, number>();
  for (const r of wechsel) {
    const inn = Number(r.in_player_id);
    const raus = Number(r.out_player);
    if (!bank.has(inn)) fehler.push({ regel: 5, text: `Regel wechselt ${wer(inn)} ein, der nicht auf der Bank sitzt.` });
    if (!feldPids.has(raus) && !bank.has(raus)) fehler.push({ regel: 5, text: `Regel wechselt ${wer(raus)} aus, der nicht in der Taktik steht.` });
    if (subgoalie.includes(inn)) fehler.push({ regel: 8, text: `${wer(inn)} sitzt auf subgoalie und kann per Regel nicht eingewechselt werden.` });
    for (const pid of [inn, raus]) vorkommen.set(pid, (vorkommen.get(pid) ?? 0) + 1);
  }
  for (const [pid, n] of vorkommen) {
    if (n > 1) fehler.push({ regel: 5, text: `${wer(pid)} kommt in ${n} Wechselregeln vor. Jeder Spieler darf nur in einer Wechselregel stehen.` });
  }

  // 6: Bei Rückstand nur offensiver, nie absichern
  const start = { ps: PLAYSTYLE.indexOf(t.team.playstyle ?? ""), ag: AGGRESSION.indexOf(t.team.aggression ?? "") };
  for (const r of t.regeln.filter((r) => ja(r.check_goal_condition) && r.goal_condition === "down_by_at_least")) {
    const zeit = ja(r.check_time) ? `ab ${r.time}. ` : "";
    const ps = PLAYSTYLE.indexOf(r.playstyle ?? "");
    const ag = AGGRESSION.indexOf(r.aggression ?? "");
    if (r.playstyle === "defensive" || r.aggression === "passive") {
      fehler.push({ regel: 6, text: `Regel ${zeit}bei Rückstand sichert ab (${r.playstyle}/${r.aggression}).` });
    } else if ((ps >= 0 && start.ps >= 0 && ps < start.ps) || (ag >= 0 && start.ag >= 0 && ag < start.ag)) {
      fehler.push({ regel: 6, text: `Regel ${zeit}bei Rückstand ist weniger offensiv als die Grundeinstellung.` });
    }
  }

  // 7: Rote-Karte-Regel
  const rot = t.regeln.filter((r) => ja(r.check_player_event) && r.player_event === "sent_off");
  if (rot.length === 0) {
    fehler.push({ regel: 7, text: "Keine Regel für eine Rote Karte (player_event sent_off)." });
  } else {
    for (const r of rot.filter(istWechsel)) {
      if (rot.length === 1) {
        hinweise.push({ regel: 7, text: `Rot-Regel wechselt ${wer(r.out_player)} aus. Sieht genau er Rot, greift sie nicht. Fall abgedeckt?` });
      }
    }
  }

  // 8: Bank vollständig
  const belegt = new Set(t.subs.map((s) => s.y));
  const leer = BANK_Y.filter((y) => !belegt.has(y));
  if (leer.length) fehler.push({ regel: 8, text: `Bankplätze unbesetzt (y ${leer.join(", ")}). Alle 5 Plätze besetzen.` });
  const sg = t.subs.find((s) => s.pos === "subgoalie");
  if (sg && sg.y !== BANK_Y[0]) hinweise.push({ regel: 8, text: `subgoalie sitzt auf y ${sg.y}, erwartet ${BANK_Y[0]}.` });

  // 10: nicht aufstellbar, verletzt, gesperrt (aus den eingelesenen Seiten)
  if (kader.length) {
    const nachPid = new Map(kader.map((s) => [s.pid, s]));
    for (const pid of allePids) {
      const s = nachPid.get(pid);
      if (!s) continue;
      const ort = feldPids.has(pid) ? "aufgestellt" : "auf der Bank";
      if (s.status?.aufstellbar === false) {
        const bank = feldPids.has(pid) ? "" : " Ob Kegel-Spieler auf der Bank sitzen dürfen, ist nicht getestet; bis dahin auch nicht auf die Bank.";
        fehler.push({ regel: 10, text: `${s.name} ist ${ort}, hat aber den Kegel (Trainingslager ohne Chip).${bank}` });
      }
      if (s.status?.verletzt) fehler.push({ regel: 10, text: `${s.name} ist ${ort}, aber verletzt.` });
      if (s.status?.gesperrt) {
        const arten = [...new Set((s.sperren ?? []).map((x) => x.art))].join(", ");
        hinweise.push({ regel: 10, text: `${s.name} ist ${ort} und gesperrt (${arten}). Prüfen, ob die Sperre dieses Spiel betrifft.` });
      }
    }
    if (!kader.some((s) => s.statusStand?.aufstellbar)) {
      hinweise.push({ regel: 10, text: "Taktikseite noch nicht eingelesen: Kegel nicht geprüft." });
    }
  } else {
    hinweise.push({ regel: 10, text: "Kein Kader gespeichert: Verfügbarkeit nicht geprüft." });
  }

  return { ok: fehler.length === 0, fehler, hinweise };
}
