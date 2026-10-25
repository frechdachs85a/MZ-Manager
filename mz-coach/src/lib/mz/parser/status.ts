import { parse, type HTMLElement } from "node-html-parser";
import type { Skill } from "@/lib/mz/skills";
import type { Sperre, TrainingslagerInfo } from "@/lib/mz/spieler";
import { KaderSeiteUnbekannt, serverzeit, SKILL_SPALTEN } from "./kader";
import { parseSpielerBlock, type SpielerBlock } from "./spielerblock";

// Parser für die Status-Seiten. Aufbau an den echten Seiten vom 24.10.2026 geprüft
// (docs/mz-seiten.md). Was dort nicht zu sehen war, wird als unbekannt (null) gemeldet.

function text(el: HTMLElement | null | undefined): string {
  return (el?.text ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function pidAus(a: HTMLElement | null): number | undefined {
  const pid = new URLSearchParams((a?.getAttribute("href") ?? "").split("?")[1] ?? "").get("pid");
  return pid && /^\d+$/.test(pid) ? Number(pid) : undefined;
}

const zahl = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : undefined);

// Direkte Zellen einer Zeile (die erste Zelle enthält zusätzlich eine Mobil-Liste mit dd/span).
function zellen(tr: HTMLElement): HTMLElement[] {
  return tr.childNodes.filter((n): n is HTMLElement => (n as HTMLElement).tagName === "TD");
}

// ---------- ?p=players&sub=unavailable ----------

export type UnavailableSeite = {
  // null = Abschnitt nicht in bekanntem Aufbau (z. B. Verletztenliste mit Einträgen, noch nie gesehen)
  verletzte: { pid: number; name: string }[] | null;
  sperren: (Sperre & { pid: number; name: string })[] | null;
  serverzeit?: string;
};

// #squad_unavailable gibt es als leeren Reiter auch auf anderen Spielerseiten, daher zusätzlich
// die Überschrift "Verletzungen" verlangen.
export function istUnavailableSeite(html: string): boolean {
  return /id="squad_unavailable"/.test(html) && /<h3>\s*Verletzungen\s*<\/h3>/.test(html);
}

export function parseUnavailableSeite(html: string): UnavailableSeite {
  const doc = parse(html);
  const bereich = doc.querySelector("#squad_unavailable");
  if (!bereich) throw new KaderSeiteUnbekannt("Bereich „Verletzt / Gesperrt“ (#squad_unavailable) nicht gefunden.");

  // Verletzungen: beobachtet nur der leere Fall "<h3>Verletzungen</h3><p>keine verletzten Spieler</p>"
  const h3 = bereich.querySelectorAll("h3");
  const hVerl = h3.find((h) => text(h) === "Verletzungen");
  const hSperr = h3.find((h) => text(h) === "Platzverweise");
  if (!hVerl || !hSperr) throw new KaderSeiteUnbekannt("Überschriften „Verletzungen“/„Platzverweise“ fehlen.");
  const nachVerl = hVerl.nextElementSibling;
  const verletzte = nachVerl?.tagName === "P" && text(nachVerl) === "keine verletzten Spieler" ? [] : null;

  // Platzverweise: Tabelle #suspensionsList, Spalten über die Überschrift
  const tabelle = bereich.querySelector("table#suspensionsList");
  let sperren: UnavailableSeite["sperren"] = null;
  if (tabelle) {
    const kopf = zellen(tabelle.querySelector("thead tr")!).map(text);
    const i = (name: string) => {
      const k = kopf.indexOf(name);
      if (k < 0) throw new KaderSeiteUnbekannt(`Spalte „${name}“ fehlt in der Platzverweis-Liste.`);
      return k;
    };
    const [iName, iWett, iSpiele, iArt, iDatum] = [
      i("Name"),
      i("Platzverw. Liga-/Pokalname"),
      i("Spiele"),
      i("Begegnungsart"),
      i("Datum"),
    ];
    sperren = tabelle.querySelectorAll("tbody > tr").map((tr) => {
      const z = zellen(tr);
      if (z.length !== kopf.length) throw new KaderSeiteUnbekannt("Platzverweis-Zeile mit unerwarteter Zellenzahl.");
      const link = z[iName].querySelector("a.switch_to_squad_tab");
      const pid = pidAus(link);
      const spiele = zahl(text(z[iSpiele]));
      const datum = text(z[iDatum]);
      if (!pid || spiele === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
        throw new KaderSeiteUnbekannt("Platzverweis-Zeile ohne pid, Spielanzahl oder Datum.");
      }
      return {
        pid,
        name: text(link),
        karte: z[iName].querySelector("img")?.getAttribute("title") ?? "",
        wettbewerb: text(z[iWett]),
        spiele,
        art: text(z[iArt]),
        datum,
      };
    });
  }
  return { verletzte, sperren, serverzeit: serverzeit(html) };
}

// ---------- ?p=training_camp ----------

export type TrainingslagerSeite = {
  spieler: (TrainingslagerInfo & { pid: number; name: string })[];
  serverzeit?: string;
};

export function istTrainingslagerSeite(html: string): boolean {
  return /id="training_camp_players_container"/.test(html);
}

export function parseTrainingslagerSeite(html: string): TrainingslagerSeite {
  const doc = parse(html);
  const container = doc.querySelector("#training_camp_players_container");
  if (!container) throw new KaderSeiteUnbekannt("Liste „Spieler im Trainingslager“ nicht gefunden.");

  const spieler = container.querySelectorAll(".tc_table_container").map((b) => {
    const link = b.querySelector("a.player_link");
    const pid = pidAus(link);
    const paket = text(b.querySelector(".tc_table_package_text strong"));
    if (!pid || !paket) throw new KaderSeiteUnbekannt("Trainingslager-Eintrag ohne Spieler oder Paket.");
    const zeile = (praefix: string) =>
      b
        .querySelectorAll("div")
        .filter((d) => !d.querySelector("div")) // nur innerste Blöcke, sonst Text mehrerer Zeilen
        .map(text)
        .find((t) => t.startsWith(praefix))
        ?.slice(praefix.length)
        .trim();
    return {
      pid,
      name: text(link),
      paket,
      eigenschaft: zeile("Aktuelle Eigenschaft:"),
      dauerWochen: zahl(zeile("Dauer (Wochen):")),
      verbleibendeTage: zahl(zeile("Verbleibende Tage:")),
      start: zeile("Startdatum:"),
      ende: zeile("Enddatum:"),
    };
  });

  // Gegenprobe mit der Zusammenfassung oben ("Derzeit im Trainingslager", je Lagerart eine Zeile)
  const statTabelle = doc.querySelector(".training_camp_stats table");
  if (statTabelle) {
    const kopf = zellen(statTabelle.querySelector("thead tr")!).map(text);
    const k = kopf.indexOf("Derzeit im Trainingslager");
    if (k >= 0) {
      const summe = statTabelle
        .querySelectorAll("tbody > tr")
        .reduce((n, tr) => n + (zahl(text(zellen(tr)[k])) ?? 0), 0);
      if (summe !== spieler.length) {
        throw new KaderSeiteUnbekannt(`Trainingslager: ${spieler.length} Einträge gelesen, laut Seite ${summe}.`);
      }
    }
  }
  return { spieler, serverzeit: serverzeit(html) };
}

// ---------- ?p=tactics ----------

export type TaktikSeite = {
  // aufstellbar: undefined, wenn der Eintrag eine bisher nicht gesehene Klasse trägt
  spieler: { pid: number; name: string; aufstellbar?: boolean; unbekannt?: string }[];
  serverzeit?: string;
};

// Beobachtete Klassen der Spielereinträge (dd#n_<pid>) am 24.10.2026:
// "on_field" (aufgestellt, Feld oder Bank), "draggable ui-draggable" (frei), "tc ui-draggable" (Kegel).
const BEKANNTE_KLASSEN = new Set(["on_field", "draggable", "ui-draggable", "tc"]);

export function istTaktikSeite(html: string): boolean {
  return /<dd class="[^"]*" id="n_\d+">/.test(html) && /id="tacticset"/.test(html);
}

