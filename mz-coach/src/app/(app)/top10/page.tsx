// Top 10: Spielweise, Regelmuster und Ablauf der besten Teams, Wertbereich-Statistik.

import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Card, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { letzterAbruf } from "@/lib/db/abruf";
import { datumZeit } from "@/lib/format";
import { de } from "@/lib/mz/analyse/gegner";
import { stilText, type Bilanz, type RegelSatz, type SpielMuster, type TeamMuster } from "@/lib/mz/analyse/muster";
import { RegelSaetze } from "@/components/regel-saetze";
import { topAuswertung } from "@/lib/top-auswertung";
import { ladeTopArchiv } from "@/lib/archiv";
import { TopAbrufKnopf } from "./abruf-knopf";
import { WertQuoten } from "@/components/wert-quoten";
import { anzahlWertSpiele, quotenJeBereich } from "@/lib/db/wertspiel";

const bil = (b: Bilanz) => `${b.S} S · ${b.U} U · ${b.N} N`;
const stilDe = (s: string) => s.replace(/(\w+)\/(\w+)\/(\w+)/, (_, t, p, a) => `${de(t)}/${de(p)}/${de(a)}`);
const lageDe = { führt: "bei Führung", gleich: "bei Gleichstand", hinten: "bei Rückstand" } as const;

