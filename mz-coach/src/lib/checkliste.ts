import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { datumZeit } from "@/lib/format";
import { letzterGegner } from "@/lib/gegner-analyse";
import { archivLaden } from "@/lib/taktik-archiv";

// Spieltag-Checkliste: was vor dem nächsten Ligaspiel erledigt sein sollte. Jeder Punkt aus gespeicherten
// Daten; was die Seite nicht wissen kann, steht als "offen" mit Grund da.
export type Punkt = { titel: string; status: "ok" | "warnung" | "offen"; text: string; href?: string };

const STUNDEN = 24;
const alt = (iso: string, jetzt: Date) => jetzt.getTime() - new Date(iso).getTime() > STUNDEN * 3600_000;

// Checkliste vor dem nächsten Ligaspiel
export function spieltagCheckliste(db: Database.Database, jetzt = new Date()): Punkt[] {
  const kader = ladeKader(db);
  const punkte: Punkt[] = [];

  const kaderStand = kader.reduce((m, s) => (s.abgerufen > m ? s.abgerufen : m), "");
  punkte.push(
    !kaderStand
      ? { titel: "Kader eingelesen", status: "offen", text: "Noch kein Kaderabruf.", href: "/einstellungen" }
      : { titel: "Kader aktuell", status: alt(kaderStand, jetzt) ? "warnung" : "ok", text: `Stand ${datumZeit(kaderStand)}${alt(kaderStand, jetzt) ? `, älter als ${STUNDEN} Stunden` : ""}.`, href: "/kader" },
  );

  const kegel = kader.map((s) => s.statusStand?.aufstellbar).filter((x): x is string => !!x).sort().at(-1);
  punkte.push(
    !kegel
      ? { titel: "Kegel geprüft", status: "offen", text: "Taktikseite noch nicht eingelesen.", href: "/einstellungen" }
      : { titel: "Kegel geprüft", status: alt(kegel, jetzt) ? "warnung" : "ok", text: `Taktikseite Stand ${datumZeit(kegel)}.` },
  );

  const g = letzterGegner(db);
  if (!g?.analyse) {
    punkte.push({ titel: "Gegner analysiert", status: "offen", text: "Noch kein Gegner mit ausgewerteten Ligaspielen.", href: "/gegner" });
    return punkte;
  }
  const fehlen = g.liga.length - g.stats.length;
  punkte.push({
    titel: "Gegner analysiert",
    status: fehlen > 0 ? "warnung" : "ok",
    text: `${g.name}: ${g.stats.length} von ${g.liga.length} Ligaspielen ausgewertet (zuletzt eingelesener Gegner; ob er der nächste ist, zeigt erst der Spielplan-Abruf).`,
    href: `/gegner/${g.tid}`,
  });

  const name = g.analyse.empfehlung.taktik;
  const eintrag = archivLaden(db).find((a) => a.reiter === name);
  if (!eintrag) {
    punkte.push({ titel: `Taktik ${name} im Archiv`, status: "offen", text: "Noch nicht im Archiv. XML aus dem Editor unter „Taktik“ speichern, dann wird sie geprüft.", href: "/taktik" });
    return punkte;
  }
  const p = eintrag.pruefung;
  punkte.push(
    !p
      ? { titel: `Taktik ${name} geprüft`, status: "warnung", text: `XML nicht lesbar: ${eintrag.xmlFehler}`, href: `/taktik/${encodeURIComponent(name)}` }
      : {
          titel: `Taktik ${name} geprüft`,
          status: p.ok ? "ok" : "warnung",
          text: p.ok
            ? `Ohne Fehler gegen den aktuellen Kader (Kegel, Verletzung, Wechselregeln)${p.hinweise.length ? `, ${p.hinweise.length} Hinweise` : ""}.`
            : `${p.fehler.length} Fehler: ${p.fehler.slice(0, 2).map((f) => f.text).join(" ")}${p.fehler.length > 2 ? " …" : ""}`,
          href: `/taktik/${encodeURIComponent(name)}`,
        },
  );
  return punkte;
}
