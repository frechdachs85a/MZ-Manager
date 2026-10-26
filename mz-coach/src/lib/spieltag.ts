import type Database from "better-sqlite3";
import { ladeSpiel } from "@/lib/db/spiele";
import { letzterLauf } from "@/lib/db/spieltag";
import { gegnerAnalyseLaden } from "@/lib/gegner-analyse";
import { spielBericht } from "@/lib/mz/analyse/bericht";
import { gegenIhn } from "@/lib/mz/analyse/gegen-ihn";
import { steckbrief } from "@/lib/mz/analyse/steckbrief";
import { de, stilDe } from "@/lib/mz/analyse/gegner";
import { gegnerKlasse, spielMuster, stilText } from "@/lib/mz/analyse/muster";
import { faelligAb } from "@/lib/spieltag-zeit";
import { LIGA_MID_AB } from "@/lib/mz/parser/spielliste";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { kaderwertVergleich } from "@/lib/kaderwert";
import { topGegenKlasse } from "@/lib/portfolio";
import { archivLaden, taktikZuordnen } from "@/lib/taktik-archiv";
import { ladeKader } from "@/lib/db/kader";
import type { FeldSpieler } from "@/components/spielfeld";
import type { Befund } from "@/lib/mz/taktik/pruefer";
import { TAKTIKEN, TEAM } from "@/lib/wissen/startbasis";
import { scoutBericht, scoutEntscheidung } from "@/lib/wissen/scoutspiele";
import { ladeTaktiken } from "@/lib/db/taktik";
import { anpassen } from "@/lib/mz/taktik/anpassen";
import { erzeugeTaktik } from "@/lib/mz/taktik/erzeugen";

// Spieltag (Auftrag Marcus, 26.10.2026): Spielbericht des letzten Ligaspiels und Taktikvorschlag für das nächste,
// alles aus gespeicherten Daten. Der Vorschlag ist die Empfehlung nach den Faustregeln (mz-wissen.md, Abschnitt 10,
// siehe analysiereGegner); daneben stehen die Belege mit Spielzahl: was gegen diesen Gegner funktioniert hat, was die
// Top 10 gegen seinen Typ spielen und wie deine eigenen Ligaspiele gegen diesen Typ ausgingen. Belege mit wenigen
// Spielen sind Hinweise, keine Beweise; die Seite sagt das dazu.

