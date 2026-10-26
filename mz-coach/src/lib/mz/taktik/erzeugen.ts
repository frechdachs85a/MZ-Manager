import { mzWert, POSITIONEN, type Position } from "@/lib/mz/formel";
import { einsatzImLigaspiel } from "@/lib/mz/einsatz";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { rolle } from "@/lib/mz/analyse/markt";
import { BANK_Y, STURM_Y, istAussen } from "./pruefer";
import { KOPFBALL_GEWICHT } from "./gegner-gewichte";

// Taktik-Code mit der bestmöglichen Besetzung aus deinem Kader (Auftrag Marcus, 26.10.2026).
// Positionen: echte Startaufstellung eines Topteams (Editor-Koordinaten aus der Stats-XML). Besetzung: die
// Zuordnung Spieler -> Platz mit der größten Summe der MZ-Werte in der Rolle des Platzes (mz-wissen.md,
// Abschnitt 6), berechnet für die ganze Elf auf einmal (ungarische Methode), nicht Platz für Platz.
// Nicht aufstellbar (Kegel, verletzt, gesperrt, Aufstellbarkeit unklar) kommt weder in die Elf noch auf die Bank
// (Prüfliste Regel 10). Alternative 1 und 2 sind die Startaufstellung: eine 10-Mann-Aufstellung für Rot wird
// nicht erfunden, die Seite sagt das dazu.

export type Platz = { x: number; y: number; torwart: boolean };
export type Besetzung = { platz: Platz; rolle: Position; spieler: SpielerDaten; wert: number };
export type BankPlatz = { y: number; art: "subgoalie" | "sub"; rolle: Position | "beste"; spieler: SpielerDaten; wert: number };

export type ErzeugteTaktik = {
  xml: string;
  elf: Besetzung[];
  bank: BankPlatz[];
  kapitaen?: SpielerDaten;
  summe: number;
  hinweise: string[];
  ausgeschlossen: { name: string; grund: string }[];
};

