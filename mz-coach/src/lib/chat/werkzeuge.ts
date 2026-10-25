import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ladeFreundTeam } from "@/lib/db/freunde";
import { listeEchteGegner } from "@/lib/db/gegner";
import { ladeKader } from "@/lib/db/kader";
import { ladeAblehnungen, ladeLetzteSuche, ladeMarktRahmen, startelfAusLetztemSpiel } from "@/lib/db/markt";
import { ladeSpiel, listeSpiele } from "@/lib/db/spiele";
import { ladeTopTeams } from "@/lib/db/top";
import { gegnerAnalyseLaden } from "@/lib/gegner-analyse";
import { jugendAuswertung } from "@/lib/jugend";
import { bewerteMarkt, schwachstellen } from "@/lib/mz/analyse/markt";
import { einsatzImLigaspiel } from "@/lib/mz/einsatz";
import { alleMzWerte, POSITIONEN } from "@/lib/mz/formel";
import { LIGA_MID_AB } from "@/lib/mz/parser/spielliste";
import { saisonAuswertung } from "@/lib/saison";
import { archivLaden, spieleJeTaktik, taktikZuordnen } from "@/lib/taktik-archiv";
import { eigenerVerlauf, gegnerVerlauf } from "@/lib/mz/analyse/verlauf";
import { topAuswertung } from "@/lib/top-auswertung";
import { portfolioAnalyse } from "@/lib/portfolio";
import { heuteInBerlin } from "@/lib/format";
import { naechsterLigaspieltag, TEAM } from "@/lib/wissen/startbasis";

// Werkzeuge für den Chat. Alle nur lesend auf der eigenen Datenbank, keins ruft ManagerZone auf
// oder ändert etwas. Antworten als JSON-Text; fehlende Daten werden als solche gemeldet.

type Werkzeug = { def: Anthropic.Beta.Messages.BetaTool; run: (db: Database.Database, input: Record<string, unknown>) => unknown };

const ohneEingabe = { type: "object" as const, properties: {}, additionalProperties: false };

const mzWerte = (skills: Parameters<typeof alleMzWerte>[0]) =>
  Object.fromEntries(POSITIONEN.map((p) => {
    const w = alleMzWerte(skills)[p];
    return [p, w.ok ? w.wert : null];
  }));