// Kompletter Ablauf je Spiel: Start, dann jede Änderung mit Minute und Spielstand
function Ablauf({ spiele }: { spiele: SpielMuster[] }) {
  if (!spiele.length) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer text-[13px] font-medium text-tint">Ablauf je Spiel ({spiele.length})</summary>
      <ol className="mt-3 space-y-3">
        {spiele.map((sp) => (
          <li key={sp.mid} className="rounded-[10px] border border-separator p-3 text-[13px]">
            <div className="flex justify-between gap-2 font-medium">
              <span>
                {sp.datum?.slice(0, 10).split("-").reverse().join(".")} gegen {sp.gegner.name}
              </span>
              <span className="tabular-nums">
                {sp.tore.eigen}:{sp.tore.gegner} {sp.ergebnis}
              </span>
            </div>
            <div className="mt-1 text-label-2">
              Start: {stilDe(stilText(sp.eigen))} · Gegner: {stilDe(stilText(sp.gegner))}
            </div>
            {sp.ablauf.length ? (
              <ul className="mt-1.5 space-y-0.5">
                {sp.ablauf.map((a, i) => (
                  <li key={i}>
                    <span className="inline-block w-20 tabular-nums text-label-3">
                      {a.minute}. · {a.stand}
                    </span>
                    {a.text}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1.5 text-label-3">Keine Wechsel, Taktikwechsel oder Karten.</div>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Muster({ m, titel, regeln }: { m: TeamMuster | null; titel: string; regeln: RegelSatz[] }) {
  if (!m) return <p className="text-[13px] text-label-3">{titel}: noch keine Spiele mit Stats-XML.</p>;
  const min = m.wechselMinuten;
  return (
    <div className="space-y-2.5 text-[14px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="kapitaelchen">{titel}</span>
        <span className="tabular-nums text-label-2">{m.spiele} Spiele · {bil(m.bilanz)}</span>
      </div>
      <div>
        <span className="text-label-2">Startet mit: </span>
        {m.startStile.map(([s, n]) => `${stilDe(s)} (${n}×)`).join(" · ")}
      </div>
      <div>
        <span className="text-label-2">Regelwechsel: </span>
        {min.length ? `${min.length} in ${m.spiele} Spielen, Minuten ${min.join(", ")}` : "keine ausgelöst"}
      </div>
      <div>
        <span className="text-label-2">Wer wird gewechselt: </span>
        {m.wechselNachRolle.length
          ? m.wechselNachRolle.map((w) => `${w.rolle} (${w.grund}, ${w.anzahl}×, Min. ${w.minuten.join(", ")})`).join(" · ")
          : "keine Wechsel"}
      </div>
      <div>
        <span className="text-label-2">Taktikwechsel: </span>
        {m.taktikwechsel.length
          ? m.taktikwechsel.map((t) => `${lageDe[t.lage]}: ${t.aenderung} (${t.anzahl}×, Min. ${t.minuten.join(", ")})`).join(" · ")
          : "keine ausgelöst"}
      </div>
      <RegelSaetze regeln={regeln} />
      <div>
        <span className="text-label-2">Gegen: </span>
        {m.gegenKlasse.map((g) => `${g.klasse} ${bil(g.bilanz)} mit ${g.stile.map(([s]) => stilDe(s)).join(" / ")}`).join(" · ")}
      </div>
    </div>
  );
}

// Seite Top 10
export default async function Top10() {
  await connection();
  const db = getDb();
  const { teams, matrix, spiele } = topAuswertung(db);
  const abruf = letzterAbruf(db, "top10");
  const listen = letzterAbruf(db, "top10-listen");
  const archiv = ladeTopArchiv(db);
  const wertscan = letzterAbruf(db, "wertscan");
  const wertSpiele = anzahlWertSpiele(db);
  return (
    <>
      <PageHeader title="Top 10" subtitle={`Lernmaterial aus der Managerwertung · ${spiele} Spiele ausgewertet`} />
      <div className="seite">
        <Section
          title="Siegchance nach Kaderwert"
          footer={`Verhältnis = Kaderwert des Teams ÷ Kaderwert des Gegners (Startelf bzw. nach Minuten gewichteter Feld-Wert mit Wechseln). Liga- und Weltligaspiele der Top 10 und der Weltliga-Teams. ${wertscan ? `Letzter Scan ${datumZeit(wertscan.gestartet)}: ${wertscan.meldung ?? "läuft"}` : "Noch kein Scan: läuft wöchentlich automatisch."}`}
        >
          {wertSpiele ? (
            <WertQuoten elf={quotenJeBereich(db, "elf")} feld={quotenJeBereich(db, "feld")} spiele={wertSpiele} />
          ) : (
            <Unavailable title="Wertbereiche" reason="Noch keine Spiele gescannt." />
          )}
        </Section>

        <Section
          title="Abruf"
          footer={`${abruf ? `Letzter Abruf ${datumZeit(abruf.gestartet)}: ${abruf.meldung ?? "läuft"} ` : ""}${listen ? `Spiellisten zuletzt ${datumZeit(listen.gestartet)}. ` : ""}Spiellisten der Top 10 einmal pro Woche (montags ab 4 Uhr), fehlende Spiele werden täglich nachgeholt: je Team die letzten 10 Liga- und 10 Weltligaspiele, jedes Spiel nur einmal gespeichert. Die Auswertung wird wöchentlich archiviert. Teams: ${teams[0]?.quelle ?? ""}.`}
        >
          <TopAbrufKnopf />
        </Section>

        <Section
          title="Was gewinnt gegen welchen Gegner?"
          footer="Alle ausgewerteten Spiele der Topteams. Gegnerklasse nach den Faustregeln (Fünferkette, enge Mitte = niemand oberhalb der Abwehr außen, sonst mit Außenspielern). Stil = Formation, Taktik, Spielweise, Härte zu Spielbeginn."
        >
          {matrix.length === 0 ? (
            <Unavailable title="Stil gegen Gegnerklasse" reason="Noch keine Spiele der Topteams gespeichert. Erster Abruf läuft mit Login (Knopf oben oder morgens automatisch)." />
          ) : (
            <Card>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                    <th className="py-2.5 pl-5 font-medium">Gegner</th>
                    <th className="py-2.5 font-medium">Stil der Topteams</th>
                    <th className="py-2.5 text-right font-medium">Spiele</th>
                    <th className="py-2.5 pr-5 text-right font-medium">Bilanz</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {matrix.map((z, i) => (
                    <tr key={i} className="zeile-hover">
                      <td className="py-2.5 pl-5">{z.klasse}</td>
                      <td className="py-2.5">{stilDe(z.stil)}</td>
                      <td className="py-2.5 text-right tabular-nums">{z.spiele}</td>
                      <td className="py-2.5 pr-5 text-right tabular-nums">{bil(z.bilanz)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </Section>

        {archiv.length > 0 && (
          <Section title="Archiv" footer="Wöchentlicher Stand der Auswertung, gespeichert in der Datenbank (und in der wöchentlichen Sicherung).">
            <p className="text-[14px] text-label-2">
              {archiv.map((a) => `${a.datum.split("-").reverse().join(".")} (${a.spiele} Spiele)`).join(" · ")}
            </p>
          </Section>
        )}

        <Section title="Teams" footer="Aus der Stats-XML: Startaufstellung und -einstellungen, jeder Wechsel (wer für wen, Rolle des Ausgewechselten aus seiner Startposition, Regelminute), jeder Taktikwechsel und jede Karte mit Minute und Spielstand. Nur ausgelöste Regeln stehen in der XML. Wohin ein Eingewechselter oder eine Alternative-Aufstellung rückt, steht nicht darin.">
          <div className="grid gap-5 lg:grid-cols-2">
            {teams.map((t) => (
              <Card key={t.tid} className="p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="display text-[20px] font-semibold">
                    <span className="mr-2 text-gold">{t.rang}.</span>
                    {t.name}
                  </h3>
                  <span className="text-[12px] text-label-3">tid {t.tid}</span>
                </div>
                <div className="mt-4 space-y-5">
                  <Muster m={t.liga.muster} regeln={t.liga.regeln} titel={`Liga (${t.liga.mitXml} von ${t.liga.gewaehlt})`} />
                  <Ablauf spiele={t.liga.spiele} />
                  <Muster m={t.weltliga.muster} regeln={t.weltliga.regeln} titel={`Weltliga (${t.weltliga.mitXml} von ${t.weltliga.gewaehlt})`} />
                  <Ablauf spiele={t.weltliga.spiele} />
                </div>
                {t.arten.length > 0 && (
                  <p className="mt-4 border-t border-separator pt-3 text-[12px] text-label-3">
                    Spielarten in der Liste: {t.arten.map(([a, n]) => `${a} ${n}`).join(" · ")}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
