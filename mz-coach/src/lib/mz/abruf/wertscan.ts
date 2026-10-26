import "server-only";
import type Database from "better-sqlite3";
import { parse } from "node-html-parser";
import { abrufBeenden, abrufBeginnen, letzterAbruf, speichereRohseite } from "@/lib/db/abruf";
import { ladeGegnerKader, speichereGegnerKader } from "@/lib/db/gegner-kader";
import { ladeTopTeams } from "@/lib/db/top";
import { zugangStatus } from "@/lib/mz/zugang";
import { ladeWertSpiele, speichereWertSpiel, wertSpielVorhanden, type WertSpiel } from "@/lib/db/wertspiel";
import { de } from "@/lib/mz/analyse/gegner";
import { wertverlauf } from "@/lib/mz/analyse/wertverlauf";
import { parseKaderSeite } from "@/lib/mz/parser/kader";
import { parseSpielliste, spiellisteHtmlAus, type ListenSpiel } from "@/lib/mz/parser/spielliste";
import { parseStatsXml, type StatsSpiel } from "@/lib/mz/parser/stats";
import { istWeltliga } from "./top-auswahl";
import { meldungAus, type Ergebnis } from "./kader";
import { marke, mitMzSitzung, type MzSitzung } from "./sitzung";
import { holeStatsXml } from "./spiele";

// Wertbereich-Statistik (Anweisung Marcus, 26.10.2026): je Spiel der Top 10 und der Weltliga-Teams Startelf-Wert
// und gewichteter Feld-Wert beider Teams, Verhältnis und Ergebnis speichern. Die Quoten je Wertbereich sind danach
// eine Datenbankabfrage (db/wertspiel.ts).
// Ablauf: Teamlisten (Top 10, Weltliga-Tabelle) und je Team eine Spielliste (selectType=all, limit=max) eingeloggt;
// Stats-XML ohne Login, höchstens 4 gleichzeitig (check-match bis "ok", nie type=data); je beteiligtem Team eine
// Kaderseite ?p=players&sub=alt&tid= (Marktwerte), höchstens alle 7 Tage neu. Gespeicherte Spiele nie erneut.

export const WELTLIGA_PFAD = "/?p=league&type=world&sid=1&tid=403373";
export const LIGA_MID = [1_620_000_000, 1_630_000_000] as const; // aktuelle Saison laut Marcus
export const WELTLIGA_MID_AB = 1_630_000_000;
export const XML_PARALLEL = 4;
const KADER_GUELTIG_TAGE = 7;
const LISTE = "/ajax.php?p=matches&sub=list&sport=soccer";

// Teams einer Tabellenseite: alle Links auf ?p=team&tid=… in der Tabelle mit den meisten verschiedenen Teams
export function teamsAusTabelle(html: string): { tid: number; name: string }[] {
  const doc = parse(html);
  let beste: { tid: number; name: string }[] = [];
  for (const t of doc.querySelectorAll("table")) {
    const m = new Map<number, string>();
    for (const a of t.querySelectorAll('a[href*="tid="]')) {
      const tid = Number((a.getAttribute("href") ?? "").match(/[?&]tid=(\d+)/)?.[1]);
      const name = a.text.replace(/\s+/g, " ").trim();
      if (tid && name && !m.has(tid)) m.set(tid, name);
    }
    if (m.size > beste.length) beste = [...m.entries()].map(([tid, name]) => ({ tid, name }));
  }
  return beste.length >= 4 ? beste : [];
}

// Liga, Weltliga oder anderes (dann null)
export function wettbewerbVon(s: ListenSpiel): "liga" | "weltliga" | null {
  if (s.altersklasse || s.tore === undefined) return null;
  if (istWeltliga(s) && s.mid > WELTLIGA_MID_AB) return "weltliga";
  if (s.art === "Ligaspiel" && s.mid > LIGA_MID[0] && s.mid < LIGA_MID[1]) return "liga";
  return null;
}

