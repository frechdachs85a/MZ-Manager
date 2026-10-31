import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { heuteInBerlin } from "@/lib/format";
import { formation } from "@/lib/mz/analyse/gegner";
import { erzeugeTaktik } from "@/lib/mz/taktik/erzeugen";
import { portfolioAnalyse, regelcheck, stilSchluessel, type StilEintrag } from "@/lib/portfolio";
import { istAussen, STURM_Y } from "@/lib/mz/taktik/pruefer";
import { archivLaden } from "@/lib/taktik-archiv";
import { istAltersreiter, ladeEditorReiter } from "@/lib/db/taktik";
import { spiegelX } from "@/lib/mz/taktik/gegner-gewichte";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

// Portfolio-Plan (Marcus, 30.10.2026: die Reiter sollen ein Portfolio sein, optimal für dein Team und abwechslungsreich,
// damit es gegen jeden Gegnertyp eine gute Antwort gibt). Täglich aus dem Archiv und den Top-10-Spielen:
// 1. Doppelte: Reiter mit gleicher Aufstellung und Einstellung (identisch) oder gleichem Stil (Formation, Taktik,
//    Spielweise) wie ein anderer Reiter. Behalten wird der zuerst gespeicherte.
// 2. Lücken: bei den Top 10 bewährte Stile gegen eine Gegnerklasse (portfolio.ts), die kein Reiter abdeckt, oder die dort
//    mindestens BESSER (Punktquote) bringen als der beste Stil, den du schon hast (eigene Setzung, keine MZ-Regel).
// 3. Vorschlag: doppelte Reiter damit füllen. Reihum je Gegnerklasse ein Stil, wichtigste Klasse zuerst (meiste
//    Top-10-Spiele), Lücken vor Verbesserungen, jeder Stil nur einmal. Besetzung: deine beste aufstellbare Elf auf den
//    Plätzen des Topteams (erzeugen.ts).
// 4. Namen (Marcus, 31.10.2026: der Name soll sagen, was im Reiter steckt): neuer Stil bekommt einen Namen nach dem
//    Schema Formation + Taktik + Spielweise, z. B. 532flo = 5-3-2 Flügel offensiv (NAME_MAX Zeichen, Grenze des Editors).
// 5. Sinnhaftigkeit: verspricht der Name etwas anderes als der Inhalt (Formation, Taktik, Spielweise, Seite bei
//    außenR/außenL), wird ein passender Name vorgeschlagen. Hinweise ohne Umbenennen: Stil bei den Top 10 nicht belegt,
//    Startaufstellung verstößt gegen die Prüfliste.
// 6. Seitenvarianten (Marcus, 31.10.2026): mal über rechts, mal über links angreifen, damit sich der Gegner nicht auf eine
//    Seite einstellen kann. Hat ein Reiter seine Eckstürmer nur auf einer Seite und gibt es keinen Reiter mit gleichem Stil
//    auf der anderen Seite, wird die gespiegelte Fassung vorgeschlagen (auf einem freien Reiter).
// Gespiegelte Reiter (außenR/außenL) sind eine gewollte Seitenvariante und werden nicht als frei gezählt.
// Quelle der Reiter: der zuletzt aus dem Editor gelesene Stand (editor-reiter.ts); nur Reiter, die es dort gibt.
// Altersreiter (Altersregler im Editor, z. B. U18 = 16 bis 18) sind eine Aufstellung für die Jugend, kein Stil: sie werden
// nicht verglichen, nicht überschrieben und nicht umbenannt; ihre Besetzung prüft der Taktik-Check (nur Spieler im Alter,
// Nr. 100 bis 150 zuerst). „Liga“, außenR, außenL und kupass werden nicht überschrieben und nicht umbenannt.
// Übernommen und umbenannt wird nur auf Klick (abruf/liga.ts).

