import { mzWert } from "@/lib/mz/formel";
import { ABWEHR_Y } from "@/lib/mz/analyse/gegner";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { zuordnen } from "./erzeugen";
import { KOPFBALL_GEWICHT, gegnerGewichte, spiegelX, type GegnerFeld } from "./gegner-gewichte";
import { parseTaktikXml } from "./xml";

// Formation Liga aus einer Taktik deines Archivs (Marcus, 26.10.2026): Die getestete Taktik bleibt (Spieler, Bank,
// Alternativen, Wechselregeln). Gegen den Gegner geändert wird nur:
// - welcher deiner Verteidiger auf welchem Abwehrplatz steht (Stärke gegenüber seinen Angreifern, Kopfball innen,
//   wenn er über außen spielt; Gewichte siehe gegner-gewichte.ts)
// - die Seite: ist die Formation einseitig und zeigt nicht auf seine schwächere Abwehrseite, wird sie gespiegelt
//   (x, x1, x2 -> 208 − x).
// Der ausgewiesene Wert bleibt der MZ-Wert; die Gewichte entscheiden nur die Verteilung.

export type LigaAnpassung = { xml: string; kurz: string[]; getauscht: { name: string; von: string; nach: string }[] };

const ersetzeAttr = (zeile: string, k: string, v: string) => zeile.replace(new RegExp(`(\\s${k}=")[^"]*(")`), `$1${v}$2`);

export function ligaAusArchiv(opt: {
  xml: string;
  kader: SpielerDaten[];
  gegner: GegnerFeld[];
  seinStil?: string;
  angriffUeber?: "links" | "rechts";
}): LigaAnpassung {
  const t = parseTaktikXml(opt.xml);
  const feldPos = t.pos.filter((p) => p.pos === "normal");
  const g = gegnerGewichte({ feld: feldPos.map((p) => p.start), gegner: opt.gegner, seinStil: opt.seinStil, angriffUeber: opt.angriffUeber });
  const kurz = [...g.kurz];
  const kader = new Map(opt.kader.map((k) => [k.pid, k]));
  const name = (pid: number) => kader.get(pid)?.name.split(" ").at(-1) ?? String(pid);

  // Abwehrplätze (Start-y ≥ 215) und ihre Spieler neu zuordnen
  const abwehr = feldPos.map((p, i) => ({ p, i })).filter(({ p }) => p.start.y >= ABWEHR_Y);
  const neuePid = new Map<number, number>(); // Index in feldPos -> pid
  const getauscht: LigaAnpassung["getauscht"] = [];
  const vt = (pid: number) => {
    const s = kader.get(pid);
    const w = s ? mzWert(s.skills, "VT") : undefined;
    return w?.ok ? w.wert : undefined;
  };
  if (abwehr.length >= 2 && abwehr.every(({ p }) => vt(p.pid) !== undefined)) {
    const pids = abwehr.map(({ p }) => p.pid);
    const kosten = abwehr.map(({ i }) =>
      pids.map((pid) => -(vt(pid)! * g.faktor[i] + (g.kopfball[i] ? KOPFBALL_GEWICHT * (kader.get(pid)?.skills.kopfball?.wert ?? 0) : 0))),
    );
    const zu = zuordnen(kosten);
    const seite = (x: number) => (x < 80 ? "links" : x > 128 ? "rechts" : "Mitte");
    abwehr.forEach(({ p, i }, k) => {
      const pid = pids[zu[k]];
      neuePid.set(i, pid);
      if (pid !== p.pid) {
        const alt = abwehr.find((a) => a.p.pid === pid)!;
        getauscht.push({ name: name(pid), von: `${seite(g.feld[alt.i].x)} (x ${g.feld[alt.i].x})`, nach: `${seite(g.feld[i].x)} (x ${g.feld[i].x})` });
      }
    });
    kurz.push(getauscht.length ? `Abwehr getauscht: ${getauscht.map((x) => `${x.name} ${x.von} → ${x.nach}`).join(" · ")}` : "Abwehr bleibt wie im Archiv (passt schon)");
  } else if (abwehr.length >= 2) {
    kurz.push("Abwehr unverändert: Skills eines Verteidigers unbekannt");
  }

  // XML zeilenweise ändern, damit alles andere (Alternativen, Bank, Regeln) unverändert bleibt
  let n = -1;
  const xml = opt.xml.replace(/<Pos\b[^>]*\/?>/g, (zeile) => {
    const pos = zeile.match(/\spos="([^"]*)"/)?.[1];
    let z = zeile;
    if (pos === "normal") {
      n++;
      const pid = neuePid.get(n);
      if (pid !== undefined) z = ersetzeAttr(z, "pid", String(pid));
    }
    if (g.gespiegelt && pos === "normal") {
      for (const k of ["x", "x1", "x2"]) {
        const v = z.match(new RegExp(`\\s${k}="(-?\\d+(?:\\.\\d+)?)"`))?.[1];
        if (v !== undefined) z = ersetzeAttr(z, k, String(spiegelX(Number(v))));
      }
    }
    return z;
  });
  return { xml, kurz, getauscht };
}
