// Taktik-XML des ManagerZone-Taktik-Editors (Format laut mz-wissen.md, Abschnitt 4).
// Noch nicht an einer echten exportierten Taktik geprüft: unbekannte Elemente und Attribute
// bleiben erhalten (attrs), damit beim Zurückschreiben nichts verloren geht.

export class TaktikXmlFehler extends Error {}

export type Punkt = { x: number; y: number };

export type TaktikPos = {
  pos: "goalie" | "normal";
  pid: number;
  start: Punkt; // x/y
  alt1?: Punkt; // x1/y1
  alt2?: Punkt; // x2/y2
  attrs: Record<string, string>;
};

export type TaktikSub = { pos: "sub" | "subgoalie"; pid: number; x: number; y: number; attrs: Record<string, string> };

export type TaktikRegel = Record<string, string>;

export type Taktik = {
  team: Record<string, string>; // tactics, playstyle, aggression, captain
  pos: TaktikPos[];
  subs: TaktikSub[];
  regeln: TaktikRegel[];
};

const ELEMENT = /<([A-Za-z]+)((?:\s+[A-Za-z_][\w-]*\s*=\s*"[^"]*")*)\s*\/?>/g;
const ATTR = /([A-Za-z_][\w-]*)\s*=\s*"([^"]*)"/g;

function attribute(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(ATTR)) out[m[1]] = m[2].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return out;
}

function zahl(a: Record<string, string>, k: string, wo: string): number {
  const v = a[k];
  if (v === undefined || v === "" || !/^-?\d+(\.\d+)?$/.test(v)) throw new TaktikXmlFehler(`${wo}: ${k}="${v ?? ""}" ist keine Zahl.`);
  return Number(v);
}

function punkt(a: Record<string, string>, kx: string, ky: string, wo: string): Punkt | undefined {
  if ((a[kx] ?? "") === "" && (a[ky] ?? "") === "") return undefined;
  return { x: zahl(a, kx, wo), y: zahl(a, ky, wo) };
}

// Taktik-XML lesen
export function parseTaktikXml(xml: string): Taktik {
  if (!/<SoccerTactics[\s>]/.test(xml)) throw new TaktikXmlFehler("Kein <SoccerTactics> gefunden. Bitte den kompletten XML-Code einfügen.");
  const t: Taktik = { team: {}, pos: [], subs: [], regeln: [] };
  let team = false;
  for (const m of xml.matchAll(ELEMENT)) {
    const name = m[1];
    const a = attribute(m[2] ?? "");
    if (name === "Team") {
      t.team = a;
      team = true;
    } else if (name === "Pos") {
      const wo = `Pos pid ${a.pid ?? "?"}`;
      if (a.pos !== "goalie" && a.pos !== "normal") throw new TaktikXmlFehler(`${wo}: pos="${a.pos}" unbekannt.`);
      const start = punkt(a, "x", "y", wo);
      if (!start) throw new TaktikXmlFehler(`${wo}: x/y fehlen.`);
      t.pos.push({ pos: a.pos, pid: zahl(a, "pid", wo), start, alt1: punkt(a, "x1", "y1", wo), alt2: punkt(a, "x2", "y2", wo), attrs: a });
    } else if (name === "Sub") {
      const wo = `Sub pid ${a.pid ?? "?"}`;
      if (a.pos !== "sub" && a.pos !== "subgoalie") throw new TaktikXmlFehler(`${wo}: pos="${a.pos}" unbekannt.`);
      t.subs.push({ pos: a.pos, pid: zahl(a, "pid", wo), x: zahl(a, "x", wo), y: zahl(a, "y", wo), attrs: a });
    } else if (name === "TacticRule") {
      t.regeln.push(a);
    }
  }
  if (!team) throw new TaktikXmlFehler("Element <Team> fehlt.");
  return t;
}

// Aufstellung k (0 = Start, 1 = Alternative 1, 2 = Alternative 2). Fehlt eine Alternative beim
// Spieler, ist sie undefined (Verhalten von ManagerZone dabei nicht geprüft).
export function aufstellung(t: Taktik, k: 0 | 1 | 2): { pid: number; pos: TaktikPos["pos"]; p?: Punkt }[] {
  return t.pos.map((p) => ({ pid: p.pid, pos: p.pos, p: k === 0 ? p.start : k === 1 ? p.alt1 : p.alt2 }));
}
