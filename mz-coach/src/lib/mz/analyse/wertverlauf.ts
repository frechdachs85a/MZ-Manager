// Kaderwert über die Spielzeit (Marcus, 26.10.2026, mz-wissen.md, Abschnitt 14): je Zeitfenster zwischen zwei
// Wechseln Summe der Marktwerte auf dem Feld (FC Toho ÷ Gegner), danach nach Minuten gewichtet.

export type Wechsel = { minute: number; raus: number; rein: number };
export type Fenster = { von: number; bis: number; eigen: number; gegner: number; verhaeltnis: number; aenderung: string[] };
export type Wertverlauf = {
  fenster: Fenster[];
  gewichtet: { eigen: number; gegner: number; verhaeltnis: number };
  fehlend: string[]; // Spieler ohne Marktwert (zählen mit 0)
};

export const SPIELMINUTEN = 90;

// Kaderwert beider Teams je Zeitfenster zwischen den Wechseln
export function wertverlauf(opt: {
  eigeneElf: number[];
  gegnerElf: number[];
  eigeneWechsel: Wechsel[];
  gegnerWechsel: Wechsel[];
  wert: (pid: number) => number | undefined;
  name: (pid: number) => string;
}): Wertverlauf {
  const fehlend = new Set<string>();
  const summe = (elf: Set<number>) =>
    [...elf].reduce((n, pid) => {
      const w = opt.wert(pid);
      if (w === undefined) fehlend.add(opt.name(pid));
      return n + (w ?? 0);
    }, 0);
  const eigen = new Set(opt.eigeneElf);
  const gegner = new Set(opt.gegnerElf);
  const alle = [...opt.eigeneWechsel.map((w) => ({ ...w, eigen: true })), ...opt.gegnerWechsel.map((w) => ({ ...w, eigen: false }))]
    .filter((w) => w.minute > 0 && w.minute < SPIELMINUTEN)
    .sort((a, b) => a.minute - b.minute);
  const minuten = [...new Set(alle.map((w) => w.minute))];
  const fenster: Fenster[] = [];
  let von = 0;
  let aenderung: string[] = [];
  for (const m of [...minuten, SPIELMINUTEN]) {
    if (m > von) {
      const e = summe(eigen);
      const g = summe(gegner);
      fenster.push({ von, bis: m, eigen: e, gegner: g, verhaeltnis: g ? e / g : 0, aenderung });
    }
    aenderung = [];
    for (const w of alle.filter((x) => x.minute === m)) {
      const elf = w.eigen ? eigen : gegner;
      if (!elf.has(w.raus)) continue; // Ausgewechselter steht nicht (mehr) auf dem Feld: Wechsel nicht anwendbar
      elf.delete(w.raus);
      elf.add(w.rein);
      aenderung.push(`${w.eigen ? "du" : "er"}: ${opt.name(w.rein)} für ${opt.name(w.raus)}`);
    }
    von = m;
  }
  const gew = (f: (x: Fenster) => number) => fenster.reduce((n, x) => n + f(x) * (x.bis - x.von), 0) / SPIELMINUTEN;
  return {
    fenster,
    gewichtet: { eigen: gew((x) => x.eigen), gegner: gew((x) => x.gegner), verhaeltnis: gew((x) => x.verhaeltnis) },
    fehlend: [...fehlend],
  };
}

// Einordnung nach Wertbereich (mz-wissen.md, Abschnitt 14; 278 Top-10-Spiele vom 25.10.2026). Punkte pro Spiel,
// keine Siegwahrscheinlichkeiten.
export function wertbereich(v: number): string {
  if (v < 0.85) return "unter 0,85: in den Top-10-Spielen 0,14 Punkte pro Spiel (2 Siege in 70)";
  if (v <= 1.15) return "0,85 bis 1,15: in den Top-10-Spielen 1,26 bis 1,58 Punkte pro Spiel, offen, die Taktik entscheidet";
  if (v <= 1.3) return "1,15 bis 1,30: in den Top-10-Spielen 2,44 Punkte pro Spiel";
  return "über 1,30: in den Top-10-Spielen 34 Siege in 34 Spielen";
}
