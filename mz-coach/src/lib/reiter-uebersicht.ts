import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { startelfAusLetztemSpiel } from "@/lib/db/markt";
import { istAltersreiter, ladeEditorReiter, type EditorReiter } from "@/lib/db/taktik";
import { heuteInBerlin } from "@/lib/format";
import { formation } from "@/lib/mz/analyse/gegner";
import { schwachstellen } from "@/lib/mz/analyse/markt";
import { erzeugeTaktik } from "@/lib/mz/taktik/erzeugen";
import { bankMitWichtigen, FREUND, pruefeFreund, type FreundCheck, type Wichtig } from "@/lib/freund-check";
import { portfolioAnalyse, stilSchluessel } from "@/lib/portfolio";
import { JUGEND, nameFuer, NAME_MAX, portfolioPlan, type PortfolioPlan, type PortfolioVorschlag, type Sinn } from "@/lib/portfolio-plan";
import { archivLaden, type ArchivEintrag } from "@/lib/taktik-archiv";
import { checkKurz, taktikCheck, type TaktikCheck } from "@/lib/taktik-check";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

// Übersicht je Reiter für die Taktikseite (Marcus, 31.10.2026: dort deine Reiter automatisch aus dem Editor, dazu je
// Reiter die Verbesserungsvorschläge, ob alles abgedeckt ist, was weg kann, Spieler tauschen, Wechsel anders, U18 und freund,
// XML und Umbenennen mit Namensvorschlag). Alles nur Vorschlag; übernommen wird auf Klick.

export type ReiterArt = "offiziell" | "liga" | "jugend" | "freund" | "leer";
export type ReiterKarte = {
  slot?: string;
  name: string;
  art: ReiterArt;
  alter?: { von: number; bis: number };
  stil?: string;
  archiv?: ArchivEintrag;
  check?: TaktikCheck; // Besetzung und Wechsel (nicht bei Liga und freund)
  checkPunkte: string[];
  portfolio?: PortfolioVorschlag; // Vorschlag, diesen Reiter zu überschreiben
  sinn?: Sinn;
  doppelt?: PortfolioPlan["doppelt"][number];
  freund?: FreundCheck & { stilVorschlag?: { stil: string; xml: string; name: string; grund: string } };
  nameVorschlag?: string;
};

export type ReiterUebersicht = { karten: ReiterKarte[]; plan: PortfolioPlan; stand?: string; wichtig: Wichtig[] };

const stilVon = (a?: ArchivEintrag) =>
  a?.taktik
    ? stilSchluessel(formation(a.taktik.pos.filter((x) => x.pos === "normal").map((x) => x.start)).text, a.taktik.team.tactics, a.taktik.team.playstyle)
    : undefined;