export const JUGEND = /^u(18|21|23)\b/i;
export const BESSER = 0.1;
export const SPIEGEL_TOLERANZ = 6; // Punkte (eigene Setzung)
// außenR und kupass nennt die Faustregel (mz-wissen.md, Abschnitt 10) und die Scoutauswertung beim Namen: bleiben
const FEST = /^(liga|außenr|außenl|kupass)$/i;
// Reiter mit Zweck statt Stil im Namen (Freundschaftsspiel) zuletzt überschreiben
const ZWECK = /^freund/i;
// Namensfeld im Editor: maxlength 6 (tactics.js, renameTactic, gelesen 31.10.2026)
export const NAME_MAX = 6;
const TAKTIK_KURZ: Record<string, string> = { wings: "fl", shortpass: "kp", longball: "lb" };
const SPIEL_KURZ: Record<string, string> = { offensive: "o", defensive: "d", normal: "" };

// "4-3-3 wings/offensive" (auch "4-3-3 oder 4-2-4 wings/offensive") zerlegen
function stilTeile(schluessel: string) {
  const m = schluessel.match(/^(\d(?:-\d)+)(?: oder (\d(?:-\d)+))? (\S+)\/(\S+)$/);
  return m ? { formationen: [m[1], m[2]].filter(Boolean).map((f) => f.replace(/-/g, "")), tactics: m[3], playstyle: m[4] } : null;
}

// Name nach dem Schema Formation + Taktik + Spielweise, eindeutig unter den belegten Namen (ohne Groß/Klein)
export function nameFuer(schluessel: string, belegt: Iterable<string>): string {
  const t = stilTeile(schluessel);
  const basis = (t ? `${t.formationen[0]}${TAKTIK_KURZ[t.tactics] ?? ""}${SPIEL_KURZ[t.playstyle] ?? ""}` : "neu").slice(0, NAME_MAX);
  const frei = new Set([...belegt].map((n) => n.toLowerCase()));
  if (!frei.has(basis.toLowerCase())) return basis;
  for (let i = 2; i <= 9; i++) {
    const n = `${basis.slice(0, NAME_MAX - 1)}${i}`;
    if (!frei.has(n.toLowerCase())) return n;
  }
  return basis;
}

// Was der Name verspricht und was drin ist; Liste der Widersprüche (leer = Name passt oder sagt nichts aus)
export function nameWiderspruch(name: string, schluessel: string, feld: { x: number; y: number }[]): string[] {
  const t = stilTeile(schluessel);
  if (!t) return [];
  const w: string[] = [];
  const n = name.toLowerCase();
  const ziffern = n.match(/^(\d{3,5})/)?.[1];
  // 3 Ziffern = Abwehr-Mitte-Sturm; 4 oder 5 Ziffern (z. B. 3313) feiner: dann Abwehr (erste) und Sturm (letzte) vergleichen
  const passt = (z: string) => t.formationen.some((f) => (z.length === 3 ? f === z : z[0] === f[0] && z.at(-1) === f.at(-1)));
  if (ziffern && !passt(ziffern)) w.push(`Name sagt ${ziffern.split("").join("-")}, aufgestellt ist ${t.formationen[0].split("").join("-")}`);
  const rest = ziffern ? n.slice(ziffern.length) : "";
  const spielweise = /^(of|o)$|(fl|kp|lb)o$/.test(rest) ? "offensive" : /^(de|d)$|(fl|kp|lb)d$/.test(rest) ? "defensive" : undefined;
  if (spielweise && t.playstyle !== spielweise) w.push(`Name sagt ${spielweise === "offensive" ? "offensiv" : "defensiv"}, eingestellt ist ${t.playstyle}`);
  const taktik = /kupass|^\d{3,5}kp/.test(n) ? "shortpass" : /^\d{3,5}fl/.test(n) ? "wings" : /^\d{3,5}lb/.test(n) ? "longball" : undefined;
  if (taktik && t.tactics !== taktik) w.push(`Name sagt ${taktik}, eingestellt ist ${t.tactics}`);
  const seite = n.match(/^au(?:ß|ss)en([rl])$/)?.[1];
  if (seite) {
    const ecke = feld.filter((p) => p.y <= STURM_Y && istAussen(p.x));
    const passt = ecke.some((p) => (seite === "r" ? p.x >= 104 : p.x < 104));
    if (!passt) w.push(ecke.length ? `Name sagt Eckstürmer ${seite === "r" ? "rechts" : "links"}, er steht ${seite === "r" ? "links" : "rechts"}` : `Name sagt Eckstürmer ${seite === "r" ? "rechts" : "links"}, es gibt keinen`);
  }
  return w;
}