// Einfacher Pool: höchstens n Aufgaben gleichzeitig
export async function imPool<T>(aufgaben: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(aufgaben.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, aufgaben.length) }, async () => {
      while (i < aufgaben.length) {
        const k = i++;
        out[k] = await aufgaben[k]();
      }
    }),
  );
  return out;
}

async function kaderLesen(db: Database.Database, s: MzSitzung, tid: number): Promise<number> {
  const a = await s.holeText(`/?p=players&sub=alt&tid=${tid}`);
  let spieler;
  try {
    spieler = parseKaderSeite(a.text, { ohneSkills: true }).spieler;
  } catch (e) {
    // Für die Diagnose aufheben (nur einmal je Lauf, siehe Aufrufer)
    speichereRohseite(db, { art: "kader-fremd", url: a.url, status: a.status, htmlRoh: a.text, htmlDom: null });
    throw e;
  }
  speichereGegnerKader(db, tid, spieler.map((x) => ({ pid: x.pid, name: x.name, alter: x.alter, wert: x.marktwert })) as never);
  return spieler.length;
}

function kaderAktuell(db: Database.Database, tid: number, jetzt = Date.now()): boolean {
  const k = ladeGegnerKader(db, tid);
  return k.length > 0 && jetzt - new Date(k[0].stand).getTime() < KADER_GUELTIG_TAGE * 86_400_000;
}

// Werte eines Spiels aus Aufstellung und Wechseln berechnen (ohne Abruf, auch für bereits gespeicherte Spiele)
export function berechneWerte(w: WertSpiel, wert: (tid: number, pid: number) => number | undefined): WertSpiel {
  const auf = w.aufstellung!;
  const teamVon = new Map<number, number>();
  for (const pid of [...auf.a.elf, ...auf.a.wechsel.map((x) => x.rein)]) teamVon.set(pid, w.tidA);
  for (const pid of [...auf.b.elf, ...auf.b.wechsel.map((x) => x.rein)]) teamVon.set(pid, w.tidB);
  const wv = (pid: number) => wert(teamVon.get(pid) ?? 0, pid);
  const fehlend = new Set<number>();
  const summe = (pids: number[]) =>
    pids.reduce((n, p) => {
      const x = wv(p);
      if (x === undefined) fehlend.add(p);
      return n + (x ?? 0);
    }, 0);
  const elfA = summe(auf.a.elf);
  const elfB = summe(auf.b.elf);
  const v = wertverlauf({ eigeneElf: auf.a.elf, gegnerElf: auf.b.elf, eigeneWechsel: auf.a.wechsel, gegnerWechsel: auf.b.wechsel, wert: wv, name: String });
  for (const n of v.fehlend) fehlend.add(Number(n));
  return {
    ...w,
    elfA,
    elfB,
    feldA: Math.round(v.gewichtet.eigen),
    feldB: Math.round(v.gewichtet.gegner),
    verhaeltnisElf: elfB ? elfA / elfB : undefined,
    verhaeltnisFeld: v.gewichtet.gegner ? v.gewichtet.eigen / v.gewichtet.gegner : undefined,
    fehlendeWerte: fehlend.size,
  };
}

// Ein Spiel aus der Stats-XML auswerten; Team A = das Team der Liste, aus dessen Sicht das Ergebnis gilt
export function werteWertSpiel(spiel: StatsSpiel, tidA: number, wettbewerb: "liga" | "weltliga", wert: (tid: number, pid: number) => number | undefined): WertSpiel {
  const a = spiel.teams.find((t) => t.id === tidA)!;
  const b = spiel.teams.find((t) => t.id !== tidA)!;
  const elf = (tid: number) => spiel.spieler.filter((p) => p.teamId === tid && p.origin).map((p) => p.id);
  const wechsel = (tid: number) => spiel.wechsel.filter((w) => w.teamId === tid).map((w) => ({ minute: w.minute, raus: w.raus, rein: w.rein }));
  const toreA = Number(a.statistik.goals ?? NaN);
  const toreB = Number(b.statistik.goals ?? NaN);
  return berechneWerte(
    {
      mid: spiel.mid,
      datum: spiel.datum,
      wettbewerb,
      tidA: a.id,
      tidB: b.id,
      nameA: a.name,
      nameB: b.name,
      toreA,
      toreB,
      ergebnisA: toreA > toreB ? "S" : toreA < toreB ? "N" : "U",
      einstellungA: `${de(a.tactic)}/${de(a.playstyle)}/${de(a.aggression)}`,
      einstellungB: `${de(b.tactic)}/${de(b.playstyle)}/${de(b.aggression)}`,
      fehlendeWerte: 0,
      aufstellung: { a: { elf: elf(a.id), wechsel: wechsel(a.id) }, b: { elf: elf(b.id), wechsel: wechsel(b.id) } },
    },
    wert,
  );
}