const datumKurz = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join(".").slice(0, 6) : "?");

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
    const k = taktikZuordnen(s, archiv)?.reiter ?? `ohne Archiv-Taktik (${stilDe(stilText(m.eigen))})`;
    const b = eigeneJeTaktik.get(k) ?? { S: 0, U: 0, N: 0 };
    b[m.ergebnis]++;
    eigeneJeTaktik.set(k, b);
  }

  // Seine Startaufstellung im neuesten ausgewerteten Ligaspiel (Bild) und der Kaderwert-Vergleich der Startelf
  const gegnerAufstellung =
    neuestes && gegner
      ? {
          mid: neuestes.mid,
          datum: neuestes.datum,
          gegen: neuestes.teams.find((t) => t.id !== gegner.tid)?.name ?? "",
          feld: neuestes.spieler
            .filter((p) => p.teamId === gegner.tid && p.editor)
            .map((p) => ({ x: p.editor!.x, y: p.editor!.y, label: p.name.split(" ").at(-1)!, torwart: p.torwart })),
          formation: gegner.analyse?.spiele.find((x) => x.mid === neuestes.mid)?.formation.text,
          einstellung: (() => {
            const t = neuestes.teams.find((x) => x.id === gegner.tid)!;
            return `${de(t.tactic)} / ${de(t.playstyle)} / ${de(t.aggression)}`;
          })(),
        }
      : null;
  const kaderwert = gegner ? kaderwertVergleich(db, gegner.tid) : null;
  const brief = gegner ? steckbrief(gegner.tid, gegner.stats) : null;

  const empfehlung = gegner?.analyse?.empfehlung
    ? {
        ...gegner.analyse.empfehlung,
        // Der Hinweis "Kaderwert-Vergleich fehlt" entfällt, sobald beide Startelf-Werte da sind
        vorbehalte: gegner.analyse.empfehlung.vorbehalte.filter((v) => !(kaderwert?.eigen && kaderwert.gegner && v.startsWith("Kaderwert-Vergleich fehlt"))),
      }
    : undefined;
  // Vorschlag: Liegen eigene Scoutspiele gegen genau diesen Gegner vor (mz-wissen.md, Abschnitt 12), entscheiden sie
  // (direkte Spiele wiegen schwerer als die allgemeine Faustregel); sonst die Faustregel aus Abschnitt 10.
  const scout = gegner ? scoutBericht(gegner.tid) : undefined;
  const scoutWahl = scout ? scoutEntscheidung(scout) : null;
  const vorschlag: { taktik: string; quelle: string; begruendung: string } | null = scoutWahl
    ? { taktik: scoutWahl.reiter, quelle: "Deine Scoutspiele gegen ihn", begruendung: scoutWahl.begruendung }
    : empfehlung
      ? { taktik: empfehlung.taktik, quelle: "Faustregel (mz-wissen.md, Abschnitt 10)", begruendung: `${empfehlung.regel} ${empfehlung.gruende.join(" ")}`.trim() }
      : null;

  const belege: Beleg[] = [];
  if (scout && scoutWahl) {
    belege.push({
      quelle: "Scoutspiele",
      text: `${scout.quelle}: ${scout.taktiken.map((t) => `${t.reiter} ${t.S} S / ${t.U} U / ${t.N} N, Tore ${t.tore}:${t.gegentore}${t.ecken ? `, Ecken ${t.ecken[0]}:${t.ecken[1]}` : ""}`).join("; ")}. ${scoutWahl.begruendung}`,
      stuetzt: true,
    });
  }
  if (empfehlung && gegner?.analyse && vorschlag) {
    const gleich = empfehlung.taktik === vorschlag.taktik;
    belege.push({
      quelle: "Faustregel (mz-wissen.md, Abschnitt 10)",
      text:
        `${empfehlung.regel} ${empfehlung.gruende.join(" ")}`.trim() +
        (gleich ? "" : ` Die Faustregel allein ergäbe ${empfehlung.taktik}; die direkten Scoutspiele gegen ihn wiegen schwerer.`),
      stuetzt: scoutWahl ? gleich : undefined,
    });
    // Taktik-Einstellung des vorgeschlagenen Reiters aus deinem Archiv
    const reiter = archiv.find((a) => a.reiter === vorschlag.taktik)?.taktik?.team.tactics;
    if (gegen && gegen.spiele.length) {
      const g = reiter ? gegen.nachTaktik.find((x) => x.wert === de(reiter)) : undefined;
      if (!reiter) belege.push({ quelle: "Gegen ihn", text: `Reiter ${vorschlag.taktik} ist nicht im Taktik-Archiv: Einstellung unbekannt, kein Abgleich.` });
      else if (!g) belege.push({ quelle: "Gegen ihn", text: `Kein Gegner spielte gegen ihn mit ${de(reiter)} (wie ${vorschlag.taktik}).` });
      else {
        const q = quote(g.bilanz.S, g.bilanz.U, g.bilanz.N);
        belege.push({
          quelle: "Gegen ihn",
          text: `Mit ${g.wert} (wie ${vorschlag.taktik}) holten seine Gegner ${g.bilanz.S} S / ${g.bilanz.U} U / ${g.bilanz.N} N in ${g.spiele} ${g.spiele === 1 ? "Spiel" : "Spielen"}, Tore ${g.tore.fuer}:${g.tore.gegen}.${g.spiele < 3 ? " Wenige Spiele: nur ein Hinweis." : ""}`,
          stuetzt: g.spiele >= 2 ? q >= 0.5 : undefined,
        });
      }
    }
    const bewaehrt = top.filter((t) => t.bewaehrt).slice(0, 3);
    if (klasse)
      belege.push({
        quelle: "Top 10",
        text: bewaehrt.length
          ? `Gegen „${klasse}“ bewährt (ab 3 Spielen, Punktquote ab 60 %): ${bewaehrt.map((t) => `${stilDe(t.schluessel)} ${t.S} S / ${t.U} U / ${t.N} N${t.imArchiv.length ? ` (bei dir: ${t.imArchiv.join(", ")})` : ""}`).join("; ")}.`
          : `Gegen „${klasse}“ noch kein Stil der Top 10 mit mindestens 3 Spielen und 60 % Punktquote.`,
      });
    if (kaderwert?.eigen && kaderwert.gegner) {
      const e = kaderwert.eigen.summe;
      const g = kaderwert.gegner.summe;
      const eur = (n: number) => `${new Intl.NumberFormat("de-DE").format(Math.round(n))} €`;
      belege.push({
        quelle: "Kaderwert",
        text:
          `Startelf-Marktwert: deine ${eur(e)} (${kaderwert.eigen.mitWert} von ${kaderwert.eigen.spieler} Spielern), seine ${eur(g)} (${kaderwert.gegner.mitWert} von ${kaderwert.gegner.spieler}). ` +
          (g > e
            ? `Er ist laut Marktwert stärker (${Math.round((g / e - 1) * 100)} % mehr): „Gegen starke Gegner beim Standard bleiben“ (Abschnitt 10).`
            : `Du bist laut Marktwert stärker (${Math.round((e / g - 1) * 100)} % mehr).`),
      });
    }
    const eigenEmpf = eigeneJeTaktik.get(vorschlag.taktik);
    if (klasse)
      belege.push({
        quelle: "Deine Ligaspiele",
        text: eigene.length
          ? `Gegen „${klasse}“ ${eigene.length} gespeicherte Ligaspiele: ${[...eigeneJeTaktik.entries()].map(([k, b]) => `${k} ${b.S} S / ${b.U} U / ${b.N} N`).join("; ")}.`
          : `Noch kein gespeichertes eigenes Ligaspiel gegen „${klasse}“.`,
        stuetzt: eigenEmpf && eigenEmpf.S + eigenEmpf.U + eigenEmpf.N >= 2 ? quote(eigenEmpf.S, eigenEmpf.U, eigenEmpf.N) >= 0.5 : undefined,
      });
  }

  // Aufstellung des vorgeschlagenen Reiters: aus deinem Taktik-Archiv (mit Namen und Prüfung gegen den heutigen
  // Kader), sonst die Koordinaten aus mz-wissen.md, Abschnitt 8 (ohne Namen)
  let aufstellung: { quelle: string; feld: FeldSpieler[]; einstellung?: string; fehler: Befund[]; hinweise: Befund[] } | null = null;
  if (vorschlag) {
    const a = archiv.find((x) => x.reiter === vorschlag.taktik);
    if (a?.taktik) {
      const namen = new Map(ladeKader(db).map((k) => [k.pid, k.name]));
      const kurz = (n?: string) => (n ? n.split(" ").at(-1)! : "?");
      aufstellung = {
        quelle: `Taktik-Archiv, Reiter ${a.reiter} (gespeichert ${a.gespeichert.slice(0, 10).split("-").reverse().join(".")})`,
        feld: a.taktik.pos.map((p) => ({ x: p.start.x, y: p.start.y, label: kurz(namen.get(p.pid)), torwart: p.pos === "goalie" })),
        einstellung: [a.taktik.team.tactics, a.taktik.team.playstyle, a.taktik.team.aggression].filter(Boolean).map((v) => de(v!)).join(" / ") || undefined,
        fehler: a.pruefung?.fehler ?? [],
        hinweise: a.pruefung?.hinweise ?? [],
      };
    } else {
      const t = TAKTIKEN.find((x) => x.name === vorschlag.taktik);
      if (t?.koordinaten)
        aufstellung = {
          quelle: `mz-wissen.md, Abschnitt 8 (${t.inhalt}); Reiter nicht im Taktik-Archiv, daher ohne Namen und ohne Prüfung`,
          feld: t.koordinaten.map((k) => ({ x: k.x, y: k.y, label: k.rolle })),
          fehler: [],
          hinweise: [],
        };
    }
  }

  // Anpassungen aus den Scoutspielen und der Taktik-Code: Archiv-Taktik mit Anpassungen, oder (nicht im Archiv)
  // neu erzeugt aus den Koordinaten in mz-wissen.md mit deiner besten Besetzung
  const anpassungen = (scout?.anpassungen ?? []).filter((a) => a.art === "hinweis" || a.reiter === vorschlag?.taktik);
  let taktikCode: { art: "archiv" | "angepasst" | "neu" | "editor"; xml: string; geaendert: string[]; hinweise: string[] } | null = null;
  if (vorschlag) {
    const roh = ladeTaktiken(db).find((t) => t.reiter === vorschlag.taktik);
    if (roh) {
      const r = anpassen(roh.xml, anpassungen);
      taktikCode = { art: r.geaendert.length ? "angepasst" : "archiv", xml: r.xml, geaendert: r.geaendert, hinweise: [] };
    } else if (TAKTIKEN.some((x) => x.name === vorschlag.taktik)) {
      // Reiter gibt es in deinem Editor (mz-wissen.md, Abschnitt 8), nur nicht im Archiv dieser Seite: keine neue XML
      taktikCode = { art: "editor", xml: "", geaendert: [], hinweise: [] };
    } else {
      const t = TAKTIKEN.find((x) => x.name === vorschlag.taktik);
      const st = scout?.taktiken.find((x) => x.reiter === vorschlag.taktik)?.einstellung.split(" / ");
      const rueck: Record<string, string> = { Flügel: "wings", Kurzpass: "shortpass", "lange Bälle": "longball", offensiv: "offensive", normal: "normal", defensiv: "defensive", aggressiv: "aggressive", passiv: "passive" };
      if (t?.koordinaten) {
        try {
          const e = erzeugeTaktik({
            feld: t.koordinaten.map((k) => ({ x: k.x, y: k.y })),
            tactics: st ? rueck[st[0]] : undefined,
            playstyle: st ? rueck[st[1]] : undefined,
            aggression: st ? rueck[st[2]] : undefined,
            kader: ladeKader(db),
            spieltag: lauf?.anstoss ? new Date(new Date(lauf.anstoss).toLocaleString("en-US", { timeZone: "Europe/Berlin" })) : new Date(),
          });
          taktikCode = { art: "neu", xml: e.xml, geaendert: [], hinweise: [...(st ? [] : ["Einstellung nicht belegt: Flügel/normal/normal als Platzhalter, im Editor prüfen."]), ...e.hinweise] };
        } catch (err) {
          taktikCode = null;
          void err;
        }
      }
    }
  }

  // Das Wichtigste über den Gegner auf einen Blick (Marcus, 26.10.2026): Form, erwartete Formation gegen dich,
  // Trends, Torgefahr, Schwächen, Kaderwert. Nur Aussagen aus den gespeicherten Spielen, mit Spielzahl.
  const kurzfassung: { titel: string; text: string }[] = [];
  if (brief && brief.spiele.length && gegner) {
    const b = brief.bilanz;
    const letzte = brief.spiele.slice(-3).map((x) => `${x.tore.eigen}:${x.tore.gegner} ${x.heim ? "gegen" : "bei"} ${x.gegner}`);
    kurzfassung.push({ titel: "Form", text: `${b.S} Siege, ${b.U} Remis, ${b.N} Niederlagen in ${brief.spiele.length} Ligaspielen, Tore ${b.tore}:${b.gegentore}. Zuletzt: ${letzte.join(", ")}.` });
    if (brief.stammElf) {
      const st = brief.spiele.find((x) => x.elf === brief.stammElf!.elf) ?? brief.spiele.at(-1)!;
      const abw = brief.stammElf.abweichungen.filter((a) => /anderen Plätzen/.test(a.text));
      const umstellung = abw.map((a) => {
        const g = gegen?.spiele.find((x) => x.mid === a.mid);
        return g ? `${datumKurz(a.datum)} gegen ${g.name} (${g.stil}, Typ „${g.klasse}“)` : `${datumKurz(a.datum)}`;
      });
      kurzfassung.push({
        titel: "Erwartete Formation gegen dich",
        text:
          `${st.formation}, ${st.einstellung}: dieselbe Aufstellung in ${brief.stammElf.positionen} von ${brief.stammElf.von} Ligaspielen` +
          (brief.stammElf.positionen !== brief.stammElf.spiele ? ` (mit denselben Spielern in ${brief.stammElf.spiele})` : "") +
          (brief.breite ? `, äußerste Feldspieler bei x ${brief.breite.min} und ${brief.breite.max}${brief.breite.min > 40 && brief.breite.max < 170 ? " (beide Flügel leer)" : ""}` : "") +
          "." +
          (umstellung.length ? ` Umgestellt hat er ${umstellung.length === 1 ? "einmal" : `${umstellung.length}-mal`}: ${umstellung.join("; ")}.` : ""),
      });
    }
    const trends = (gegner.regeln ?? []).filter((r) => r.art === "wechsel" || r.art === "taktik").map((r) => r.text);
    if (trends.length) kurzfassung.push({ titel: "Wechsel und Regeln", text: trends.slice(0, 3).join(" ") });
    const schuesse = brief.spiele.map((x) => x.schuesseTor).filter((x): x is number => x !== undefined);
    kurzfassung.push({
      titel: "Torgefahr",
      text:
        `${brief.torschuetzen.slice(0, 3).map(([n, z]) => `${n} ${z}`).join(", ") || "keine Tore"}` +
        (schuesse.length ? `; im Schnitt ${(schuesse.reduce((a, c) => a + c, 0) / schuesse.length).toFixed(1).replace(".", ",")} Schüsse aufs Tor je Spiel.` : "."),
    });
    const gegentore = brief.spiele.flatMap((x) => x.gegentorMinuten);
    if (gegentore.length) {
      const spaet = gegentore.filter((m) => m > 70).length;
      kurzfassung.push({ titel: "Gegentore", text: `${gegentore.length} Gegentore, davon ${spaet} nach der 70. Minute und ${gegentore.filter((m) => m <= 45).length} in der ersten Halbzeit.` });
    }
    const punkteten = gegen?.spiele.filter((x) => x.seinErgebnis !== "S") ?? [];
    if (punkteten.length)
      kurzfassung.push({
        titel: "Wer gegen ihn gepunktet hat",
        text: punkteten.map((x) => `${x.name} ${x.seinErgebnis === "N" ? "gewann" : "spielte remis"} ${x.tore.fuer}:${x.tore.gegen} mit ${x.stil}`).join("; ") + ".",
      });
    if (kaderwert?.eigen && kaderwert.gegner) {
      const e = kaderwert.eigen.summe;
      const g = kaderwert.gegner.summe;
      kurzfassung.push({ titel: "Kaderwert der Startelf", text: g > e ? `Er ist ${Math.round((g / e - 1) * 100)} % mehr wert als deine Startelf.` : `Deine Startelf ist ${Math.round((e / g - 1) * 100)} % mehr wert.` });
    }
  }

  return {
    kurzfassung,
    vorschlag,
    anpassungen,
    taktikCode,
    scout,
    aufstellung,
    gegnerAufstellung,
    kaderwert,
    steckbrief: brief,
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