type StilKurz = { schluessel: string; quote: number; spiele: number };
// reiter: Reiter mit einem bewährten Stil der Klasse; dein: dein bester Stil gegen die Klasse (auch nicht bewährt)
export type Abdeckung = { klasse: string; spiele: number; reiter: string[]; bester?: StilKurz; dein?: StilKurz };
export type PortfolioVorschlag = {
  reiter: string; // wird überschrieben
  grund: string; // warum dieser Reiter frei ist
  klasse: string;
  statt?: StilKurz; // dein bisher bester Stil gegen die Klasse (bei einer Verbesserung)
  stil: string;
  quote: number;
  spiele: number;
  teams: string[];
  name: string; // neuer Name des Reiters
  art: "stil" | "seite"; // neuer Stil oder gespiegelte Fassung eines Reiters (Seitenvariante)
  vorlage?: string; // bei "seite": der Reiter, der gespiegelt wird
  xml: string;
  summe: number; // MZ-Wert der Elf
};
export type Sinn = { reiter: string; stil: string; probleme: string[]; name?: string; hinweise: string[] };
export type PortfolioPlan = {
  doppelt: { reiter: string; wie: string; art: "identisch" | "gespiegelt" | "gleicher Stil" }[];
  abdeckung: Abdeckung[];
  vorschlaege: PortfolioVorschlag[];
  sinn: Sinn[];
  jugend: string[]; // Altersreiter (nur Besetzung, siehe Taktik-Check)
  editorStand?: string; // wann die Reiter zuletzt aus dem Editor gelesen wurden
};

// Seite der Eckstürmer (Sturm außen): "rechts", "links", "beide" oder null (keine)
export function eckSeite(feld: { x: number; y: number }[]): "rechts" | "links" | "beide" | null {
  const ecke = feld.filter((p) => p.y <= STURM_Y && istAussen(p.x));
  const r = ecke.some((p) => p.x >= 104);
  const l = ecke.some((p) => p.x < 104);
  return r && l ? "beide" : r ? "rechts" : l ? "links" : null;
}

// Feldspieler einer Taktik-XML spiegeln (x, x1, x2 -> 208 − x), alles andere bleibt
export function spiegelXml(xml: string): string {
  return xml.replace(/<Pos\b[^>]*\/?>/g, (zeile) => {
    if (!/\spos="normal"/.test(zeile)) return zeile;
    return zeile.replace(/(\sx[12]?=")(-?\d+(?:\.\d+)?)(")/g, (_, a: string, v: string, b: string) => `${a}${spiegelX(Number(v))}${b}`);
  });
}

const prozent = (q: number) => `${Math.round(q * 100)} %`;

