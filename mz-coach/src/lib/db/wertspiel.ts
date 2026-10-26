import type Database from "better-sqlite3";

export type WertSpiel = {
  mid: number;
  datum?: string;
  wettbewerb: "liga" | "weltliga";
  tidA: number;
  tidB: number;
  nameA?: string;
  nameB?: string;
  elfA?: number;
  elfB?: number;
  feldA?: number;
  feldB?: number;
  verhaeltnisElf?: number;
  verhaeltnisFeld?: number;
  toreA: number;
  toreB: number;
  ergebnisA: "S" | "U" | "N";
  einstellungA?: string;
  einstellungB?: string;
  fehlendeWerte: number; // Spieler ohne Marktwert (beide Teams zusammen)
};

export function wertSpielVorhanden(db: Database.Database, mid: number): boolean {
  return !!db.prepare("SELECT 1 FROM wert_spiel WHERE mid = ?").get(mid);
}

export function speichereWertSpiel(db: Database.Database, w: WertSpiel, zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT OR REPLACE INTO wert_spiel (mid, datum, wettbewerb, tid_a, tid_b, name_a, name_b, elf_a, elf_b, feld_a, feld_b,
       verhaeltnis_elf, verhaeltnis_feld, tore_a, tore_b, ergebnis_a, einstellung_a, einstellung_b, fehlende_werte, gespeichert)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    w.mid, w.datum ?? null, w.wettbewerb, w.tidA, w.tidB, w.nameA ?? null, w.nameB ?? null,
    w.elfA ?? null, w.elfB ?? null, w.feldA ?? null, w.feldB ?? null, w.verhaeltnisElf ?? null, w.verhaeltnisFeld ?? null,
    w.toreA, w.toreB, w.ergebnisA, w.einstellungA ?? null, w.einstellungB ?? null, w.fehlendeWerte, zeit,
  );
}

// Wertbereiche wie in mz-wissen.md, Abschnitt 14, die Mitte geteilt (unter 1 / ab 1)
export const BEREICHE: { name: string; von: number; bis: number }[] = [
  { name: "unter 0,85", von: 0, bis: 0.85 },
  { name: "0,85 bis 1,00", von: 0.85, bis: 1.0 },
  { name: "1,00 bis 1,15", von: 1.0, bis: 1.15 },
  { name: "1,15 bis 1,30", von: 1.15, bis: 1.3 },
  { name: "über 1,30", von: 1.3, bis: 99 },
];

export type Quote = { bereich: string; von: number; bis: number; spiele: number; S: number; U: number; N: number };

// Sieg/Remis/Niederlage je Wertbereich. Jedes Spiel zählt aus Sicht beider Teams (Verhältnis v und 1/v), damit
// die Bereiche unter und über 1 dieselben Spiele spiegeln. Nur Spiele, in denen alle 22 Spieler einen Wert hatten.
export function quotenJeBereich(db: Database.Database, basis: "elf" | "feld" = "elf", wettbewerb?: "liga" | "weltliga"): Quote[] {
  const spalte = basis === "elf" ? "verhaeltnis_elf" : "verhaeltnis_feld";
  const rows = db
    .prepare(`SELECT ${spalte} AS v, ergebnis_a AS e FROM wert_spiel WHERE ${spalte} IS NOT NULL AND fehlende_werte = 0 ${wettbewerb ? "AND wettbewerb = ?" : ""}`)
    .all(...(wettbewerb ? [wettbewerb] : [])) as { v: number; e: "S" | "U" | "N" }[];
  const sichten = rows.flatMap((r) => [
    { v: r.v, e: r.e },
    { v: 1 / r.v, e: r.e === "S" ? "N" : r.e === "N" ? "S" : "U" },
  ]);
  return BEREICHE.map((b) => {
    const im = sichten.filter((x) => x.v >= b.von && x.v < b.bis);
    return { bereich: b.name, von: b.von, bis: b.bis, spiele: im.length, S: im.filter((x) => x.e === "S").length, U: im.filter((x) => x.e === "U").length, N: im.filter((x) => x.e === "N").length };
  });
}

export function anzahlWertSpiele(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM wert_spiel").get() as { n: number }).n;
}