export function parseTaktikSeite(html: string): TaktikSeite {
  const doc = parse(html);
  const eintraege = doc.querySelectorAll("dd").filter((dd) => /^n_\d+$/.test(dd.id));
  if (eintraege.length === 0) throw new KaderSeiteUnbekannt("Keine Spieler auf der Taktikseite gefunden (dd#n_<pid>).");
  const spieler = eintraege.map((dd) => {
    const pid = Number(dd.id.slice(2));
    const name = text(dd.querySelector(".full-name"));
    const klassen = [...dd.classList.values()];
    const fremd = klassen.filter((k) => !BEKANNTE_KLASSEN.has(k));
    if (fremd.length) return { pid, name, unbekannt: fremd.join(" ") };
    return { pid, name, aufstellbar: !klassen.includes("tc") };
  });
  return { spieler, serverzeit: serverzeit(html) };
}

// ---------- ?p=players (Spieleransicht mit Scoutbericht) ----------

export type SpielerSeite = {
  spieler: {
    pid: number;
    name: string;
    block: string; // id des Spielerblocks (thePlayers_0, _1, … in Seitenreihenfolge, nicht die pid)
    loyal: boolean; // Herz-Symbol "Loyaler Spieler" (loyal_player_container), hat keinen Scoutbericht
    hatScoutLink: boolean; // Symbol "Scoutbericht" vorhanden
    nationalitaet?: string;
    arbeitsbewilligung?: SpielerBlock["arbeitsbewilligung"];
    // undefined: kein Scoutbericht beim Spieler
    scout?: { hoch: number; niedrig: number; training?: number; markierung: Partial<Record<Skill, 1 | 2>> };
  }[];
  serverzeit?: string;
};

