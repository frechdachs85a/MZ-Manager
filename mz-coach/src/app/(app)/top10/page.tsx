import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Card, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { letzterAbruf } from "@/lib/db/abruf";
import { datumZeit } from "@/lib/format";
import { de } from "@/lib/mz/analyse/gegner";
import type { Bilanz, TeamMuster } from "@/lib/mz/analyse/muster";
import { topAuswertung } from "@/lib/top-auswertung";
import { TopAbrufKnopf } from "./abruf-knopf";

const bil = (b: Bilanz) => `${b.S} S · ${b.U} U · ${b.N} N`;
const stilDe = (s: string) => s.replace(/(\w+)\/(\w+)\/(\w+)/, (_, t, p, a) => `${de(t)}/${de(p)}/${de(a)}`);
const lageDe = { führt: "bei Führung", gleich: "bei Gleichstand", hinten: "bei Rückstand" } as const;

function Muster({ m, titel }: { m: TeamMuster | null; titel: string }) {
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
        <span className="text-label-2">Taktikwechsel: </span>
        {m.taktikwechsel.length
          ? m.taktikwechsel.map((t) => `${lageDe[t.lage]}: ${t.aenderung} (${t.anzahl}×, Min. ${t.minuten.join(", ")})`).join(" · ")
          : "keine ausgelöst"}
      </div>
      <div>
        <span className="text-label-2">Gegen: </span>
        {m.gegenKlasse.map((g) => `${g.klasse} ${bil(g.bilanz)} mit ${g.stile.map(([s]) => stilDe(s)).join(" / ")}`).join(" · ")}
      </div>
    </div>
  );
}

export default async function Top10() {
  await connection();
  const db = getDb();
  const { teams, matrix, spiele } = topAuswertung(db);
  const abruf = letzterAbruf(db, "top10");
  return (
    <>
      <PageHeader title="Top 10" subtitle={`Lernmaterial aus der Managerwertung · ${spiele} Spiele ausgewertet`} />
      <div className="seite">
        <Section
          title="Abruf"
          footer={`${abruf ? `Letzter Abruf ${datumZeit(abruf.gestartet)}: ${abruf.meldung ?? "läuft"} ` : ""}Täglich ab 4 Uhr automatisch: je Team die letzten 10 Liga- und 10 Weltligaspiele, gespeicherte Spiele nie doppelt. Teams: ${teams[0]?.quelle ?? ""}.`}
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
                  <tr className="border-b border-separator text-left text-[12px] text-label-2">
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

        <Section title="Teams" footer="Nur ausgelöste Regeln stehen in der Stats-XML: was ein Team eingestellt, aber nie ausgelöst hat, ist hier nicht sichtbar.">
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
                  <Muster m={t.liga.muster} titel={`Liga (${t.liga.mitXml} von ${t.liga.gewaehlt})`} />
                  <Muster m={t.weltliga.muster} titel={`Weltliga (${t.weltliga.mitXml} von ${t.weltliga.gewaehlt})`} />
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
