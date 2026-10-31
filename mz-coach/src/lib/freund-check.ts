import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { pruefeTaktikGegenKader } from "@/lib/taktik-check";

// Reiter „freund“ für Freundschaftsspiele (Marcus, 31.10.2026):
// - Die wichtigsten Spieler sitzen auf der Bank: sie sollen Erfahrung und Form bekommen, sich aber nicht verletzen können.
//   Laut Marcus; nicht von ManagerZone bestätigt. Deshalb holt auch keine Wechselregel sie aufs Feld.
// - freund soll eine komplett andere Taktik sein als die Reiter, die offiziell gespielt werden.
// Wichtigste Spieler (eigene Setzung): die Startelf des letzten Ligaspiels, nach MZ-Wert auf ihrem Platz absteigend; so
// viele, wie die Bank Plätze hat (Torwart auf den Torwart-Bankplatz).

export const FREUND = /^freund/i;

export type Wichtig = { pid: number; name: string; wert: number; torwart: boolean };
export type FreundCheck = { probleme: string[]; hinweise: string[]; xml?: string; aenderungen: string[] };

const kurz = (n: string) => n.split(" ").at(-1) ?? n;

// Bank auf die wichtigsten Spieler setzen und Wechselregeln entfernen, die Spieler einwechseln
export function bankMitWichtigen(xml: string, wichtig: Wichtig[]): string {
  const t = parseTaktikXml(xml);
  const feld = new Set(t.pos.map((p) => p.pid));
  const tw = wichtig.filter((w) => w.torwart && !feld.has(w.pid));
  const fs = wichtig.filter((w) => !w.torwart && !feld.has(w.pid));
  const belegt = new Set<number>();
  let out = xml.replace(/<Sub\b[^>]*\/?>/g, (zeile) => {
    const art = zeile.match(/\spos="([^"]*)"/)?.[1];
    const w = (art === "subgoalie" ? tw : fs).find((x) => !belegt.has(x.pid)) ?? (art === "subgoalie" ? undefined : tw.find((x) => !belegt.has(x.pid)));
    if (!w) return zeile;
    belegt.add(w.pid);
    return zeile.replace(/(\spid=")\d+(")/, `$1${w.pid}$2`);
  });
  // Doppelte (ein Bankspieler, der vorher schon auf einem anderen Bankplatz saß) gibt es nicht, weil jeder Platz neu belegt
  // wird, solange wichtige Spieler übrig sind. Regeln mit Einwechslung entfernen.
  out = out.replace(/[ \t]*<TacticRule\b[^>]*\sin_player_id="(\d+)"[^>]*\/>\n?/g, "");
  return out;
}

// freund prüfen: wichtigste auf der Bank, keine Einwechslung, anderer Stil als die offiziellen Reiter
export function pruefeFreund(opt: {
  reiter: string;
  xml: string;
  stil: string;
  offizielleStile: { reiter: string; stil: string }[];
  wichtig: Wichtig[];
  kader: SpielerDaten[];
  spieltag: Date;
}): FreundCheck {
  const t = parseTaktikXml(opt.xml);
  const bankPlaetze = t.subs.length;
  const wichtig = opt.wichtig.slice(0, bankPlaetze);
  const probleme: string[] = [];
  const hinweise: string[] = [];
  const aenderungen: string[] = [];
  const feld = new Set(t.pos.map((p) => p.pid));
  const bank = new Set(t.subs.map((s) => s.pid));
  const aufFeld = wichtig.filter((w) => feld.has(w.pid));
  const nichtBank = wichtig.filter((w) => !feld.has(w.pid) && !bank.has(w.pid));
  if (aufFeld.length) probleme.push(`Wichtige Spieler auf dem Feld (Verletzungsgefahr): ${aufFeld.map((w) => kurz(w.name)).join(", ")}`);
  if (nichtBank.length) hinweise.push(`Nicht auf der Bank (bekommen keine Erfahrung/Form): ${nichtBank.map((w) => kurz(w.name)).join(", ")}`);
  const rein = t.regeln.filter((r) => /^\d+$/.test(r.in_player_id ?? "") && wichtig.some((w) => String(w.pid) === r.in_player_id));
  if (rein.length)
    probleme.push(
      `Wechselregel bringt wichtige Spieler aufs Feld: ${rein.map((r) => `${r.time}. ${kurz(wichtig.find((w) => String(w.pid) === r.in_player_id)!.name)}`).join(", ")}`,
    );
  const gleich = opt.offizielleStile.filter((o) => o.stil === opt.stil);
  if (gleich.length) probleme.push(`Gleicher Stil wie ${gleich.map((g) => g.reiter).join(", ")} (${opt.stil}): freund soll eine komplett andere Taktik sein`);

  let xml: string | undefined;
  if (aufFeld.length || nichtBank.length || rein.length) {
    // Feld mit den übrigen Spielern neu besetzen (Plätze und Einstellungen bleiben), dann Bank mit den wichtigsten
    const ohne = opt.kader.filter((s) => !wichtig.some((w) => w.pid === s.pid));
    const c = pruefeTaktikGegenKader(opt.reiter, opt.xml, ohne, opt.spieltag);
    if (c.fehler) hinweise.push(`Kein Vorschlag: ${c.fehler}`);
    else {
      xml = bankMitWichtigen(c.xml, wichtig);
      for (const a of c.aenderungen) aenderungen.push(`${a.rolle} x ${a.x}: ${a.alt} → ${a.neu}`);
      aenderungen.push(`Bank: ${wichtig.map((w) => kurz(w.name)).join(", ")}; Wechselregeln mit Einwechslung entfernt`);
    }
  }
  return { probleme, hinweise, xml, aenderungen };
}
