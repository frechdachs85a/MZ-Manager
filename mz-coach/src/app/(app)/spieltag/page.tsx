import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { RegelSaetze } from "@/components/regel-saetze";
import { SpielberichtTeile } from "@/components/spielbericht";
import { Badge, Card, Hero, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { datumZeit } from "@/lib/format";
import { NACH_SPIEL_H } from "@/lib/spieltag-zeit";
import { spieltagLage } from "@/lib/spieltag";
import { TEAM } from "@/lib/wissen/startbasis";
import { SpieltagKnopf } from "./abruf-knopf";

const anstossText = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const th = "px-3 py-2 font-semibold first:pl-4 last:pr-4";
const td = "px-3 py-1.5 tabular-nums first:pl-4 last:pr-4";

export default async function Spieltag() {
  await connection();
  const l = spieltagLage(getDb());
  const { lauf, gegner, gegen, empfehlung } = l;

  return (
    <>
      <PageHeader title="Spieltag" subtitle={`Automatisch ${NACH_SPIEL_H} Stunden nach jedem Ligaspiel: Spielbericht, nächster Gegner, Taktikvorschlag`} />
      <div className="seite">
        <Hero className="mt-6">
          {lauf?.naechstesMid && lauf.anstoss ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="kapitaelchen !text-tint-hell">Nächstes Ligaspiel · {anstossText(lauf.anstoss)}</div>
                <div className="display mt-2 text-[15px] font-semibold uppercase text-label-2">{lauf.heim ? "Heimspiel gegen" : "Auswärts bei"}</div>
                <div className="display text-[34px] font-bold uppercase leading-none">{lauf.gegnerName ?? `tid ${lauf.gegnerTid}`}</div>
              </div>
              <div className="text-right">
                <div className="kapitaelchen">Taktikvorschlag</div>
                <div className="display mt-1 text-[44px] font-bold uppercase leading-none text-tint-hell">{empfehlung?.taktik ?? "n. v."}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="kapitaelchen !text-tint-hell">Nächstes Ligaspiel</div>
              <div className="display mt-2 text-[28px] font-bold uppercase leading-none">Noch kein Spielplan abgerufen</div>
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-label-3">
            {lauf && <span>Stand {datumZeit(lauf.gestartet)}</span>}
            {l.faelligAb && <span>Nächste Auswertung ab {anstossText(l.faelligAb.toISOString())}</span>}
          </div>
        </Hero>

        {l.letzterVersuch && l.letzterVersuch.ok === false && (
          <Card className="mt-4 border-l-4 border-orange p-4 text-[13.5px] text-label-2">
            <span className="font-semibold text-label">Letzter Versuch {datumZeit(l.letzterVersuch.gestartet)} nicht vollständig: </span>
            {l.letzterVersuch.meldung}
          </Card>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SpieltagKnopf />
          <span className="text-[12.5px] text-label-3">Holt Spielplan, Spiellisten und fehlende Stats-XML (mit Login, nacheinander mit Pausen).</span>
        </div>

        {gegner && empfehlung && (
          <Section
            title={`Taktikvorschlag gegen ${gegner.name}`}
            aktion={<Link href={`/gegner/${gegner.tid}`} className="text-[12.5px] font-semibold uppercase tracking-wider text-tint hover:text-tint-hell">Gegneranalyse →</Link>}
            footer="Der Vorschlag folgt den Faustregeln (mz-wissen.md, Abschnitt 10). Die Belege darunter zeigen, ob die Spiele ihn stützen; mit wenigen Spielen sind sie Hinweise, keine Beweise."
          >
            <Card className="p-4">
              <p className="text-[14.5px] leading-relaxed">{gegner.analyse?.urteilText}</p>
              <ul className="mt-3 space-y-2.5">
                {l.belege.map((b, i) => (
                  <li key={i} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                    <span className="w-40 shrink-0">
                      <Badge tone={b.stuetzt === true ? "green" : b.stuetzt === false ? "orange" : "neutral"}>{b.quelle}</Badge>
                    </span>
                    <span className="text-[14px] leading-relaxed">
                      {b.text}
                      {b.stuetzt === true && <span className="text-green"> Stützt den Vorschlag.</span>}
                      {b.stuetzt === false && <span className="text-orange"> Spricht eher dagegen.</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {empfehlung.vorbehalte.length > 0 && (
                <div className="mt-3 border-t border-separator pt-3 text-[13.5px] text-label-2">
                  <span className="font-semibold text-label">Vorbehalte: </span>
                  {empfehlung.vorbehalte.join(" ")}
                </div>
              )}
              <div className="mt-3 border-t border-separator pt-3 text-[13.5px]">
                <RegelSaetze regeln={gegner.regeln} />
              </div>
            </Card>
          </Section>
        )}
        {lauf?.gegnerTid && !gegner?.analyse && (
          <Section title="Taktikvorschlag">
            <Unavailable title={lauf.gegnerName ?? "Gegner"} reason="Noch keine Ligaspiele des Gegners mit Stats-XML gespeichert. Der nächste Abruf holt sie." />
          </Section>
        )}

        {gegen && gegen.spiele.length > 0 && (
          <Section title={`Was gegen ${gegner?.name} funktioniert hat`} footer="Seine Gegner in den ausgewerteten Ligaspielen, Aufstellung und Einstellung aus derselben Stats-XML. Ergebnis aus Sicht seines Gegners.">
            <Card className="p-4">
              <ul className="space-y-1 text-[14px] leading-relaxed">
                {gegen.saetze.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Card>
            <Card className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[620px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                    <th className={th}>Datum</th>
                    <th className={th}>Sein Gegner</th>
                    <th className={th}>Aufstellung und Einstellung</th>
                    <th className={th}>Typ</th>
                    <th className={`${th} text-right`}>Ergebnis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {gegen.spiele.map((s) => (
                    <tr key={s.mid}>
                      <td className={td}>{s.datum?.slice(0, 10).split("-").reverse().join(".")}</td>
                      <td className={`${td} font-medium`}>{s.tid === TEAM.tid ? `${s.name} (du)` : s.name}</td>
                      <td className={td}>{s.stil}</td>
                      <td className={td}>{s.klasse}</td>
                      <td className={`${td} text-right font-semibold ${s.ergebnis === "S" ? "text-green" : s.ergebnis === "N" ? "text-red" : ""}`}>
                        {s.ergebnis} {s.tore.fuer}:{s.tore.gegen}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
        )}

        {l.bericht ? (
          <>
            <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="display text-[24px] font-bold uppercase">
                Letztes Ligaspiel: {l.bericht.eigen.name} {l.bericht.endstand.eigen}:{l.bericht.endstand.gegner} {l.bericht.gegner.name}
              </h2>
              <Link href={`/spiele/${l.bericht.mid}`} className="text-[12.5px] font-semibold uppercase tracking-wider text-tint hover:text-tint-hell">
                Aufstellung und Spielverlauf →
              </Link>
            </div>
            <SpielberichtTeile b={l.bericht} />
          </>
        ) : (
          <Section title="Letztes Ligaspiel">
            <Unavailable title="Spielbericht" reason={lauf?.letztesMid ? `Stats-XML von Spiel ${lauf.letztesMid} noch nicht gespeichert.` : "Noch kein Spieltag-Abruf gelaufen."} />
          </Section>
        )}
      </div>
    </>
  );
}
