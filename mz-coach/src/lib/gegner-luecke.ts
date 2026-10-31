import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { ladeEditorReiter } from "@/lib/db/taktik";
import { heuteInBerlin } from "@/lib/format";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";
import { erzeugeTaktik } from "@/lib/mz/taktik/erzeugen";
import { JUGEND, nameFuer } from "@/lib/portfolio-plan";
import type { StilEintrag } from "@/lib/portfolio";
import { archivLaden } from "@/lib/taktik-archiv";

// Portfolio-Lücke gegen den nächsten Ligagegner (Marcus, 31.10.2026): Gibt es gegen den Typ des Gegners einen bei den
// Top 10 bewährten Stil, den du nicht als Reiter hast, und ist er besser als dein bester Stil gegen diesen Typ, dann ein
// klarer Hinweis mit fertiger Aufstellung (echte Startaufstellung eines Topteams aus einem gewonnenen Spiel, besetzt mit
// deinem Kader). Übernommen wird nur auf Klick in einen Reiter, den du auswählst. Die Empfehlung bleibt unberührt.

export type GegnerLuecke = {
  klasse: string;
  stil: StilEintrag;
  deinBester?: { schluessel: string; quote: number; reiter: string[] };
  name: string; // Name für den Reiter nach dem Inhalt
  xml: string;
  summe: number;
  hinweise: string[];
  reiter: { name: string; fest: boolean; leer: boolean }[]; // Reiter zur Auswahl: leere zuerst, Stammtaktiken zuletzt
};

const FEST = /^(außenr|außenl|kupass)$/i;
const NIE = /^(liga|freund)$/i;

export function gegnerLuecke(db: Database.Database, klasse: string | undefined, top: StilEintrag[]): GegnerLuecke | null {
  if (!klasse) return null;
  const bewaehrt = top.filter((t) => t.bewaehrt);
  const fehlend = bewaehrt.filter((t) => t.imArchiv.length === 0).sort((a, b) => b.quote - a.quote || b.spiele - a.spiele)[0];
  if (!fehlend) return null;
  // Vergleich nur mit deinen bei den Top 10 ebenfalls bewährten Stilen (wenige Spiele sagen nichts)
  const dein = bewaehrt.filter((t) => t.imArchiv.length).sort((a, b) => b.quote - a.quote)[0];
  if (dein && dein.quote >= fehlend.quote) return null;
  const m = fehlend.schluessel.match(/^\S+ (\S+)\/(\S+)$/);
  let e;
  try {
    e = erzeugeTaktik({
      feld: fehlend.beispiel.feld,
      torwart: fehlend.beispiel.torwart,
      tactics: m?.[1],
      playstyle: m?.[2],
      aggression: fehlend.haerte[0]?.[0],
      kader: ladeKader(db),
      spieltag: naechsterLigaspieltag(heuteInBerlin()),
    });
  } catch {
    return null; // zu wenige aufstellbare Spieler
  }
  const editor = ladeEditorReiter(db);
  const liste = editor ? editor.reiter.map((r) => ({ name: r.name, leer: r.spieler < 11 })) : archivLaden(db).map((a) => ({ name: a.reiter, leer: false }));
  const reiter = liste
    .filter((r) => r.name && !NIE.test(r.name) && !JUGEND.test(r.name))
    .map((r) => ({ ...r, fest: FEST.test(r.name) }))
    .sort((a, b) => Number(b.leer) - Number(a.leer) || Number(a.fest) - Number(b.fest));
  const namen = liste.filter((r) => !r.leer).map((r) => r.name);
  return {
    klasse,
    stil: fehlend,
    deinBester: dein ? { schluessel: dein.schluessel, quote: dein.quote, reiter: dein.imArchiv } : undefined,
    name: nameFuer(fehlend.schluessel, namen),
    xml: e.xml,
    summe: e.summe,
    hinweise: e.hinweise,
    reiter,
  };
}
