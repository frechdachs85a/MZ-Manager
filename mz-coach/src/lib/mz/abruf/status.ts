import type Database from "better-sqlite3";
import { speichereRohseite } from "@/lib/db/abruf";
import { aktualisiereSpieler } from "@/lib/db/kader";
import type { SpielerDaten } from "@/lib/mz/spieler";
import type { TaktikSeite, TrainingslagerSeite, UnavailableSeite } from "@/lib/mz/parser/status";

// Überträgt die Status-Seiten auf die gespeicherten Spieler. Jeder Status bekommt den Stand
// seiner Quellseite, damit sichtbar bleibt, wie aktuell er ist.

export class StatusFehler extends Error {}

function ohne<T extends object, K extends keyof T>(o: T, ...felder: K[]): Omit<T, K> {
  const kopie = { ...o };
  for (const f of felder) delete kopie[f];
  return kopie;
}

export type StatusErgebnis = { spieler: number; aenderungen: number; nichtImKader: string[]; stand: string };

type StandFeld = keyof NonNullable<SpielerDaten["statusStand"]>;

function pruefeStand(db: Database.Database, feld: StandFeld, stand: string) {
  const rows = db.prepare("SELECT daten_json FROM spieler WHERE aktiv = 1").all() as { daten_json: string }[];
  if (rows.length === 0) throw new StatusFehler("Erst die Kaderübersicht einlesen, dann den Status.");
  const neuester = rows
    .map((r) => (JSON.parse(r.daten_json) as SpielerDaten).statusStand?.[feld])
    .filter((z): z is string => !!z)
    .sort()
    .at(-1);
  if (neuester === stand) throw new StatusFehler("Diese Seite ist schon eingelesen.");
  if (neuester && stand < neuester) throw new StatusFehler("Die Seite ist älter als der gespeicherte Stand.");
}

function aktivePids(db: Database.Database): Set<number> {
  return new Set((db.prepare("SELECT pid FROM spieler WHERE aktiv = 1").all() as { pid: number }[]).map((r) => r.pid));
}

export function speichereUnavailable(
  db: Database.Database,
  seite: UnavailableSeite,
  roh: { url: string; html: string },
  quelle: string,
): StatusErgebnis {
  if (seite.verletzte === null && seite.sperren === null) {
    throw new StatusFehler("Weder Verletzungen noch Platzverweise in bekanntem Aufbau gefunden.");
  }
  const stand = seite.serverzeit ?? new Date().toISOString();
  if (seite.verletzte) pruefeStand(db, "verletzt", stand);
  if (seite.sperren) pruefeStand(db, "gesperrt", stand);

  const verletzt = seite.verletzte && new Set(seite.verletzte.map((v) => v.pid));
  const sperren = seite.sperren;
  const aktiv = aktivePids(db);
  const nichtImKader = [...(seite.verletzte ?? []), ...(sperren ?? [])].filter((x) => !aktiv.has(x.pid)).map((x) => x.name);

  speichereRohseite(db, { art: "unavailable", url: roh.url, status: null, htmlRoh: roh.html, htmlDom: null }, stand);
  const r = aktualisiereSpieler(
    db,
    (alt) => {
      const neu: SpielerDaten = { ...alt, status: { ...alt.status }, statusStand: { ...alt.statusStand } };
      if (verletzt) {
        neu.status!.verletzt = verletzt.has(alt.pid);
        neu.statusStand!.verletzt = stand;
      }
      if (sperren) {
        const eigene = sperren.filter((s) => s.pid === alt.pid).map((s) => ohne(s, "pid", "name"));
        neu.status!.gesperrt = eigene.length > 0;
        neu.sperren = eigene;
        neu.statusStand!.gesperrt = stand;
      }
      return neu;
    },
    quelle,
    stand,
  );
  return { ...r, nichtImKader, stand };
}

export function speichereTrainingslager(
  db: Database.Database,
  seite: TrainingslagerSeite,
  roh: { url: string; html: string },
  quelle: string,
): StatusErgebnis {
  const stand = seite.serverzeit ?? new Date().toISOString();
  pruefeStand(db, "trainingslager", stand);
  const info = new Map(seite.spieler.map((s) => [s.pid, ohne(s, "pid", "name")]));
  const aktiv = aktivePids(db);
  const nichtImKader = seite.spieler.filter((s) => !aktiv.has(s.pid)).map((s) => s.name);

  speichereRohseite(db, { art: "trainingslager", url: roh.url, status: null, htmlRoh: roh.html, htmlDom: null }, stand);
  const r = aktualisiereSpieler(
    db,
    (alt) => {
      const tl = info.get(alt.pid);
      const neu: SpielerDaten = {
        ...alt,
        status: { ...alt.status, trainingslager: !!tl },
        statusStand: { ...alt.statusStand, trainingslager: stand },
      };
      if (tl) neu.trainingslagerInfo = tl;
      else delete neu.trainingslagerInfo;
      return neu;
    },
    quelle,
    stand,
  );
  return { ...r, nichtImKader, stand };
}

export function speichereTaktik(
  db: Database.Database,
  seite: TaktikSeite,
  roh: { url: string; html: string },
  quelle: string,
): StatusErgebnis & { unbekannt: string[] } {
  const stand = seite.serverzeit ?? new Date().toISOString();
  pruefeStand(db, "aufstellbar", stand);
  const nachPid = new Map(seite.spieler.map((s) => [s.pid, s]));
  const aktiv = aktivePids(db);
  const nichtImKader = seite.spieler.filter((s) => !aktiv.has(s.pid)).map((s) => s.name);
  const unbekannt = seite.spieler.filter((s) => s.unbekannt).map((s) => `${s.name} (Klasse ${s.unbekannt})`);

  speichereRohseite(db, { art: "taktik", url: roh.url, status: null, htmlRoh: roh.html, htmlDom: null }, stand);
  const r = aktualisiereSpieler(
    db,
    (alt) => {
      const eintrag = nachPid.get(alt.pid);
      const status = { ...alt.status };
      // Nicht auf der Seite oder unbekannter Zustand: keine Aussage, alter Wert fällt weg
      if (eintrag?.aufstellbar === undefined) delete status.aufstellbar;
      else status.aufstellbar = eintrag.aufstellbar;
      return { ...alt, status, statusStand: { ...alt.statusStand, aufstellbar: stand } };
    },
    quelle,
    stand,
  );
  return { ...r, nichtImKader, unbekannt, stand };
}