export function portfolioPlan(db: Database.Database): PortfolioPlan {
  const editor = ladeEditorReiter(db);
  const imEditor = (r: string) => !editor || editor.reiter.some((e) => e.name.toLowerCase() === r.toLowerCase());
  const altersreiter = (r: string) => {
    const e = editor?.reiter.find((x) => x.name.toLowerCase() === r.toLowerCase());
    return e ? istAltersreiter(e) : JUGEND.test(r);
  };
  const alle = archivLaden(db)
    .filter((a) => a.taktik && imEditor(a.reiter) && !/^liga$/i.test(a.reiter))
    .sort((a, b) => a.gespeichert.localeCompare(b.gespeichert));
  const jugend = alle.filter((a) => altersreiter(a.reiter)).map((a) => a.reiter);
  const archiv = alle.filter((a) => !altersreiter(a.reiter));
  const p = portfolioAnalyse(db);

  // 1. Doppelte
  const doppelt: PortfolioPlan["doppelt"] = [];
  const signatur = new Map<string, string>();
  const stil = new Map<string, string>();
  const stilJe = new Map<string, string>();
  // Gespiegelt: gleiche Einstellungen, jeder Platz liegt bis auf SPIEGEL_TOLERANZ Punkte auf einem gespiegelten Platz (x -> 208 − x)
  const gesehen: { reiter: string; t: NonNullable<(typeof archiv)[number]["taktik"]> }[] = [];
  const spiegelVon = (t: NonNullable<(typeof archiv)[number]["taktik"]>) =>
    gesehen.find(
      (g) =>
        g.t.team.tactics === t.team.tactics &&
        g.t.team.playstyle === t.team.playstyle &&
        g.t.pos.length === t.pos.length &&
        t.pos.some((x) => Math.abs(x.start.x - 104) > SPIEGEL_TOLERANZ) &&
        (() => {
          // nur die Plätze (Spieler dürfen auf der anderen Seite andere sein), jeder Platz höchstens einmal
          const frei = [...g.t.pos];
          return t.pos.every((x) => {
            const i = frei.findIndex((q) => q.pos === x.pos && Math.hypot(208 - x.start.x - q.start.x, x.start.y - q.start.y) <= SPIEGEL_TOLERANZ);
            if (i < 0) return false;
            frei.splice(i, 1);
            return true;
          });
        })(),
    )?.reiter;
  for (const a of archiv) {
    const t = a.taktik!;
    const sig = JSON.stringify([t.team.tactics, t.team.playstyle, t.team.aggression, t.pos.map((x) => `${x.pid}@${Math.round(x.start.x / 5)},${Math.round(x.start.y / 5)}`).sort()]);
    const st = stilSchluessel(formation(t.pos.filter((x) => x.pos === "normal").map((x) => x.start)).text, t.team.tactics, t.team.playstyle);
    stilJe.set(a.reiter, st);
    if (signatur.has(sig)) doppelt.push({ reiter: a.reiter, wie: signatur.get(sig)!, art: "identisch" });
    else if (spiegelVon(t)) doppelt.push({ reiter: a.reiter, wie: spiegelVon(t)!, art: "gespiegelt" });
    else if (stil.has(st)) doppelt.push({ reiter: a.reiter, wie: stil.get(st)!, art: "gleicher Stil" });
    if (!signatur.has(sig)) signatur.set(sig, a.reiter);
    if (!stil.has(st)) stil.set(st, a.reiter);
    gesehen.push({ reiter: a.reiter, t });
  }

  // 2. Abdeckung je Gegnerklasse (bewährte Stile, die ein Reiter abdeckt)
  const kurzStil = (x?: StilEintrag): StilKurz | undefined => (x ? { schluessel: x.schluessel, quote: x.quote, spiele: x.spiele } : undefined);
  const abdeckung: Abdeckung[] = p.klassen.map((k) => {
    const bewaehrt = k.stile.filter((s) => s.bewaehrt);
    const dein = k.stile.filter((s) => s.imArchiv.length).sort((a, b) => b.quote - a.quote)[0];
    return { klasse: k.klasse, spiele: k.spiele, reiter: [...new Set(bewaehrt.flatMap((s) => s.imArchiv))], bester: kurzStil(bewaehrt[0]), dein: kurzStil(dein) };
  });

  // 3. Freie Reiter (doppelt, keine Jugend) mit Lücken und klar besseren Stilen füllen
  const frei = doppelt.filter((d) => d.art !== "gespiegelt" && !FEST.test(d.reiter)).sort((a, b) => Number(ZWECK.test(a.reiter)) - Number(ZWECK.test(b.reiter)) || (a.art === b.art ? 0 : a.art === "identisch" ? -1 : 1));
  const kandidaten = abdeckung
    .map((a) => ({
      a,
      stile: p.fehlend.filter((f) => f.klasse === a.klasse && (!a.reiter.length || !a.dein || f.quote >= a.dein.quote + BESSER)).sort((x, y) => y.quote - x.quote || y.spiele - x.spiele),
    }))
    .filter((k) => k.stile.length)
    .sort((x, y) => Number(!!x.a.reiter.length) - Number(!!y.a.reiter.length) || y.a.spiele - x.a.spiele);
  const luecken: (StilEintrag & { klasse: string; statt?: StilKurz })[] = [];
  const stileDrin = new Set<string>();
  for (let runde = 0; luecken.length < frei.length; runde++) {
    let neu = false;
    for (const k of kandidaten) {
      if (luecken.length >= frei.length) break;
      const s = k.stile.filter((x) => !stileDrin.has(x.schluessel))[0];
      if (!s || luecken.filter((l) => l.klasse === k.a.klasse).length > runde) continue;
      luecken.push({ ...s, statt: k.a.reiter.length ? k.a.dein : undefined });
      stileDrin.add(s.schluessel);
      neu = true;
    }
    if (!neu) break;
  }
  const kader = ladeKader(db);
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const vorschlaege: PortfolioVorschlag[] = [];
  const namen = new Set(archiv.map((a) => a.reiter));
  for (const [i, d] of frei.entries()) {
    const s = luecken[i];
    if (!s) break;
    const m = s.schluessel.match(/^\S+ (\S+)\/(\S+)$/);
    const kapitaen = Number(archiv.find((a) => a.reiter === d.reiter)?.taktik?.team.captain) || undefined;
    try {
      const e = erzeugeTaktik({ feld: s.beispiel.feld, torwart: s.beispiel.torwart, tactics: m?.[1], playstyle: m?.[2], aggression: s.haerte[0]?.[0], kader, spieltag, kapitaenPid: kapitaen });
      const name = nameFuer(s.schluessel, [...namen].filter((n) => n !== d.reiter));
      namen.add(name);
      vorschlaege.push({
        reiter: d.reiter,
        name,
        art: "stil",
        grund: d.art === "identisch" ? `identisch mit ${d.wie}` : `gleicher Stil wie ${d.wie}`,
        klasse: s.klasse,
        statt: s.statt,
        stil: s.schluessel,
        quote: s.quote,
        spiele: s.spiele,
        teams: s.teams,
        xml: e.xml,
        summe: e.summe,
      });
    } catch {
      // zu wenige aufstellbare Spieler: kein Vorschlag für diesen Reiter
    }
  }

  // 6. Seitenvarianten: einseitige Reiter ohne Gegenstück auf der anderen Seite
  const seiteJe = new Map(archiv.map((a) => [a.reiter, eckSeite(a.taktik!.pos.filter((x) => x.pos === "normal").map((x) => x.start))]));
  // Identische Kopien zählen nicht (sie sind frei und werden überschrieben)
  const kopien = new Set(doppelt.filter((d) => d.art === "identisch").map((d) => d.reiter));
  const ohneGegenstueck = archiv.filter((a) => {
    if (kopien.has(a.reiter)) return false;
    const seite = seiteJe.get(a.reiter);
    if (seite !== "rechts" && seite !== "links") return false;
    return !archiv.some((b) => b.reiter !== a.reiter && !kopien.has(b.reiter) && stilJe.get(b.reiter) === stilJe.get(a.reiter) && seiteJe.get(b.reiter) === (seite === "rechts" ? "links" : "rechts"));
  });
  const belegt = new Set(vorschlaege.map((v) => v.reiter));
  const nochFrei = frei.filter((d) => !belegt.has(d.reiter) && !ohneGegenstueck.some((o) => o.reiter === d.reiter));
  for (const [i, o] of ohneGegenstueck.entries()) {
    const d = nochFrei[i];
    if (!d) break;
    const andere = seiteJe.get(o.reiter) === "rechts" ? "L" : "R";
    const vergeben = (n: string) => [...namen].some((x) => x !== d.reiter && x.toLowerCase() === n.toLowerCase());
    const name = /^au(ß|ss)en[rl]$/i.test(o.reiter) && !vergeben(o.reiter.slice(0, -1) + andere)
      ? o.reiter.slice(0, -1) + andere
      : nameFuer(stilJe.get(o.reiter)!, [...namen].filter((n) => n !== d.reiter)).slice(0, NAME_MAX - 1) + andere;
    namen.add(name);
    vorschlaege.push({
      reiter: d.reiter,
      name,
      art: "seite",
      vorlage: o.reiter,
      grund: d.art === "identisch" ? `identisch mit ${d.wie}` : `gleicher Stil wie ${d.wie}`,
      klasse: "Seitenvariante",
      stil: stilJe.get(o.reiter)!,
      quote: 0,
      spiele: 0,
      teams: [],
      xml: spiegelXml(o.xml),
      summe: 0,
    });
  }

  // 5. Sinnhaftigkeit der übrigen Reiter
  const ueberschrieben = new Set(vorschlaege.map((v) => v.reiter));
  const ungenutzt = new Set(p.ungenutzt.map((u) => u.reiter));
  const sinn: Sinn[] = [];
  for (const a of archiv) {
    if (ueberschrieben.has(a.reiter) || JUGEND.test(a.reiter) || /^liga$/i.test(a.reiter)) continue;
    const st = stilJe.get(a.reiter)!;
    const feld = a.taktik!.pos.filter((x) => x.pos === "normal").map((x) => x.start);
    const probleme = nameWiderspruch(a.reiter, st, feld);
    const hinweise: string[] = [];
    if (ohneGegenstueck.some((o) => o.reiter === a.reiter) && !vorschlaege.some((v) => v.vorlage === a.reiter))
      hinweise.push(`Eckstürmer nur ${seiteJe.get(a.reiter)}: es fehlt die Fassung für die andere Seite (Gegner kann sich sonst auf eine Seite einstellen)`);
    if (p.spiele > 0 && ungenutzt.has(a.reiter)) hinweise.push(`Stil ${st} kommt bei den Top 10 nicht vor`);
    const rc = regelcheck(feld);
    if (rc.verstoesse.length) hinweise.push(`Prüfliste: ${rc.verstoesse.join(", ")}`);
    if (!probleme.length && !hinweise.length) continue;
    let name: string | undefined;
    // außenR und kupass behalten ihren Namen: widerspricht der Inhalt, ist eher der Archiv-Eintrag falsch
    const kopie = doppelt.find((d) => d.reiter === a.reiter && d.art === "identisch");
    // Identische Kopie: nicht umbenennen, sondern mit einem neuen Stil überschreiben (sobald es eine Lücke gibt)
    if (probleme.length && FEST.test(a.reiter)) hinweise.push("Name bleibt (Faustregel nutzt ihn); stimmt der Archiv-Eintrag? Reiter neu exportieren und einfügen");
    else if (probleme.length && kopie) hinweise.push(`identisch mit ${kopie.wie}: wird beim nächsten passenden Stil überschrieben statt umbenannt`);
    else if (probleme.length) {
      name = nameFuer(st, [...namen].filter((n) => n !== a.reiter));
      namen.add(name);
    }
    sinn.push({ reiter: a.reiter, stil: st, probleme, name, hinweise });
  }
  return { doppelt, abdeckung, vorschlaege, sinn, jugend, editorStand: editor?.stand };
}

export const vorschlagText = (v: PortfolioVorschlag) =>
  v.art === "seite"
    ? `${v.reiter} (${v.grund}) überschreiben mit ${v.vorlage} gespiegelt, neuer Name ${v.name}: Angriff über die andere Seite, damit sich der Gegner nicht auf eine Seite einstellen kann`
    : `${v.reiter} (${v.grund}) überschreiben mit ${v.stil}, neuer Name ${v.name}: bei den Top 10 gegen „${v.klasse}“ ${prozent(v.quote)} Punktquote in ${v.spiele} Spielen` +
  (v.statt ? ` (dein bisher bester Stil dort, ${v.statt.schluessel}: ${prozent(v.statt.quote)} in ${v.statt.spiele})` : " (bisher kein Reiter dafür)");