export function reiterUebersicht(db: Database.Database): ReiterUebersicht {
  const editor = ladeEditorReiter(db);
  const archiv = archivLaden(db);
  const plan = portfolioPlan(db);
  const checks = taktikCheck(db);
  const kader = ladeKader(db);
  const spieltag = naechsterLigaspieltag(heuteInBerlin());

  // Wichtigste Spieler: Startelf des letzten Ligaspiels nach MZ-Wert
  const start = startelfAusLetztemSpiel(db);
  const wichtig: Wichtig[] = start
    ? schwachstellen(start.elf, kader)
        .liste.map((x) => ({ pid: x.spieler.pid, name: x.spieler.name, wert: x.wert, torwart: x.rolle === "TW" }))
        .sort((a, b) => b.wert - a.wert)
    : [];

  // Reiterliste: aus dem Editor, sonst aus dem Archiv
  const liste: (Pick<EditorReiter, "name"> & Partial<EditorReiter>)[] = editor ? editor.reiter : archiv.map((a) => ({ name: a.reiter }));
  const finde = (name: string) => archiv.find((a) => a.reiter.toLowerCase() === name.toLowerCase());
  const art = (r: (typeof liste)[number], a?: ArchivEintrag): ReiterArt =>
    !a && (r.spieler ?? 0) < 11
      ? "leer"
      : /^liga$/i.test(r.name)
        ? "liga"
        : (r.alterVon !== undefined && istAltersreiter(r as EditorReiter)) || JUGEND.test(r.name)
          ? "jugend"
          : FREUND.test(r.name)
            ? "freund"
            : "offiziell";
  const offizielleStile = liste
    .filter((r) => art(r, finde(r.name)) === "offiziell")
    .map((r) => ({ reiter: r.name, stil: stilVon(finde(r.name)) }))
    .filter((x): x is { reiter: string; stil: string } => !!x.stil);
  const namen = liste.map((r) => r.name);

  const karten = liste.map((r): ReiterKarte => {
    const a = finde(r.name);
    const k: ReiterKarte = {
      slot: r.slot,
      name: r.name,
      art: art(r, a),
      alter: r.alterVon !== undefined ? { von: r.alterVon, bis: r.alterBis! } : undefined,
      stil: stilVon(a),
      archiv: a,
      checkPunkte: [],
    };
    const c = checks.find((x) => x.reiter.toLowerCase() === r.name.toLowerCase());
    if (c && k.art !== "freund") {
      k.check = c;
      k.checkPunkte = checkKurz(c);
    }
    k.portfolio = plan.vorschlaege.find((v) => v.reiter.toLowerCase() === r.name.toLowerCase());
    k.sinn = plan.sinn.find((s) => s.reiter.toLowerCase() === r.name.toLowerCase());
    k.doppelt = plan.doppelt.find((d) => d.reiter.toLowerCase() === r.name.toLowerCase());
    k.nameVorschlag = k.portfolio?.name ?? k.sinn?.name;

    if (k.art === "freund" && a?.taktik && k.stil) {
      const f = pruefeFreund({ reiter: r.name, xml: a.xml, stil: k.stil, offizielleStile, wichtig, kader, spieltag });
      let stilVorschlag: NonNullable<ReiterKarte["freund"]>["stilVorschlag"];
      if (offizielleStile.some((o) => o.stil === k.stil)) {
        // Anderer Stil: bei den Top 10 bewährt, in keinem offiziellen Reiter; am häufigsten belegt zuerst
        const belegt = new Set(offizielleStile.map((o) => o.stil));
        const s = portfolioAnalyse(db)
          .klassen.flatMap((kl) => kl.stile.filter((x) => x.bewaehrt && !belegt.has(x.schluessel)))
          .sort((x, y) => y.spiele - x.spiele || y.quote - x.quote)[0];
        if (s) {
          const m = s.schluessel.match(/^\S+(?: oder \S+)? (\S+)\/(\S+)$/);
          try {
            const ohne = kader.filter((x) => !wichtig.slice(0, a.taktik!.subs.length).some((w) => w.pid === x.pid));
            const e = erzeugeTaktik({
              feld: s.beispiel.feld,
              torwart: s.beispiel.torwart,
              tactics: m?.[1],
              playstyle: m?.[2],
              aggression: s.haerte[0]?.[0],
              kader: ohne,
              spieltag,
            });
            stilVorschlag = {
              stil: s.schluessel,
              xml: bankMitWichtigen(e.xml, wichtig.slice(0, a.taktik!.subs.length)),
              name: nameFuer(
                s.schluessel,
                namen.filter((n) => n !== r.name),
              ),
              grund: `bei den Top 10 bewährt (${Math.round(s.quote * 100)} % in ${s.spiele} Spielen), in keinem offiziellen Reiter`,
            };
          } catch {
            // zu wenige Spieler ohne die wichtigsten: kein Stilvorschlag
          }
        }
      }
      k.freund = { ...f, stilVorschlag };
    }
    return k;
  });
  return { karten, plan, stand: editor?.stand, wichtig };
}

export const nameErlaubt = (neu: string, alt: string, namen: string[]) => {
  const n = neu.trim();
  if (!n) return "Name fehlt.";
  if (n.length > NAME_MAX) return `Höchstens ${NAME_MAX} Zeichen.`;
  if (namen.some((x) => x !== alt && x.toLowerCase() === n.toLowerCase())) return `„${n}“ gibt es schon.`;
  return null;
};
