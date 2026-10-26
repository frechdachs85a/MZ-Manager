import type Database from "better-sqlite3";
import { ladeSpiel } from "@/lib/db/spiele";
import { letzterLauf } from "@/lib/db/spieltag";
import { gegnerAnalyseLaden } from "@/lib/gegner-analyse";
import { spielBericht } from "@/lib/mz/analyse/bericht";
import { gegenIhn } from "@/lib/mz/analyse/gegen-ihn";
import { steckbrief } from "@/lib/mz/analyse/steckbrief";
import { de, formation, stilDe } from "@/lib/mz/analyse/gegner";
import { gegnerKlasse, spielMuster, stilText } from "@/lib/mz/analyse/muster";
import { faelligAb } from "@/lib/spieltag-zeit";
import { LIGA_MID_AB } from "@/lib/mz/parser/spielliste";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { kaderwertVergleich, startelfWerte } from "@/lib/kaderwert";
import { ladeGegnerKader } from "@/lib/db/gegner-kader";
import { startelfAusLetztemSpiel } from "@/lib/db/markt";
import { wertbereich, wertverlauf, type Wertverlauf } from "@/lib/mz/analyse/wertverlauf";
import { seitenVergleich } from "@/lib/mz/analyse/seiten";
import { duelle } from "@/lib/mz/analyse/duelle";
import { skalaAus } from "@/components/spielfeld";
import { quotenJeBereich } from "@/lib/db/wertspiel";
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
  const elfWerte = letztesSpiel ? startelfWerte(db, letztesSpiel) : null;

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
  const gkWerte = new Map(gegner ? ladeGegnerKader(db, gegner.tid).map((k) => [k.pid, k.wert ?? undefined]) : []);
  const gegnerAufstellung =
    neuestes && gegner
      ? {
          mid: neuestes.mid,
          datum: neuestes.datum,
          gegen: neuestes.teams.find((t) => t.id !== gegner.tid)?.name ?? "",
          feld: neuestes.spieler
            .filter((p) => p.teamId === gegner.tid && p.editor)
            .map((p) => ({ x: p.editor!.x, y: p.editor!.y, label: p.name.split(" ").at(-1)!, wert: gkWerte.get(p.id), torwart: p.torwart })),
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
  // Kurze Gründe der Faustregel (Abschnitt 10) für den Matchplan
  const regelKurz = (): string[] => {
    const a = gegner?.analyse;
    if (!a || !empfehlung) return [];
    const neu = a.spiele[0];
    const eng = a.spiele.filter((x) => x.engeMitte).length;
    return [
      a.urteil === "immer_gleich" ? "Spielt immer gleich → anpassen erlaubt" : a.urteil === "duenn" ? "Wenig Daten → Standard" : "Spielt wechselnd → Standard",
      ...(neu.formation.abwehr >= 5 ? [`Fünferkette (${neu.formation.text})`] : []),
      `Enge Mitte in ${eng} von ${a.spiele.length} Spielen`,
      `→ ${empfehlung.taktik}`,
    ];
  };
  const vorschlag: { taktik: string; quelle: string; begruendung: string; kurz: string[] } | null = scoutWahl
    ? { taktik: scoutWahl.reiter, quelle: "Deine Scoutspiele gegen ihn", begruendung: scoutWahl.begruendung, kurz: scoutWahl.kurz }
    : empfehlung
      ? { taktik: empfehlung.taktik, quelle: "Faustregel (mz-wissen.md, Abschnitt 10)", begruendung: `${empfehlung.regel} ${empfehlung.gruende.join(" ")}`.trim(), kurz: regelKurz() }
      : null;

  const belege: Beleg[] = [];
  if (scout && scoutWahl) {
    belege.push({
      quelle: "Scoutspiele",
      text: scout.taktiken.map((t) => `${t.reiter} ${t.S}/${t.U}/${t.N}, Tore ${t.tore}:${t.gegentore}`).join(" · "),
      stuetzt: true,
    });
  }
  if (empfehlung && gegner?.analyse && vorschlag) {
    const gleich = empfehlung.taktik === vorschlag.taktik;
    belege.push({
      quelle: "Faustregel (mz-wissen.md, Abschnitt 10)",
      text: regelKurz().join(" · ") + (gleich ? "" : ` (Scoutspiele wiegen schwerer)`),
      stuetzt: scoutWahl ? gleich : undefined,
    });
    // Taktik-Einstellung des vorgeschlagenen Reiters aus deinem Archiv
    const reiter = archiv.find((a) => a.reiter === vorschlag.taktik)?.taktik?.team.tactics;
    if (gegen && gegen.spiele.length) {
      const g = reiter ? gegen.nachTaktik.find((x) => x.wert === de(reiter)) : undefined;
      if (!reiter) belege.push({ quelle: "Gegen ihn", text: `${vorschlag.taktik} nicht im Archiv: kein Abgleich` });
      else if (!g) belege.push({ quelle: "Gegen ihn", text: `Niemand spielte gegen ihn mit ${de(reiter)}` });
      else {
        const q = quote(g.bilanz.S, g.bilanz.U, g.bilanz.N);
        belege.push({
          quelle: "Gegen ihn",
          text: `Seine Gegner mit ${g.wert}: ${g.bilanz.S}/${g.bilanz.U}/${g.bilanz.N}, Tore ${g.tore.fuer}:${g.tore.gegen}${g.spiele < 3 ? " (wenige Spiele)" : ""}`,
          stuetzt: g.spiele >= 2 ? q >= 0.5 : undefined,
        });
      }
    }
    const bewaehrt = top.filter((t) => t.bewaehrt).slice(0, 3);
    if (klasse)
      belege.push({
        quelle: "Top 10",
        text: bewaehrt.length
          ? `Gegen „${klasse}“ bewährt: ${bewaehrt.map((t) => `${stilDe(t.schluessel)} ${t.S}/${t.U}/${t.N}${t.imArchiv.length ? ` (hast du: ${t.imArchiv.join(", ")})` : ""}`).join(" · ")}`
          : `Gegen „${klasse}“ noch kein bewährter Stil`,
      });
    if (kaderwert?.eigen && kaderwert.gegner) {
      const e = kaderwert.eigen.summe;
      const g = kaderwert.gegner.summe;
      const eur = (n: number) => `${new Intl.NumberFormat("de-DE").format(Math.round(n))} €`;
      belege.push({
        quelle: "Kaderwert",
        text: `Du ${eur(e)} · er ${eur(g)} → ${g > e ? `er +${Math.round((g / e - 1) * 100)} % (Standard bleiben)` : `du +${Math.round((e / g - 1) * 100)} %`}`,
      });
    }
    const eigenEmpf = eigeneJeTaktik.get(vorschlag.taktik);
    if (klasse)
      belege.push({
        quelle: "Deine Ligaspiele",
        text: eigene.length
          ? `Gegen „${klasse}“: ${[...eigeneJeTaktik.entries()].map(([k, b]) => `${k} ${b.S}/${b.U}/${b.N}`).join(" · ")}`
          : `Noch kein eigenes Ligaspiel gegen „${klasse}“`,
        stuetzt: eigenEmpf && eigenEmpf.S + eigenEmpf.U + eigenEmpf.N >= 2 ? quote(eigenEmpf.S, eigenEmpf.U, eigenEmpf.N) >= 0.5 : undefined,
      });
  }

  // Aufstellung des vorgeschlagenen Reiters: aus deinem Taktik-Archiv (mit Namen und Prüfung gegen den heutigen
  // Kader), sonst die Koordinaten aus mz-wissen.md, Abschnitt 8 (ohne Namen)
  let aufstellung: { quelle: string; feld: FeldSpieler[]; einstellung?: string; fehler: Befund[]; hinweise: Befund[] } | null = null;
  if (vorschlag) {
    const a = archiv.find((x) => x.reiter === vorschlag.taktik);
    if (a?.taktik) {
      const kaderL = ladeKader(db);
      const namen = new Map(kaderL.map((k) => [k.pid, k.name]));
      const mw = new Map(kaderL.map((k) => [k.pid, k.marktwert]));
      const kurz = (n?: string) => (n ? n.split(" ").at(-1)! : "?");
      aufstellung = {
        quelle: `Taktik-Archiv, Reiter ${a.reiter} (gespeichert ${a.gespeichert.slice(0, 10).split("-").reverse().join(".")})`,
        feld: a.taktik.pos.map((p) => ({ x: p.start.x, y: p.start.y, label: kurz(namen.get(p.pid)), wert: mw.get(p.pid), torwart: p.pos === "goalie" })),
        einstellung: [a.taktik.team.tactics, a.taktik.team.playstyle, a.taktik.team.aggression].filter(Boolean).map((v) => de(v!)).join(" / ") || undefined,
        fehler: a.pruefung?.fehler ?? [],
        hinweise: a.pruefung?.hinweise ?? [],
      };
    } else {
      const t = TAKTIKEN.find((x) => x.name === vorschlag.taktik);
      if (t?.koordinaten) {
        // Nicht im Archiv: Plätze aus mz-wissen.md, besetzt mit deiner besten aufstellbaren Elf (für die Heatmap)
        let feld: FeldSpieler[] = t.koordinaten.map((k) => ({ x: k.x, y: k.y, label: k.rolle }));
        try {
          const e = erzeugeTaktik({
            feld: t.koordinaten.map((k) => ({ x: k.x, y: k.y })),
            kader: ladeKader(db),
            spieltag: lauf?.anstoss ? new Date(new Date(lauf.anstoss).toLocaleString("en-US", { timeZone: "Europe/Berlin" })) : new Date(),
          });
          feld = e.elf.map((b) => ({ x: b.platz.x, y: b.platz.y, label: b.spieler.name.split(" ").at(-1)!, wert: b.spieler.marktwert, torwart: b.platz.torwart }));
        } catch {
          // zu wenige aufstellbare Spieler: Rollen ohne Namen
        }
        aufstellung = {
          quelle: `Plätze aus mz-wissen.md (${t.inhalt}), besetzt mit deiner besten aufstellbaren Elf. Reiter nicht im Archiv.`,
          feld,
          fehler: [],
          hinweise: [],
        };
      }
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

  // Das Wichtigste über den Gegner auf einen Blick (Marcus, 26.10.2026): kurze Stichpunkte, Zahlen statt Sätze.
  const kurzfassung: { titel: string; punkte: string[] }[] = [];
  const mioK = (n?: number) => (n === undefined ? "?" : `${(n / 1_000_000).toFixed(2).replace(".", ",")} Mio`);
  if (brief && brief.spiele.length && gegner) {
    const b = brief.bilanz;
    kurzfassung.push({
      titel: "Form",
      punkte: [
        `${b.S} S · ${b.U} U · ${b.N} N in ${brief.spiele.length} Ligaspielen`,
        `Tore ${b.tore}:${b.gegentore}`,
        `Zuletzt: ${brief.spiele.slice(-3).map((x) => `${x.tore.eigen}:${x.tore.gegner} ${x.heim ? "vs" : "bei"} ${x.gegner}`).join(" · ")}`,
      ],
    });
    if (brief.stammElf) {
      const st = brief.spiele.find((x) => x.elf === brief.stammElf!.elf) ?? brief.spiele.at(-1)!;
      const abw = brief.stammElf.abweichungen.filter((x) => /anderen Plätzen/.test(x.text));
      kurzfassung.push({
        titel: "Erwartete Formation",
        punkte: [
          `${st.formation} · ${st.einstellung}`,
          `So in ${brief.stammElf.positionen} von ${brief.stammElf.von} Spielen`,
          ...(brief.breite && brief.breite.min > 40 && brief.breite.max < 170 ? [`Flügel leer (x ${brief.breite.min} bis ${brief.breite.max})`] : []),
          ...(abw.length > 2
            ? [`${abw.length}-mal umgestellt, zuletzt ${abw.slice(-2).map((x) => datumKurz(x.datum)).join(" und ")}`]
            : abw.map((x) => {
                const g = gegen?.spiele.find((y) => y.mid === x.mid);
                return `Umgestellt ${datumKurz(x.datum)}${g ? ` gegen ${g.name} (${g.stil})` : ""}`;
              })),
        ],
      });
    }
    const wechselPunkte = (gegner.regeln ?? [])
      .filter((r) => r.art === "wechsel" || r.art === "taktik")
      .slice(0, 3)
      .map((r) => r.text.replace(/\s*\([^)]*\)/g, "").replace(/\.$/, ""));
    if (wechselPunkte.length) kurzfassung.push({ titel: "Wechsel und Regeln", punkte: wechselPunkte });
    const schuesse = brief.spiele.map((x) => x.schuesseTor).filter((x): x is number => x !== undefined);
    kurzfassung.push({
      titel: "Torgefahr",
      punkte: [
        ...brief.torschuetzen.slice(0, 3).map(([n, z]) => `${n}: ${z} Tore`),
        ...(schuesse.length ? [`Ø ${(schuesse.reduce((x, c) => x + c, 0) / schuesse.length).toFixed(1).replace(".", ",")} Schüsse aufs Tor je Spiel`] : []),
      ],
    });
    const gegentore = brief.spiele.flatMap((x) => x.gegentorMinuten);
    if (gegentore.length)
      kurzfassung.push({
        titel: "Gegentore",
        punkte: [`${gegentore.length} insgesamt`, `${gegentore.filter((m) => m <= 45).length} in der 1. Halbzeit`, `${gegentore.filter((m) => m > 70).length} nach der 70.`],
      });
    const punkteten = gegen?.spiele.filter((x) => x.seinErgebnis !== "S") ?? [];
    if (punkteten.length)
      kurzfassung.push({
        titel: "Gegen ihn gepunktet",
        punkte: punkteten.map((x) => `${x.name} ${x.tore.fuer}:${x.tore.gegen} (${x.seinErgebnis === "N" ? "Sieg" : "Remis"}) mit ${x.stil}`),
      });
    if (kaderwert?.eigen && kaderwert.gegner) {
      const e = kaderwert.eigen.summe;
      const g = kaderwert.gegner.summe;
      const d = Math.round((e / g - 1) * 100);
      kurzfassung.push({ titel: "Kaderwert Startelf", punkte: [`Du ${mioK(e)} · er ${mioK(g)}`, `${d >= 0 ? "+" : ""}${d} % für ${d >= 0 ? "dich" : "ihn"}`] });
    }
  }

  // Kaderwert über die Spielzeit (mz-wissen.md, Abschnitt 14): deine Elf und Zeitwechsel aus dem Archiv-Reiter des
  // Vorschlags (sonst Startelf des letzten Spiels und die von Marcus genannten Wechsel), seine Elf aus dem neuesten
  // Ligaspiel und die Wechsel, die er in mindestens der Hälfte seiner Ligaspiele so gemacht hat.
  let verlauf: (Wertverlauf & { quelleEigen: string; quelleGegner: string }) | null = null;
  if (gegner && neuestes && vorschlag) {
    const kaderListe = ladeKader(db);
    const eigenWert = new Map(kaderListe.map((k) => [k.pid, k.marktwert]));
    const gk = new Map(ladeGegnerKader(db, gegner.tid).map((k) => [k.pid, k.wert ?? undefined]));
    const namen = new Map<number, string>([...kaderListe.map((k) => [k.pid, k.name] as [number, string]), ...neuestes.spieler.map((p) => [p.id, p.name] as [number, string])]);
    for (const st of gegner.stats) for (const p of st.spieler) if (!namen.has(p.id)) namen.set(p.id, p.name);
    const arch = archiv.find((a) => a.reiter === vorschlag.taktik)?.taktik;
    const startElf = startelfAusLetztemSpiel(db);
    const eigeneElf = arch ? arch.pos.map((p) => p.pid) : (startElf?.elf.map((p) => p.pid) ?? []);
    const zeitregel = (r: Record<string, string>) =>
      r.check_time === "true" && r.check_goal_condition !== "true" && r.check_player_event !== "true" && /^\d+$/.test(r.out_player ?? "") && /^\d+$/.test(r.in_player_id ?? "");
    const eigeneWechsel = arch
      ? arch.regeln.filter(zeitregel).map((r) => ({ minute: Number(r.time), raus: Number(r.out_player), rein: Number(r.in_player_id) }))
      : (TAKTIKEN.find((t) => t.name === vorschlag.taktik)?.wechsel ?? []);
    const muster = new Map<string, { w: { minute: number; raus: number; rein: number }; n: number }>();
    for (const st of gegner.stats)
      for (const w of st.wechsel.filter((x) => x.teamId === gegner.tid && x.grund === "preset")) {
        const m = w.regelMinute ?? w.minute;
        const k = `${m}|${w.raus}|${w.rein}`;
        muster.set(k, { w: { minute: m, raus: w.raus, rein: w.rein }, n: (muster.get(k)?.n ?? 0) + 1 });
      }
    const gegnerWechsel = [...muster.values()].filter((x) => x.n * 2 >= gegner.stats.length).map((x) => x.w);
    if (eigeneElf.length === 11) {
      verlauf = {
        ...wertverlauf({
          eigeneElf,
          gegnerElf: neuestes.spieler.filter((p) => p.teamId === gegner.tid && p.origin).map((p) => p.id),
          eigeneWechsel,
          gegnerWechsel,
          wert: (pid) => (eigenWert.has(pid) ? eigenWert.get(pid) : gk.get(pid)),
          name: (pid) => (namen.get(pid) ?? `pid ${pid}`).split(" ").at(-1)!,
        }),
        quelleEigen: arch
          ? `Aufstellung und Zeitwechsel aus deinem Archiv-Reiter ${vorschlag.taktik}`
          : `Startelf deines letzten Ligaspiels, Wechsel ${eigeneWechsel.length ? `von ${vorschlag.taktik} laut Marcus (26.10.2026)` : "unbekannt (Reiter nicht im Archiv)"}`,
        quelleGegner: `Startelf aus seinem neuesten Ligaspiel; Wechsel, die er in mindestens der Hälfte seiner ${gegner.stats.length} Ligaspiele genau so gemacht hat`,
      };
    }
  }

  if (verlauf) {
    const v = verlauf.gewichtet.verhaeltnis;
    const f = (n: number) => n.toFixed(2).replace(".", ",");
    belege.push({
      quelle: "Kaderwert über 90 Minuten",
      text:
        `Gewichtet ${f(v)} · ` +
        (() => {
          const q = quotenJeBereich(db, "feld").find((x) => v >= x.von && v < x.bis);
          return q && q.spiele >= 30
            ? `bei ${q.bereich}: ${Math.round((q.S / q.spiele) * 100)} % S / ${Math.round((q.U / q.spiele) * 100)} % U / ${Math.round((q.N / q.spiele) * 100)} % N (${q.spiele})`
            : wertbereich(v).replace(/^[^:]*: in den Top-10-Spielen /, "Top 10: ");
        })(),
    });
    const kf = kurzfassung.find((k) => k.titel === "Kaderwert Startelf");
    if (kf) kf.punkte.push(`Über 90 Min. mit Wechseln: ${f(v)}`);
  }

  // Seine wahrscheinliche Aufstellung gegen dich: die häufigste Aufstellung seiner Ligaspiele, mit Marktwert je Platz
  const erwartet =
    brief?.stammElf && gegner
      ? (() => {
          const werte = new Map(ladeGegnerKader(db, gegner.tid).map((k) => [k.pid, k.wert ?? undefined]));
          const elf = brief.stammElf!.elf;
          const summe = elf.reduce((n, p) => n + (werte.get(p.pid) ?? 0), 0);
          return {
            feld: elf.map((p) => ({ x: p.x, y: p.y, label: p.name.split(" ").at(-1)!, wert: werte.get(p.pid), torwart: p.torwart })),
            seiten: seitenVergleich(elf.map((p) => ({ name: p.name.split(" ").at(-1)!, x: p.x, y: p.y, wert: werte.get(p.pid), torwart: p.torwart }))),
            formation: formation(elf.filter((p) => !p.torwart)).text,
            positionen: brief.stammElf!.positionen,
            von: brief.stammElf!.von,
            summe,
            ohneWert: elf.filter((p) => werte.get(p.pid) === undefined).map((p) => p.name),
          };
        })()
      : null;

  if (erwartet?.seiten.kurz) kurzfassung.splice(2, 0, { titel: "Angriffsseite", punkte: erwartet.seiten.kurz });

  // Deine Aufstellung mit Marktwerten für Heatmap und Duelle: Archiv-Reiter des Vorschlags, sonst die Startelf
  // deines letzten Ligaspiels (tatsächliche Plätze aus der Stats-XML)
  const kaderAlle = ladeKader(db);
  const mwEigen = new Map(kaderAlle.map((k) => [k.pid, k.marktwert]));
  const nameEigen = new Map(kaderAlle.map((k) => [k.pid, k.name.split(" ").at(-1)!]));
  const archivReiter = vorschlag ? archiv.find((a) => a.reiter === vorschlag.taktik)?.taktik : undefined;
  const letzteElf = startelfAusLetztemSpiel(db);
  const eigeneAufstellung = archivReiter
    ? { quelle: `Reiter ${vorschlag!.taktik} aus deinem Archiv`, feld: archivReiter.pos.map((p) => ({ x: p.start.x, y: p.start.y, label: nameEigen.get(p.pid) ?? "?", wert: mwEigen.get(p.pid), torwart: p.pos === "goalie" })) }
    : letzteElf
      ? { quelle: `Startelf und Plätze aus deinem letzten Ligaspiel (Reiter ${vorschlag?.taktik ?? ""} nicht im Archiv)`, feld: letzteElf.elf.map((p) => ({ x: p.x, y: p.y, label: nameEigen.get(p.pid) ?? "?", wert: mwEigen.get(p.pid), torwart: p.torwart })) }
      : null;
  const skala = skalaAus([...(eigeneAufstellung?.feld ?? []), ...(erwartet?.feld ?? [])].filter((p) => !p.torwart).map((p) => p.wert));
  const duellListe = eigeneAufstellung && erwartet ? { ...duelle(eigeneAufstellung.feld.map((p) => ({ ...p, name: p.label })), erwartet.feld.map((p) => ({ ...p, name: p.label }))), quelle: eigeneAufstellung.quelle } : null;
  if (duellListe?.kurz.length) kurzfassung.splice(3, 0, { titel: "Duelle", punkte: duellListe.kurz });

  return {
    eigeneAufstellung,
    skala,
    duelle: duellListe,
    erwartet,
    verlauf,
    elfWerte,
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
