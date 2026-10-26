// Auswertungen von Scoutspielen gegen kommende Gegner (mz-wissen.md, Abschnitt 12). Von Marcus geliefert,
// hier als Daten für den Taktikvorschlag. Zahlen 1:1 aus seinem Bericht, keine eigenen Schätzungen.

export type ScoutTaktik = {
  reiter: string;
  einstellung: string;
  spiele: number;
  S: number;
  U: number;
  N: number;
  tore: number;
  gegentore: number;
  schuesse?: [number, number];
  ecken?: [number, number];
  ballbesitz?: number;
};

// Anpassung an einer Taktik aus dem Archiv. wechselzeit: Wechselregel mit diesem Ausgewechselten erst ab Minute neu.
export type Anpassung =
  | { art: "wechselzeit"; reiter: string; outPid: number; name: string; ab: number; grund: string; kurz: string; umgesetzt?: string }
  | { art: "hinweis"; text: string; kurz: string };

export type ScoutBericht = {
  tid: number;
  gegner: string;
  datum: string; // JJJJ-MM-TT
  quelle: string;
  taktiken: ScoutTaktik[];
  befunde: string[];
  anpassungen: Anpassung[];
  vorbehalte: string[];
};

export const SCOUT_BERICHTE: ScoutBericht[] = [
  {
    tid: 97246,
    gegner: "Sydney FC",
    datum: "2026-10-26",
    quelle: "22 Scoutspiele vom 26.10.2026, Auswertung von Marcus (mz-wissen.md, Abschnitt 12.1)",
    taktiken: [
      { reiter: "außenR", einstellung: "Flügel / offensiv / normal", spiele: 11, S: 4, U: 2, N: 5, tore: 17, gegentore: 20, schuesse: [150, 171], ecken: [14, 6], ballbesitz: 47.9 },
      { reiter: "kupass", einstellung: "Kurzpass / normal / normal", spiele: 11, S: 4, U: 3, N: 4, tore: 15, gegentore: 23, schuesse: [167, 184], ecken: [6, 4], ballbesitz: 53.5 },
    ],
    befunde: [
      "Flügel leer · bei dir: Alberts x 88 (Nazarov), Gimenez x 134 (Vranken), Lenz/Toscano x 117",
      "außenR: bis zur 50. 12:8 Tore, danach 4:9",
      "Hyuga 8 Vorlagen, alle vor seinem Wechsel (50.) · Ishizaki danach 0",
      "Sydney wechselt immer in der 40.: Toscano für Lenz, Denzin für Reifer",
      "Rot-Regel: nach eigener Roter Karte sofort defensiv",
      "Zweikämpfe außenR: Vranken 46:56 (Schwachstelle) · Pinheiro 67:47",
      "Bester Joker: Wiesenberg (2 Tore, 17 Schüsse aufs Tor)",
    ],
    anpassungen: [
      { art: "wechselzeit", reiter: "außenR", outPid: 229906765, name: "Hyuga", ab: 70, grund: "Ausdauer 7 hält bis ca. 70.–80.; nach seinem Wechsel in der 50. brach außenR in den Scoutspielen ein (4:9 Tore).", kurz: "Hyuga erst ab der 70. auswechseln (nach der 50. sonst 4:9 Tore)", umgesetzt: "26.10.2026 im Editor (laut Marcus, per Neuladen geprüft): 60. Kaupa für Nazarov, 60. Rodekamp für Cytrynski, 70. Ishizaki für Hyuga. Nach dem Spiel prüfen: Tore ab der 51. besser als 4:9?" },
      { art: "hinweis", text: "Keine aggressive Rückstandsregel, falls kupass gespielt wird (1:5 Tore nach dem Umschalten in 7 Spielen; Auswahleffekt möglich).", kurz: "Bei kupass: keine aggressive Rückstandsregel" },
      { art: "hinweis", text: "Bekommt Sydney Rot, spielt er defensiv: dann lohnt Druck nach vorn.", kurz: "Sydney Rot → er wird defensiv → Druck machen" },
    ],
    vorbehalte: [
      "In Scoutspielen spielt Sydney fest die Aufstellung vom 25.10. Live stellte er gegen den einzigen Gegner mit Eckstürmer (07.10.) auf Viererkette um.",
      "Je Taktik 11 Spiele: Zusammenhänge, keine Beweise.",
    ],
  },
];

export const scoutBericht = (tid: number) => SCOUT_BERICHTE.find((b) => b.tid === tid);

// Entscheidung zwischen zwei getesteten Taktiken (eigene Regel, 26.10.2026): Punkte pro Spiel zählen nur, wenn
// der Abstand mindestens 0,2 beträgt (darunter Zufall bei rund 10 Spielen je Taktik); sonst entscheidet die
// Tordifferenz pro Spiel. Mindestens 8 Spiele je Taktik, sonst keine Entscheidung aus den Scoutspielen.
export const MIN_SCOUT_SPIELE = 8;
export const PPS_SCHWELLE = 0.2;

// Entscheidung zwischen zwei Taktiken aus den Scoutspielen
export function scoutEntscheidung(b: ScoutBericht): { reiter: string; begruendung: string; kurz: string[] } | null {
  const t = b.taktiken.filter((x) => x.spiele >= MIN_SCOUT_SPIELE);
  if (t.length < 2) return null;
  const pps = (x: ScoutTaktik) => (3 * x.S + x.U) / x.spiele;
  const td = (x: ScoutTaktik) => (x.tore - x.gegentore) / x.spiele;
  const nachPps = [...t].sort((a, c) => pps(c) - pps(a));
  const f = (n: number) => n.toFixed(2).replace(".", ",");
  if (pps(nachPps[0]) - pps(nachPps[1]) >= PPS_SCHWELLE) {
    return {
      reiter: nachPps[0].reiter,
      begruendung: `${nachPps[0].reiter} holt ${f(pps(nachPps[0]))} Punkte pro Spiel, ${nachPps[1].reiter} ${f(pps(nachPps[1]))}.`,
      kurz: [`${t.reduce((n, x) => n + x.spiele, 0)} Scoutspiele gegen ihn`, `Punkte/Spiel: ${t.map((x) => `${x.reiter} ${f(pps(x))}`).join(" · ")}`, `→ ${nachPps[0].reiter} klar besser`],
    };
  }
  const nachTd = [...t].sort((a, c) => td(c) - td(a));
  return {
    reiter: nachTd[0].reiter,
    kurz: [
      `${t.reduce((n, x) => n + x.spiele, 0)} Scoutspiele gegen ihn`,
      `Punkte/Spiel gleichauf: ${t.map((x) => `${x.reiter} ${f(pps(x))}`).join(" · ")}`,
      `Tore: ${t.map((x) => `${x.reiter} ${x.tore}:${x.gegentore}`).join(" · ")} → ${nachTd[0].reiter}`,
    ],
    begruendung:
      `Punkte pro Spiel fast gleich (${t.map((x) => `${x.reiter} ${f(pps(x))}`).join(", ")}; Abstand unter ${f(PPS_SCHWELLE)} ist bei rund 10 Spielen Zufall). ` +
      `Entscheidend ist die Tordifferenz: ${t.map((x) => `${x.reiter} ${x.tore}:${x.gegentore}`).join(", ")}.`,
  };
}