const WERKZEUGE: Werkzeug[] = [
  {
    def: {
      name: "kader",
      description:
        "Alle aktiven Spieler von FC Toho: Nr, Name, Alter, Marktwert, Nationalität, Status (Kegel/aufstellbar, Trainingslager, verletzt, gesperrt), Einsatzbereitschaft fürs nächste Ligaspiel und MZ-Wert je Position (null = Skills fehlen).",
      input_schema: ohneEingabe,
    },
    run: (db) => {
      const kader = ladeKader(db);
      const spieltag = naechsterLigaspieltag(heuteInBerlin());
      return {
        naechsterLigaspieltag: spieltag.toISOString().slice(0, 10),
        spieler: kader.map((s) => ({
          pid: s.pid,
          nr: s.nr,
          name: s.name,
          alter: s.alter,
          marktwert: s.marktwert,
          nationalitaet: s.nationalitaet,
          arbeitsbewilligung: s.arbeitsbewilligung,
          status: s.status,
          einsatz: einsatzImLigaspiel(s, spieltag).text,
          mzWert: mzWerte(s.skills),
        })),
      };
    },
  },
  {
    def: {
      name: "spieler",
      description: "Alle Details eines eigenen Spielers: jeder Skill mit Wert, ausgemaxt ja/nein, Scout-Sterne und Markierungen, Sperren, Trainingslager. Suche über Name (Teil reicht) oder pid.",
      input_schema: {
        type: "object",
        properties: { suche: { type: "string", description: "Name oder pid" } },
        required: ["suche"],
        additionalProperties: false,
      },
    },
    run: (db, input) => {
      const q = String(input.suche ?? "").toLowerCase();
      const treffer = ladeKader(db).filter((s) => String(s.pid) === q || s.name.toLowerCase().includes(q));
      return treffer.length ? treffer.map((s) => ({ ...s, mzWert: mzWerte(s.skills) })) : { fehler: `Kein Spieler zu „${input.suche}“.` };
    },
  },
  {
    def: {
      name: "spiele",
      description: "Liste aller gespeicherten Spiele (eigene und fremde) mit Datum, Teams und Ergebnis.",
      input_schema: ohneEingabe,
    },
    run: (db) => listeSpiele(db, 200),
  },
  {
    def: {
      name: "spiel",
      description: "Ein gespeichertes Spiel aus der Stats-XML: Teams mit Taktik/Spielweise/Härte und Statistik, Aufstellung in Editor-Koordinaten, Tore, Wechsel, Taktikwechsel, Karten, und der Verlauf der Aufstellung (eigenes Team mit dem Taktik-Export verknüpft inkl. Alternativ-Aufstellungen und Regeln; Gegner: Eingewechselter auf dem Platz des Ausgewechselten, abgeleitet; Formationswechsel des Gegners nicht erkennbar).",
      input_schema: {
        type: "object",
        properties: { mid: { type: "integer", description: "Spielnummer" } },
        required: ["mid"],
        additionalProperties: false,
      },
    },
    run: (db, input) => {
      const s = ladeSpiel(db, Number(input.mid));
      if (!s) return { fehler: `Spiel ${input.mid} ist nicht gespeichert.` };
      // Verlauf der Aufstellung: eigenes Team mit Taktik-Export verknüpft, Gegner abgeleitet
      const archiv = archivLaden(db);
      const z = s.teams.some((t) => t.id === TEAM.tid) ? taktikZuordnen(s, archiv) : null;
      const taktik = z ? archiv.find((a) => a.reiter === z.reiter)?.taktik : null;
      const verlauf = s.teams.map((t) => {
        const v = t.id === TEAM.tid && taktik ? eigenerVerlauf(s, taktik, t.id) : gegnerVerlauf(s, t.id);
        return { team: t.name, taktikReiter: t.id === TEAM.tid ? z?.reiter ?? null : undefined, hinweise: v.hinweise, phasen: v.phasen.map(({ aufstellung, ...p }) => ({ ...p, aufstellung: aufstellung.map((a) => ({ name: a.name, x: a.x, y: a.y, quelle: a.quelle })) })) };
      });
      return { ...s, verlauf };
    },
  },
  {
    def: {
      name: "gegner",
      description:
        "Gegneranalyse aus den letzten 8 gespeicherten Ligaspielen eines Teams: spielt er gleich oder wechselnd, Formationen, Einstellungen, Wechsel, Regelmuster als Sätze (Wechsel- und Taktikregeln nach Minute und Spielstand), Bilanz und Taktikempfehlung. Ohne tid: Liste der eingelesenen Gegner.",
      input_schema: {
        type: "object",
        properties: { tid: { type: "integer", description: "Team-ID des Gegners (optional)" } },
        additionalProperties: false,
      },
    },
    run: (db, input) => {
      if (!input.tid) {
        return listeEchteGegner(db, LIGA_MID_AB, new Set([...ladeTopTeams(db).map((t) => t.tid), TEAM.tid]));
      }
      const g = gegnerAnalyseLaden(db, Number(input.tid));
      if (!g.spiele.length) return { fehler: `Zu tid ${input.tid} ist keine Spielliste gespeichert.` };
      return { name: g.name, ligaspieleBetrachtet: g.liga.length, mitXml: g.stats.length, analyse: g.analyse, regelmuster: g.regeln.map((r) => r.text) };
    },
  },
  {
    def: {
      name: "taktiken",
      description: "Taktik-Archiv: gespeicherte Reiter mit Einstellungen, Prüfergebnis gegen den aktuellen Kader (Fehler und Hinweise) und den eigenen Spielen, die mit der Taktik gespielt wurden.",
      input_schema: ohneEingabe,
    },
    run: (db) => {
      const archiv = archivLaden(db);
      const spiele = spieleJeTaktik(db, archiv);
      return archiv.map((a) => ({
        reiter: a.reiter,
        gespeichert: a.gespeichert,
        einstellungen: a.taktik?.team,
        xmlFehler: a.xmlFehler,
        pruefung: a.pruefung,
        spiele: spiele.get(a.reiter) ?? [],
      }));
    },
  },
  {
    def: {
      name: "markt",
      description:
        "Transfermarkt: Schwachstellen der Startelf (MZ-Wert je Startplatz), Rahmen (Saldo, Ausländer, Arbeitsbewilligungen), aktuelle Empfehlung mit Gründen, weitere Kandidaten, Ausschlussgründe und abgelehnte Spieler.",
      input_schema: ohneEingabe,
    },
    run: (db) => {
      const kader = ladeKader(db);
      const start = startelfAusLetztemSpiel(db);
      const schwach = start ? schwachstellen(start.elf, kader) : null;
      const suche = ladeLetzteSuche(db);
      const rahmen = ladeMarktRahmen(db);
      const abgelehnt = ladeAblehnungen(db);
      const freund = ladeFreundTeam(db);
      const r = rahmen?.werte;
      const ergebnis =
        schwach && suche && r
          ? bewerteMarkt(suche.spieler, schwach.liste, {
              kapital: r.kapital,
              auslaenderFrei: r.auslaenderMax - r.auslaender,
              bewilligungenFrei: r.bewilligungenMax - r.bewilligungen,
              abgelehnt: new Set(abgelehnt.map((a) => a.pid)),
              eigene: new Set(kader.map((s) => s.pid)),
              gesperrteTeams: new Set(freund ? [freund.tid] : []),
            })
          : null;
      const kurz = (b: NonNullable<typeof ergebnis>["empfehlung"]) =>
        b && { name: b.kandidat.name, pid: b.kandidat.pid, alter: b.kandidat.alter, nationalitaet: b.kandidat.nationalitaet, rolle: b.ziel.rolle, ersetzt: b.ziel.spieler.name, gewinn: b.gewinn, preis: b.preis, gruende: b.gruende, vorbehalte: b.vorbehalte };
      return {
        startelfAus: start?.spiel,
        schwachstellen: schwach?.liste.map((s) => ({ rolle: s.rolle, spieler: s.spieler.name, wert: s.wert, x: s.slot.x, y: s.slot.y })),
        rahmen: rahmen ?? "nicht eingetragen",
        letzteSuche: suche ? { zeit: suche.zeit, spieler: suche.spieler.length } : "noch keine Marktsuche",
        empfehlung: ergebnis ? kurz(ergebnis.empfehlung) ?? "kein passender Spieler" : "nicht verfügbar (Rahmen oder Suche fehlt)",
        weitere: ergebnis?.weitere.map(kurz),
        ausgeschlossen: ergebnis?.ausgeschlossen,
        abgelehnt,
      };
    },
  },
  {
    def: {
      name: "top10",
      description:
        "Muster der Top 10 der Managerwertung aus ihren gespeicherten Liga- und Weltligaspielen: Startstile, Regelwechsel-Minuten, Taktikwechsel nach Spielstand, Regelmuster als Sätze (wer wann bei welchem Spielstand gewechselt wird, wann auf welche Einstellung umgestellt wird, für welche Lage sehr wahrscheinlich keine Regel existiert; Rolle des Einwechslers und Formationswechsel sind nicht erkennbar), Bilanz gegen Gegnerklassen und eine Matrix Stil gegen Gegnerklasse.",
      input_schema: ohneEingabe,
    },
    run: (db) => topAuswertung(db),
  },
  {
    def: {
      name: "portfolio",
      description:
        "Taktik-Portfolio: welche Stile (Formation, Taktik, Spielweise) die Top 10 gegen welche Gegnerklasse (Fünferkette, enge Mitte, mit Außenspielern) spielen, mit Bilanz und Punktquote, ob du den Stil im Archiv hast, und bewährte Stile, die dir fehlen (mit echter Beispiel-Startaufstellung eines Topteams und Regel-Kurzcheck). Grundlage für Taktikvorschläge und neue Taktiken.",
      input_schema: ohneEingabe,
    },
    run: (db) => {
      const p = portfolioAnalyse(db);
      return {
        spiele: p.spiele,
        fehlend: p.fehlend,
        klassen: p.klassen.map((k) => ({ klasse: k.klasse, spiele: k.spiele, stile: k.stile.map(({ beispiel, ...rest }) => ({ ...rest, beispielSpiel: { team: beispiel.team, mid: beispiel.mid, tore: beispiel.tore } })) })),
        ohneBelegBeiTop10: p.ungenutzt,
      };
    },
  },
  {
    def: {
      name: "saison",
      description: "Eigene Ligaspiele dieser Saison: Bilanz, Tore, Ballbesitz, Schüsse, Formkurve, Torschützen und Vorlagengeber.",
      input_schema: ohneEingabe,
    },
    run: (db) => saisonAuswertung(db),
  },
  {
    def: {
      name: "jugend",
      description: "Jugend nach der Regel von Marcus: Talente Nr. 100 bis 110, Ersetzen-Reihenfolge ab Nr. 195 (nur 4/1 oder 4/2 behalten), Scout-Sterne und Training.",
      input_schema: ohneEingabe,
    },
    run: (db) => {
      const j = jugendAuswertung(ladeKader(db));
      const k = (x: (typeof j.talente)[number]) => ({ nr: x.s.nr, name: x.s.name, alter: x.s.alter, scout: x.sterne, einstufung: x.einstufung, regelOk: x.regelOk, training: x.s.scoutTraining, besterWert: x.besterWert });
      return { talente: j.talente.map(k), ersetzenReihenfolge: j.ersetzen.map(k), weitere: j.weitere.map(k) };
    },
  },
  {
    def: {
      name: "wissen",
      description:
        "Die Wissensbasis mz-wissen.md von Marcus: Datenquellen, Koordinaten, Editor-Regeln, Prüfliste, MZ-Formel, Spieler-Regeln, Taktik-Reiter, Erkenntnisse der Top 10, Faustregeln Gegneranalyse, Kaderkurzfassung. Ohne abschnitt: Inhaltsverzeichnis.",
      input_schema: {
        type: "object",
        properties: { abschnitt: { type: "integer", description: "Abschnittsnummer 1 bis 11" } },
        additionalProperties: false,
      },
    },
    run: (_db, input) => {
      const text = readFileSync(join(process.cwd(), "mz-wissen.md"), "utf8");
      const teile = text.split(/^## /m);
      if (input.abschnitt === undefined) return teile.slice(1).map((t) => t.split("\n")[0]);
      const t = teile.find((x) => x.startsWith(`${input.abschnitt}.`));
      return t ? `## ${t}` : { fehler: `Abschnitt ${input.abschnitt} gibt es nicht.` };
    },
  },
];

export const WERKZEUG_DEFS = WERKZEUGE.map((w) => w.def);

export function werkzeugAusfuehren(db: Database.Database, name: string, input: unknown): { text: string; fehler: boolean } {
  const w = WERKZEUGE.find((x) => x.def.name === name);
  if (!w) return { text: `Unbekanntes Werkzeug ${name}.`, fehler: true };
  try {
    const eingabe = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    return { text: JSON.stringify(w.run(db, eingabe)), fehler: false };
  } catch (e) {
    return { text: e instanceof Error ? e.message : String(e), fehler: true };
  }
}