// Ungarische Methode für n Zeilen <= m Spalten, minimiert die Kosten. Liefert je Zeile die Spalte.
export function zuordnen(kosten: number[][]): number[] {
  const n = kosten.length;
  const m = kosten[0]?.length ?? 0;
  if (n > m) throw new Error("Mehr Plätze als Spieler.");
  const INF = 1e18;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const weg = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const benutzt = new Array(m + 1).fill(false);
    do {
      benutzt[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (benutzt[j]) continue;
        const cur = kosten[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          weg[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (benutzt[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = weg[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const ergebnis = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) ergebnis[p[j] - 1] = j - 1;
  return ergebnis;
}

const wertIn = (s: SpielerDaten, r: Position) => {
  const w = mzWert(s.skills, r);
  return w.ok ? w.wert : undefined;
};

// Verfügbar fürs nächste Ligaspiel wie auf der Zentrale: kein Kegel, nicht verletzt, nicht gesperrt
export function verfuegbar(kader: SpielerDaten[], spieltag: Date): { ja: SpielerDaten[]; nein: { name: string; grund: string }[] } {
  const ja: SpielerDaten[] = [];
  const nein: { name: string; grund: string }[] = [];
  for (const s of kader) {
    const e = einsatzImLigaspiel(s, spieltag);
    if (s.status?.verletzt) nein.push({ name: s.name, grund: "verletzt" });
    else if (s.status?.gesperrt) nein.push({ name: s.name, grund: "gesperrt (Wettbewerb siehe Kader)" });
    else if (e.lage === "nicht_bereit" || e.lage === "unklar") nein.push({ name: s.name, grund: e.text });
    else ja.push(s);
  }
  return { ja, nein };
}

const attr = (a: Record<string, string | number>) =>
  Object.entries(a)
    .map(([k, v]) => `${k}="${String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join(" ");

// Taktik-XML mit der besten Besetzung erzeugen
export function erzeugeTaktik(opt: {
  feld: { x: number; y: number }[]; // 10 Feldspieler
  torwart?: { x: number; y: number };
  tactics?: string;
  playstyle?: string;
  aggression?: string;
  kader: SpielerDaten[];
  spieltag: Date;
  kapitaenPid?: number; // z. B. Kapitän aus deinem Archiv
  // Gegnerbezogen (gegner-gewichte.ts), je Feldplatz in der Reihenfolge von feld
  faktor?: number[];
  kopfball?: boolean[];
  regeln?: string[]; // fertige TacticRule-Zeilen (z. B. Wechselregeln aus dem Archiv), ersetzen die Rot-Regel nicht
}): ErzeugteTaktik {
  const hinweise: string[] = [];
  const { ja, nein } = verfuegbar(opt.kader, opt.spieltag);
  const plaetze: Platz[] = [{ ...(opt.torwart ?? { x: 103, y: 315 }), torwart: true }, ...opt.feld.map((p) => ({ ...p, torwart: false }))];
  if (!opt.torwart) hinweise.push("Torwartposition nicht in der Vorlage: 103/315 wie in deinem Export außenR.");
  const rollen = plaetze.map((p) => rolle({ pid: 0, x: p.x, y: p.y, torwart: p.torwart }));
  // Nur Spieler mit vollständig bekannten Skills; Kosten = minus MZ-Wert (unbekannt = sehr teuer)
  const kandidaten = ja.filter((s) => POSITIONEN.some((r) => wertIn(s, r) !== undefined));
  if (kandidaten.length < 11) throw new Error(`Nur ${kandidaten.length} aufstellbare Spieler mit bekannten Skills, 11 nötig.`);
  // Gegnerbezogene Gewichte gelten nur für die Wahl, der ausgewiesene Wert bleibt der MZ-Wert
  const kosten = rollen.map((r, i) =>
    kandidaten.map((s) => {
      const w = wertIn(s, r);
      if (w === undefined) return 1000;
      const f = i > 0 ? (opt.faktor?.[i - 1] ?? 1) : 1;
      const k = i > 0 && opt.kopfball?.[i - 1] ? KOPFBALL_GEWICHT * (s.skills.kopfball?.wert ?? 0) : 0;
      return -(w * f + k);
    }),
  );
  const zu = zuordnen(kosten);
  const elf: Besetzung[] = plaetze.map((platz, i) => ({ platz, rolle: rollen[i], spieler: kandidaten[zu[i]], wert: wertIn(kandidaten[zu[i]], rollen[i]) ?? 0 }));

  // Bank nach Position (Prüfliste Regel 8): subgoalie, Abwehr, Mittelfeld, Sturm, X (beste übrige)
  const rest = new Set(kandidaten.filter((s) => !elf.some((e) => e.spieler.pid === s.pid)));
  const besterFuer = (r: Position | "beste") => {
    let best: { s: SpielerDaten; w: number } | null = null;
    for (const s of rest) {
      const w = r === "beste" ? Math.max(...POSITIONEN.filter((x) => x !== "TW").map((x) => wertIn(s, x) ?? 0)) : (wertIn(s, r) ?? 0);
      if (!best || w > best.w) best = { s, w };
    }
    if (best) rest.delete(best.s);
    return best;
  };
  const bank: BankPlatz[] = [];
  for (const [i, r] of (["TW", "VT", "MF", "Sturm", "beste"] as const).entries()) {
    const b = besterFuer(r);
    if (b) bank.push({ y: BANK_Y[i], art: i === 0 ? "subgoalie" : "sub", rolle: r, spieler: b.s, wert: b.w });
  }
  if (bank.length < 5) hinweise.push(`Nur ${bank.length} Bankplätze besetzt (zu wenige aufstellbare Spieler).`);

  // Kapitän: aus deinem Archiv, wenn er spielt; sonst der Feldspieler mit der meisten Erfahrung
  const kapitaen =
    elf.find((e) => e.spieler.pid === opt.kapitaenPid)?.spieler ??
    [...elf].sort((a, b) => (b.spieler.skills.erfahrung?.wert ?? 0) - (a.spieler.skills.erfahrung?.wert ?? 0))[0]?.spieler;
  if (opt.kapitaenPid && kapitaen?.pid !== opt.kapitaenPid) hinweise.push(`Dein Kapitän aus dem Archiv spielt hier nicht: Kapitän ist ${kapitaen?.name} (meiste Erfahrung).`);

  // Rote-Karte-Regel (Prüfliste Regel 7): ohne Spielerwechsel, Umstellung auf Alternative 1;
  // 2 Stürmer -> Flügel, 1 Stürmer -> Kurzpass. Bei 3 Stürmern sagt die Regel nichts: Taktik bleibt.
  const stuermer = opt.feld.filter((p) => p.y <= STURM_Y);
  const rotTaktik = stuermer.length === 2 ? "wings" : stuermer.length === 1 ? "shortpass" : "no_change";
  if (stuermer.length === 2 && !stuermer.some((p) => istAussen(p.x))) hinweise.push("Rot-Logik: 2 Stürmer heißt einer außen, einer zentral. In Alternative 1 einen Stürmer nach außen stellen.");
  if (rotTaktik === "no_change") hinweise.push(`Rot-Logik der Prüfliste nennt keine Taktik für ${stuermer.length} Stürmer: Taktik bleibt bei Rot.`);
  hinweise.push("Alternative 1 und 2 sind gleich der Startaufstellung. Für die Rot-Regel im Editor eine 10-Mann-Alternative 1 einstellen.");
  hinweise.push("pt und fk (Elfmeter- und Freistoß-Reihenfolge, nicht bestätigt) in Reihenfolge der Zeilen wie in deinem Export.");

  let nr = 0;
  const zeilen: string[] = [];
  zeilen.push(`\t<Team ${attr({ tactics: opt.tactics ?? "wings", playstyle: opt.playstyle ?? "normal", aggression: opt.aggression ?? "normal", captain: kapitaen?.pid ?? "" })} />`);
  for (const e of elf) {
    nr++;
    const { x, y } = e.platz;
    zeilen.push(`\t<Pos ${attr({ pos: e.platz.torwart ? "goalie" : "normal", pid: e.spieler.pid, x, y, x1: x, y1: y, x2: x, y2: y, pt: nr, fk: nr })} />`);
  }
  for (const b of bank) {
    nr++;
    zeilen.push(`\t<Sub ${attr({ pos: b.art, pid: b.spieler.pid, x: 228, y: b.y, x1: 228, y1: b.y, x2: 228, y2: b.y, pt: nr, fk: nr })} />`);
  }
  zeilen.push(
    `\t<TacticRule ${attr({
      name: "Taktikregel",
      check_time: "false",
      time: 5,
      check_goal_condition: "false",
      goal_condition: "tie",
      goals: 1,
      check_player_event: "true",
      player_event_player_type: "anyone",
      player_event: "sent_off",
      out_player: "no_change",
      in_player_id: "NULL",
      tactics: rotTaktik,
      playstyle: "no_change",
      aggression: "no_change",
      formation: 1,
    })} />`,
  );
  for (const r of opt.regeln ?? []) zeilen.push(`\t${r}`);
  const xml = `<?xml version="1.0" ?>\n<SoccerTactics>\n${zeilen.join("\n")}\n</SoccerTactics>\n`;
  return { xml, elf, bank, kapitaen, summe: Math.round(elf.reduce((n, e) => n + e.wert, 0) * 100) / 100, hinweise, ausgeschlossen: nein };
}
