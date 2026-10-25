import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Spielfeld } from "@/components/spielfeld";
import { Badge, Card, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { spielDatum } from "@/lib/format";
import { de } from "@/lib/mz/analyse/gegner";
import { MIN_QUOTE, MIN_SPIELE, portfolioAnalyse, type StilEintrag } from "@/lib/portfolio";

const stilDe = (s: string) => s.replace(/(\S+)\/(\S+)$/, (_, t, p) => `${de(t)}/${de(p)}`);
const prozent = (q: number) => `${Math.round(q * 100)} %`;
const haerteDe = (h: [string, number][]) => h.map(([a, n]) => `${de(a)} ${n}×`).join(", ");

function Vorschlag({ klasse, s }: { klasse?: string; s: StilEintrag }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          {klasse && <div className="kapitaelchen">gegen {klasse}</div>}
          <div className="display mt-1 text-[20px] font-semibold">{stilDe(s.schluessel)}</div>
          <div className="mt-1 text-[13px] text-label-2">
            {s.spiele} Spiele · {s.S} S, {s.U} U, {s.N} N ({prozent(s.quote)} Punktquote) · {s.teams.join(", ")} · Härte {haerteDe(s.haerte)}
          </div>
        </div>
        {s.imArchiv.length ? <Badge tone="green">hast du: {s.imArchiv.join(", ")}</Badge> : <Badge tone="orange">fehlt</Badge>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
        <Spielfeld
          spieler={[
            ...s.beispiel.feld.map((p) => ({ x: p.x, y: p.y, label: `${p.x}/${p.y}` })),
            ...(s.beispiel.torwart ? [{ ...s.beispiel.torwart, label: "TW", torwart: true }] : []),
          ]}
        />
        <div className="text-[13px] leading-relaxed">
          <div>
            Beispiel: <Link href={`/spiele/${s.beispiel.mid}`} className="text-tint hover:underline">{s.beispiel.team} {s.beispiel.tore} gegen {s.beispiel.gegner}</Link> ({spielDatum(s.beispiel.datum)}).
            Koordinaten = Editor-Koordinaten der Startaufstellung, aus der Stats-XML umgerechnet (±1 Punkt).
          </div>
          <div className="mt-2">
            Regel-Kurzcheck: {s.beispiel.check.stuermer} Stürmer, vorderster y {s.beispiel.check.minY}, kleinster Abstand {s.beispiel.check.minAbstand}
            {s.beispiel.check.verstoesse.length ? <span className="text-red"> · verletzt: {s.beispiel.check.verstoesse.join(", ")}</span> : <span className="text-green"> · Regeln 1 und 2 eingehalten</span>}
          </div>
          <div className="mt-2 text-label-2">
            Zum Übernehmen im Editor nachbauen, als eigenen Reiter speichern und unter „Taktik“ ins Archiv legen. Dort prüft die Seite auch Wechselregeln, Bank und Rote-Karte-Regel.
          </div>
        </div>
      </div>
    </Card>
  );
}

export default async function Portfolio() {
  await connection();
  const p = portfolioAnalyse(getDb());
  return (
    <>
      <PageHeader title="Taktik-Portfolio" subtitle={`Was bei den Top 10 gegen welchen Gegnertyp gewinnt · ${p.spiele} Spiele · ${p.archiv.length} Reiter im Archiv`} />
      <div className="seite">
        {p.spiele === 0 ? (
          <Section title="Portfolio">
            <Unavailable title="Taktik-Portfolio" reason="Noch keine Spiele der Top 10 gespeichert. Der wöchentliche Abruf (Top 10) liefert sie, danach steht hier, welche Stile sich bewährt haben und welche dir fehlen." />
          </Section>
        ) : (
          <>
            <Section
              title="Fehlt in deinem Portfolio"
              footer={`Bewährt = mindestens ${MIN_SPIELE} Spiele und mindestens ${prozent(MIN_QUOTE)} Punktquote (Sieg 1, Remis 0,5) gegen diese Gegnerklasse. Stil = Formation, Taktik und Spielweise zu Spielbeginn. Abgleich mit deinem Taktik-Archiv.`}
            >
              {p.fehlend.length ? (
                <div className="space-y-5">
                  {p.fehlend.map((s) => (
                    <Vorschlag key={`${s.klasse}|${s.schluessel}`} klasse={s.klasse} s={s} />
                  ))}
                </div>
              ) : (
                <Card className="p-5 text-[14px] text-label-2">Jeder bewährte Stil der Top 10 ist in deinem Archiv vertreten, oder es gibt noch keinen bewährten Stil.</Card>
              )}
            </Section>

            {p.klassen.map((k) => (
              <Section key={k.klasse} title={`Gegen ${k.klasse}`} footer={`${k.spiele} Spiele der Top 10 gegen diese Gegnerklasse.`}>
                <Card>
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="border-b border-separator text-left text-[12px] text-label-2">
                        <th className="py-2.5 pl-5 font-medium">Stil</th>
                        <th className="py-2.5 text-right font-medium">Spiele</th>
                        <th className="py-2.5 text-right font-medium">S / U / N</th>
                        <th className="py-2.5 text-right font-medium">Quote</th>
                        <th className="py-2.5 pl-4 font-medium">Teams</th>
                        <th className="py-2.5 pr-5 font-medium">Dein Archiv</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-separator">
                      {k.stile.map((s) => (
                        <tr key={s.schluessel} className="zeile-hover">
                          <td className="py-2.5 pl-5">
                            {stilDe(s.schluessel)} {s.bewaehrt && <Badge tone="tint">bewährt</Badge>}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{s.spiele}</td>
                          <td className="py-2.5 text-right tabular-nums">{s.S} / {s.U} / {s.N}</td>
                          <td className="py-2.5 text-right tabular-nums">{prozent(s.quote)}</td>
                          <td className="py-2.5 pl-4 text-label-2">{s.teams.join(", ")}</td>
                          <td className="py-2.5 pr-5">{s.imArchiv.length ? s.imArchiv.join(", ") : <span className="text-label-3">fehlt</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </Section>
            ))}

            {p.ungenutzt.length > 0 && (
              <Section title="Deine Reiter ohne Beleg bei den Top 10" footer="Diese Stile kommen in den gespeicherten Spielen der Top 10 nicht vor. Das heißt nicht, dass sie schlecht sind, nur dass es keinen Vergleich gibt.">
                <p className="text-[14px]">{p.ungenutzt.map((u) => `${u.reiter} (${stilDe(u.schluessel)})`).join(" · ")}</p>
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}
