// Startdaten 1:1 aus mz-wissen.md übernommen (Abschnitte 1, 8, 9, 11).
// Wird ab Etappe 2 durch live abgerufene ManagerZone-Daten ersetzt.

export const QUELLE_KADER = "mz-wissen.md, Abschnitt 11, Stand 19. bis 23.10.2026";
export const QUELLE_TAKTIKEN = "mz-wissen.md, Abschnitt 8";
export const QUELLE_TOP10 = "mz-wissen.md, Abschnitt 9, Managerwertung vom 21.10.2026";

export const TEAM = {
  name: "FC Toho",
  tid: 847159,
  liga: "Seniorenliga Germany div1.1",
  sid: 12087,
  ligaspieltage: [3, 0] as const, // Mittwoch, Sonntag (Date.getDay)
};

export type StartSpieler = {
  nr: number;
  name: string;
  alter: number;
  pid: number;
  info: string;
};

export const KADER_START: StartSpieler[] = [
  { nr: 1, name: "Liu Chao Feng", alter: 29, pid: 225496434, info: "TW, Tw10" },
  { nr: 2, name: "Cytrynski", alter: 28, pid: 225629108, info: "Pa10 Te10, Ausdauer 7 gemaxt" },
  { nr: 3, name: "Nazarov", alter: 27, pid: 227162857, info: "Zk10 Kb9, Ausdauer 7 gemaxt, bulgarischer Nationalspieler" },
  { nr: 4, name: "Chille", alter: 24, pid: 229926279, info: "Sp10 Zk9" },
  { nr: 5, name: "Salzer", alter: 32, pid: 227393631, info: "Nationalspieler" },
  { nr: 6, name: "Kaupa", alter: 33, pid: 226471405, info: "Kb10 Pa10, Sprint am 22.10. auf 6 gefallen" },
  { nr: 7, name: "Hyuga", alter: 24, pid: 229906765, info: "Sp10 Fl9 Pa9 Sch9, Ausdauer 7 gemaxt" },
  { nr: 8, name: "Ishizaki", alter: 24, pid: 230162433, info: "Sp10 Au9 Sü9 Fl9" },
  { nr: 9, name: "Cavalcante", alter: 26, pid: 227653119, info: "Sp10 Sch9 Kb9" },
  { nr: 10, name: "Pinheiro", alter: 28, pid: 226189000, info: "Pa10 Sch9 Zk9, Kapitän" },
  { nr: 11, name: "Schobel", alter: 27, pid: 231999845, info: "Au10 Sü10 Sch9" },
  { nr: 12, name: "Fleur", alter: 24, pid: 229866139, info: "TW, Tw10" },
  { nr: 13, name: "Mauer", alter: 27, pid: 232093954, info: "" },
  { nr: 14, name: "Wiesenberg", alter: 27, pid: 231999835, info: "Sch9 Sü9" },
  { nr: 16, name: "Misugi", alter: 21, pid: 232733543, info: "Sü10 Sch10 Au10 Sp9, Kapitän U21-Nationalmannschaft" },
  { nr: 17, name: "Rodekamp", alter: 27, pid: 231999847, info: "Au10, Loyal Player" },
  { nr: 18, name: "Peschke", alter: 24, pid: 229926290, info: "Pa9 Zk9 Au9" },
  { nr: 19, name: "Zahl", alter: 28, pid: 231091969, info: "Sp10 Zk9 Pa9" },
  { nr: 20, name: "Scholze", alter: 24, pid: 230045369, info: "Schuss 8 gemaxt, trainiert Zweikampf" },
  { nr: 21, name: "Vranken", alter: 27, pid: 227322975, info: "Sp9 Au9 Kb9 Zk9" },
];

export type TaktikReiter = {
  name: string;
  inhalt: string;
  einsatz: string;
  // Feldspieler-Koordinaten im Editor, nur wo in mz-wissen.md angegeben (ohne Torwart)
  koordinaten?: { x: number; y: number; rolle: string }[];
};

export const TAKTIKEN: TaktikReiter[] = [
  {
    name: "außenR",
    inhalt: "4-2-1-3, Eckstürmer rechts, Flügel/offensiv/normal, Template der Topteams",
    einsatz: "Standard",
    koordinaten: [
      { x: 26, y: 224, rolle: "AV" }, { x: 76, y: 224, rolle: "IV" }, { x: 125, y: 224, rolle: "IV" }, { x: 175, y: 224, rolle: "AV" },
      { x: 101, y: 183, rolle: "6" }, { x: 151, y: 183, rolle: "6" }, { x: 101, y: 135, rolle: "10" },
      { x: 129, y: 95, rolle: "ST" }, { x: 82, y: 77, rolle: "ST" }, { x: 200, y: 63, rolle: "Ecke" },
    ],
  },
  { name: "außenL", inhalt: "gespiegelt, Ecke links", einsatz: "Variante" },
  {
    name: "kupass",
    inhalt: "4-2-1-3 ohne Eckstürmer, 3 zentrale Stürmer, Kurzpass/normal",
    einsatz: "gegen Fünferkette und dichte Mitte",
    koordinaten: [
      { x: 33, y: 222, rolle: "AV" }, { x: 79, y: 235, rolle: "IV" }, { x: 127, y: 235, rolle: "IV" }, { x: 175, y: 222, rolle: "AV" },
      { x: 79, y: 186, rolle: "6" }, { x: 127, y: 186, rolle: "6" }, { x: 103, y: 142, rolle: "10" },
      { x: 72, y: 100, rolle: "ST" }, { x: 134, y: 100, rolle: "ST" }, { x: 103, y: 63, rolle: "ST" },
    ],
  },
  { name: "3313of", inhalt: "3-3-1-3 offensiv, ohne Führungsregel", einsatz: "gegen Schwache" },
  { name: "532de", inhalt: "5-2-3 Lyon-Kopie, Flügel/offensiv/normal (trotz Name nicht defensiv)", einsatz: "gegen Übermächtige" },
  { name: "indivi", inhalt: "Essen-Kopie 3-1-2-1-3, Kurzpass/normal/passiv", einsatz: "gegen Schwache (nur 1 Scoutspiel belegt)" },
  { name: "freund", inhalt: "Freundschaftsspiel-Taktik", einsatz: "Form halten" },
  { name: "U18", inhalt: "5-2-1-2 Kurzpass defensiv aus Profi-Bausteinen", einsatz: "Jugend, nicht aktiv betreut" },
];

export const TOP10 = [
  { rang: 1, name: "Bazellatin", tid: 102604 },
  { rang: 2, name: "Nagyváradi AC", tid: 864852 },
  { rang: 3, name: "Formation Pure Lyonnaise", tid: 1200022 },
  { rang: 4, name: "Tabachana", tid: 105125 },
  { rang: 5, name: "Real Kikkabu", tid: 1230813 },
  { rang: 6, name: "CARDINAL", tid: 340771 },
  { rang: 7, name: "Nibiru X", tid: 561256 },
  { rang: 8, name: "Real Llull de Reus", tid: 499737 },
  { rang: 9, name: "THE ROKERY PIMKIS", tid: 113102 },
  { rang: 10, name: "Beek City", tid: 359371 },
];

// Nächster Ligaspieltag nach der Regel "immer mittwochs und sonntags".
// Liefert nur das Datum. Anstoßzeit und Gegner kommen erst mit dem Spielplan-Abruf.
export function naechsterLigaspieltag(heute: Date): Date {
  const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  for (let i = 0; i < 7; i++) {
    if ((TEAM.ligaspieltage as readonly number[]).includes(d.getDay())) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}