export function istSpielerSeite(html: string): boolean {
  return /id="thePlayers_\d+"/.test(html) && /class="player_skills/.test(html);
}

// Sterne = Anzahl der gelb gefüllten i-Elemente einer Gruppe (Klasse scout_report_star ohne --disabled).
// Die Klassen wiederholen sich in der gespeicherten Seite fortlaufend (Nebenwirkung des Seiten-JavaScripts),
// deshalb zählt jedes i einmal. Ein anderer Sterntyp (z. B. leer) ist bisher nicht gesehen: abbrechen statt raten.
function sterne(gruppe: HTMLElement | null): number | undefined {
  if (!gruppe) return undefined;
  const i = gruppe.querySelectorAll("i");
  if (i.some((x) => !x.classList.contains("scout_report_star") || x.classList.contains("fa-regular"))) {
    throw new KaderSeiteUnbekannt("Scoutbericht mit unbekanntem Sterntyp: Aufbau bisher nicht gesehen.");
  }
  return i.filter((x) => !x.classList.contains("scout_report_star--disabled")).length;
}

export function parseSpielerSeite(html: string): SpielerSeite {
  const doc = parse(html);
  const bloecke = doc.querySelectorAll("div").filter((d) => /^thePlayers_\d+$/.test(d.id));
  if (bloecke.length === 0) throw new KaderSeiteUnbekannt("Keine Spielerblöcke (thePlayers_…) gefunden.");
  const spieler = bloecke.map((b) => {
    const { pid, name, nationalitaet, arbeitsbewilligung } = parseSpielerBlock(b);
    const loyal = !!b.querySelector(".loyal_player_container, .loyal-player-icon");
    const hatScoutLink = !!b.querySelector(".scout_report a");
    const basis = { pid, name, block: b.id, loyal, hatScoutLink, nationalitaet, arbeitsbewilligung };
    // Die Skill-Tabelle steht für Desktop und Mobil doppelt, die erste reicht.
    const tabelle = b.querySelector("table.player_skills");
    const zeile = tabelle?.querySelector("tr.scout_report_row");
    if (!tabelle || !zeile) return basis;

    const markierung: Partial<Record<Skill, 1 | 2>> = {};
    for (const sn of tabelle.querySelectorAll("span.skill_name")) {
      const titel = text(sn.querySelector("span"));
      const sup = text(sn.querySelector("span.sup"));
      const skill = SKILL_SPALTEN[titel];
      if (!skill) throw new KaderSeiteUnbekannt(`Unbekannter Skill „${titel}“ in der Spieleransicht.`);
      if (sup === "1" || sup === "2") markierung[skill] = Number(sup) as 1 | 2;
      else if (sup) throw new KaderSeiteUnbekannt(`Unbekannte Markierung „${sup}“ bei ${name}.`);
    }
    const hoch = sterne(zeile.querySelector(".high-stars"));
    const niedrig = sterne(zeile.querySelector(".low-stars"));
    if (hoch === undefined || niedrig === undefined) throw new KaderSeiteUnbekannt(`Scoutbericht ohne Sterne bei ${name}.`);
    const trGruppe = zeile
      .querySelectorAll(".scout_report_stars")
      .find((g) => text(g.querySelector(".scout_report_name span")) === "Tr. Geschwindigkeit");
    const training = sterne(trGruppe?.querySelector("div") ?? null);
    return { ...basis, scout: { hoch, niedrig, training, markierung } };
  });
  return { spieler, serverzeit: serverzeit(html) };
}

// Antwort auf den Klick "Scoutbericht" (vom Seiten-Skript nachgeladen; Aufbau noch nicht an einer echten Antwort
// gesehen, die erste wird roh gespeichert). Ergebnis: sichtbarer Text, Leerraum zusammengefasst, sonst wörtlich.
export function scoutTextAus(antwort: string): string {
  let html = antwort;
  try {
    const j = JSON.parse(antwort) as unknown;
    const texte: string[] = [];
    const sammle = (v: unknown) => {
      if (typeof v === "string") texte.push(v);
      else if (v && typeof v === "object") Object.values(v).forEach(sammle);
    };
    sammle(j);
    html = texte.join("\n");
  } catch {
    // kein JSON: HTML
  }
  const doc = parse(html.replace(/<br\s*\/?>/gi, "\n"));
  doc.querySelectorAll("script, style").forEach((x) => x.remove());
  return doc.text
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((z) => z.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