// Alle gespeicherten Spiele mit den aktuell gespeicherten Kaderwerten neu berechnen (kein Abruf)
export function wertSpieleNeuBerechnen(db: Database.Database): number {
  const werte = new Map<number, Map<number, number | undefined>>();
  const wertVon = (tid: number, pid: number) => {
    if (!werte.has(tid)) werte.set(tid, new Map(ladeGegnerKader(db, tid).map((k) => [k.pid, k.wert ?? undefined])));
    return werte.get(tid)!.get(pid);
  };
  const alle = ladeWertSpiele(db);
  db.transaction(() => {
    for (const w of alle) speichereWertSpiel(db, berechneWerte(w, wertVon));
  })();
  return alle.length;
}

// Wertbereich-Scan: Spiele und Kader der Topteams, Werte berechnen
export async function wertScanAbrufen(db: Database.Database, opt = { manuell: false }): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "wertscan");
  marke(true);
  const teile: string[] = [];
  let ok = true;
  try {
    // 1. bis 2. eingeloggt: Teamliste, Spiellisten
    const auftraege = new Map<number, { tidA: number; wettbewerb: "liga" | "weltliga" }>();
    const sitzungTeams = new Set<number>();
    await mitMzSitzung(
      db,
      async (s) => {
        const teams = new Map<number, string>(ladeTopTeams(db).map((t) => [t.tid, t.name]));
        try {
          // Tabelle wird per JavaScript geladen: Seite im Browser öffnen
          const wl = await s.holeSeite(WELTLIGA_PFAD);
          speichereRohseite(db, { art: "weltliga", url: wl.url, status: wl.status, htmlRoh: wl.htmlRoh, htmlDom: wl.htmlDom });
          // Die Tabelle steht nicht im Seiten-HTML, sondern kommt per Reiter "Tabelle" (a#league_tab_table, ajax.php …&sub=table;
          // gesehen 26.10.2026 in der gespeicherten Seite). Diesen Link wie die Seite selbst abrufen.
          let wlTeams = teamsAusTabelle(wl.htmlDom ?? wl.htmlRoh ?? "");
          const reiter = parse(wl.htmlDom ?? wl.htmlRoh ?? "").querySelector("a#league_tab_table")?.getAttribute("href");
          if (!wlTeams.length && reiter) {
            const t = await s.holeText(reiter.replace(/&amp;/g, "&"));
            speichereRohseite(db, { art: "weltliga-tabelle", url: t.url, status: t.status, htmlRoh: t.text, htmlDom: null });
            wlTeams = teamsAusTabelle(t.text);
          }
          for (const t of wlTeams) teams.set(t.tid, t.name);
          teile.push(`Weltliga-Tabelle: ${wlTeams.length} Teams.`);
        } catch (e) {
          teile.push(`Weltliga-Tabelle: ${meldungAus(e)}`);
        }
        for (const tid of teams.keys()) {
          try {
            const a = await s.sendeForm(LISTE, { type: "played", hidescore: "false", tid1: String(tid), tid2: "", offset: "", selectType: "all", limit: "max" });
            const html = spiellisteHtmlAus(a.text);
            if (!html) continue;
            for (const sp of parseSpielliste(html, tid).spiele) {
              const w = wettbewerbVon(sp);
              if (w && !auftraege.has(sp.mid) && !wertSpielVorhanden(db, sp.mid)) auftraege.set(sp.mid, { tidA: tid, wettbewerb: w });
            }
          } catch (e) {
            teile.push(`Spielliste tid ${tid}: ${meldungAus(e)}`);
          }
        }
        teile.push(`${teams.size} Teams, ${auftraege.size} neue Spiele.`);
      },
      opt,
    );

    // 3. Stats-XML ohne Login, höchstens 4 gleichzeitig
    const xml = new Map<number, StatsSpiel>();
    let leer = 0;
    await imPool(
      [...auftraege.keys()].map((mid) => async () => {
        const r = await holeStatsXml(mid);
        if (!r.ok) {
          leer++;
          return;
        }
        try {
          const sp = parseStatsXml(r.xml);
          xml.set(mid, sp);
          for (const t of sp.teams) sitzungTeams.add(t.id);
        } catch {
          leer++;
        }
      }),
      XML_PARALLEL,
    );
    teile.push(`Stats-XML: ${xml.size} gelesen, ${leer} leer oder fehlerhaft.`);

    // 5. Kaderseiten der beteiligten Teams (eingeloggt, höchstens alle 7 Tage je Team)
    for (const w of ladeWertSpiele(db)) {
      sitzungTeams.add(w.tidA);
      sitzungTeams.add(w.tidB);
    }
    const fehlen = [...sitzungTeams].filter((tid) => !kaderAktuell(db, tid));
    if (fehlen.length) {
      let gelesen = 0;
      const fehler = new Map<string, number[]>();
      await mitMzSitzung(
        db,
        async (s) => {
          for (const tid of fehlen) {
            try {
              await kaderLesen(db, s, tid);
              gelesen++;
            } catch (e) {
              const m = meldungAus(e);
              fehler.set(m, [...(fehler.get(m) ?? []), tid]);
              // Nach 5 gleichen Fehlern ohne einen Erfolg abbrechen (Seite anders aufgebaut als erwartet)
              if (gelesen === 0 && [...fehler.values()].reduce((n, x) => n + x.length, 0) >= 5) break;
            }
          }
        },
        opt,
      );
      teile.push(`Kaderseiten: ${gelesen} von ${fehlen.length} gelesen.`);
      for (const [m, tids] of fehler) teile.push(`${tids.length}× „${m}“ (z. B. tid ${tids[0]}).`);
    }

    // 4. Speichern (Aufstellungen und Wechsel), dann alle Spiele mit den aktuellen Kaderwerten neu berechnen
    let gespeichert = 0;
    for (const [mid, sp] of xml) {
      const a = auftraege.get(mid)!;
      if (!sp.teams.some((t) => t.id === a.tidA)) continue;
      speichereWertSpiel(db, werteWertSpiel(sp, a.tidA, a.wettbewerb, () => undefined));
      gespeichert++;
    }
    const neu = wertSpieleNeuBerechnen(db);
    const vollstaendig = (db.prepare("SELECT COUNT(*) AS n FROM wert_spiel WHERE fehlende_werte = 0").get() as { n: number }).n;
    teile.push(`${gespeichert} Spiele neu gespeichert, ${neu} berechnet, davon ${vollstaendig} mit allen Marktwerten.`);
  } catch (e) {
    ok = false;
    teile.push(meldungAus(e));
  }
  marke(false);
  const meldung = `Wertbereich-Scan: ${teile.join(" ")}`;
  abrufBeenden(db, log, ok, meldung);
  return { ok, meldung };
}

// Wöchentlich (wie die Top-10-Listen), danach nur neue Spiele
export function wertScanFaellig(db: Database.Database, jetzt = new Date()): boolean {
  if (!zugangStatus(db).eingerichtet) return false;
  const l = letzterAbruf(db, "wertscan");
  return !l || jetzt.getTime() - new Date(l.gestartet).getTime() > 7 * 86_400_000;
}
