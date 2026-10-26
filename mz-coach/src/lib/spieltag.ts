import type Database from "better-sqlite3";
import { ladeSpiel } from "@/lib/db/spiele";
import { letzterLauf } from "@/lib/db/spieltag";
import { gegnerAnalyseLaden } from "@/lib/gegner-analyse";
import { spielBericht } from "@/lib/mz/analyse/bericht";
import { gegenIhn } from "@/lib/mz/analyse/gegen-ihn";
import { de } from "@/lib/mz/analyse/gegner";
import { gegnerKlasse, spielMuster, stilText } from "@/lib/mz/analyse/muster";
import { faelligAb } from "@/lib/spieltag-zeit";
import { LIGA_MID_AB } from "@/lib/mz/parser/spielliste";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { topGegenKlasse } from "@/lib/portfolio";
import { archivLaden, taktikZuordnen } from "@/lib/taktik-archiv";
import { TEAM } from "@/lib/wissen/startbasis";

// Spieltag (Auftrag Marcus, 26.10.2026): Spielbericht des letzten Ligaspiels und Taktikvorschlag für das nächste,
// alles aus gespeicherten Daten. Der Vorschlag ist die Empfehlung nach den Faustregeln (mz-wissen.md, Abschnitt 10,
// siehe analysiereGegner); daneben stehen die Belege mit Spielzahl: was gegen diesen Gegner funktioniert hat, was die
// Top 10 gegen seinen Typ spielen und wie deine eigenen Ligaspiele gegen diesen Typ ausgingen. Belege mit wenigen
// Spielen sind Hinweise, keine Beweise; die Seite sagt das dazu.

export type Beleg = { quelle: string; text: string; stuetzt?: boolean };

const quote = (s: number, u: number, n: number) => (s + u / 2) / Math.max(1, s + u + n);

function eigeneLigaspiele(db: Database.Database): StatsSpiel[] {
  const rows = db.prepare("SELECT auswertung_json FROM spiel WHERE auswertung_json IS NOT NULL AND mid > ?").all(LIGA_MID_AB) as { auswertung_json: string }[];
  return rows.map((r) => JSON.parse(r.auswertung_json) as StatsSpiel).filter((s) => s.typ === "1" && s.teams.some((t) => t.id === TEAM.tid));
}

export function spieltagLage(db: Database.Database) {
  const lauf = letzterLauf(db, true);
  const letzterVersuch = letzterLauf(db);

  const letztesSpiel = lauf?.letztesMid ? ladeSpiel(db, lauf.letztesMid) : null;
  const bericht = letztesSpiel ? spielBericht(letztesSpiel, TEAM.tid) : null;

  const gegner = lauf?.gegnerTid ? gegnerAnalyseLaden(db, lauf.gegnerTid) : null;
  const gegen = gegner ? gegenIhn(gegner.tid, gegner.stats) : null;
  // Typ des Gegners aus seinem neuesten ausgewerteten Ligaspiel (wie die Empfehlung)
  const neuestes = gegner?.stats.slice().sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""))[0];
  const klasse = neuestes && gegner ? gegnerKlasse(spielMuster(neuestes, gegner.tid, { anonym: true }).eigen) : undefined;
  const top = klasse ? topGegenKlasse(db, klasse) : [];

  // Eigene Ligaspiele gegen diesen Gegnertyp, je zugeordneter Archiv-Taktik
  const archiv = archivLaden(db);
  const eigene = klasse
    ? eigeneLigaspiele(db)
        .map((s) => ({ s, m: spielMuster(s, TEAM.tid, { anonym: true }) }))
        .filter((x) => gegnerKlasse(x.m.gegner) === klasse)
    : [];
  const eigeneJeTaktik = new Map<string, { S: number; U: number; N: number }>();
  for (const { s, m } of eigene) {
    const k = taktikZuordnen(s, archiv)?.reiter ?? `ohne Archiv-Taktik (${stilText(m.eigen)})`;
    const b = eigeneJeTaktik.get(k) ?? { S: 0, U: 0, N: 0 };
    b[m.ergebnis]++;
    eigeneJeTaktik.set(k, b);
  }

  const empfehlung = gegner?.analyse?.empfehlung;
  const belege: Beleg[] = [];
  if (empfehlung && gegner?.analyse) {
    belege.push({ quelle: "Faustregel (mz-wissen.md, Abschnitt 10)", text: `${empfehlung.regel} ${empfehlung.gruende.join(" ")}`.trim() });
    // Taktik-Einstellung des empfohlenen Reiters aus deinem Archiv
    const reiter = archiv.find((a) => a.reiter === empfehlung.taktik)?.taktik?.team.tactics;
    if (gegen && gegen.spiele.length) {
      const g = reiter ? gegen.nachTaktik.find((x) => x.wert === de(reiter)) : undefined;
      if (!reiter) belege.push({ quelle: "Gegen ihn", text: `Reiter ${empfehlung.taktik} ist nicht im Taktik-Archiv: Einstellung unbekannt, kein Abgleich.` });
      else if (!g) belege.push({ quelle: "Gegen ihn", text: `Kein Gegner spielte gegen ihn mit ${de(reiter)} (wie ${empfehlung.taktik}).` });
      else {
        const q = quote(g.bilanz.S, g.bilanz.U, g.bilanz.N);
        belege.push({
          quelle: "Gegen ihn",
          text: `Mit ${g.wert} (wie ${empfehlung.taktik}) holten seine Gegner ${g.bilanz.S} S / ${g.bilanz.U} U / ${g.bilanz.N} N in ${g.spiele} ${g.spiele === 1 ? "Spiel" : "Spielen"}, Tore ${g.tore.fuer}:${g.tore.gegen}.${g.spiele < 3 ? " Wenige Spiele: nur ein Hinweis." : ""}`,
          stuetzt: g.spiele >= 2 ? q >= 0.5 : undefined,
        });
      }
    }
    const bewaehrt = top.filter((t) => t.bewaehrt).slice(0, 3);
    if (klasse)
      belege.push({
        quelle: "Top 10",
        text: bewaehrt.length
          ? `Gegen „${klasse}“ bewährt (ab 3 Spielen, Punktquote ab 60 %): ${bewaehrt.map((t) => `${t.schluessel} ${t.S}/${t.U}/${t.N}${t.imArchiv.length ? ` (bei dir: ${t.imArchiv.join(", ")})` : ""}`).join("; ")}.`
          : `Gegen „${klasse}“ noch kein Stil der Top 10 mit mindestens 3 Spielen und 60 % Punktquote.`,
      });
    const eigenEmpf = eigeneJeTaktik.get(empfehlung.taktik);
    if (klasse)
      belege.push({
        quelle: "Deine Ligaspiele",
        text: eigene.length
          ? `Gegen „${klasse}“ ${eigene.length} gespeicherte Ligaspiele: ${[...eigeneJeTaktik.entries()].map(([k, b]) => `${k} ${b.S} S / ${b.U} U / ${b.N} N`).join("; ")}.`
          : `Noch kein gespeichertes eigenes Ligaspiel gegen „${klasse}“.`,
        stuetzt: eigenEmpf && eigenEmpf.S + eigenEmpf.U + eigenEmpf.N >= 2 ? quote(eigenEmpf.S, eigenEmpf.U, eigenEmpf.N) >= 0.5 : undefined,
      });
  }

  return {
    lauf,
    letzterVersuch,
    faelligAb: lauf?.anstoss ? faelligAb(lauf.anstoss) : null,
    bericht,
    gegner,
    gegen,
    klasse,
    top,
    empfehlung,
    belege,
  };
}
