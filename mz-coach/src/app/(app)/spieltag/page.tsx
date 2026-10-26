import Link from "next/link";
import { connection } from "next/server";
import { Matchplan } from "@/components/matchplan";
import { PageHeader } from "@/components/page-header";
import { RegelSaetze } from "@/components/regel-saetze";
import { Spielfeld } from "@/components/spielfeld";
import { Badge, Card, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { datumZeit, euro } from "@/lib/format";
import { NACH_SPIEL_H } from "@/lib/spieltag-zeit";
import { spieltagLage } from "@/lib/spieltag";
import { TEAM } from "@/lib/wissen/startbasis";
import { SpieltagKnopf } from "./abruf-knopf";
import { SpieltagReiter } from "./reiter";

const anstossText = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const datum = (d?: string) => d?.slice(0, 10).split("-").reverse().join(".");

const th = "px-3 py-2 font-semibold first:pl-4 last:pr-4";
const td = "px-3 py-1.5 tabular-nums first:pl-4 last:pr-4";
const FARBE = { S: "text-green", U: "text-label-2", N: "text-red" } as const;

export default async function Spieltag() {
  await connection();
  const l = spieltagLage(getDb());
  const { lauf, gegner, gegen, empfehlung, gegnerAufstellung: ga, kaderwert: kw, steckbrief: sb, kurzfassung, scout, verlauf, erwartet } = l;
  const gName = gegner?.name ?? lauf?.gegnerName ?? "Gegner";

  return (
    <>
      <PageHeader title="Spieltag" subtitle={`Automatisch ${NACH_SPIEL_H} Stunden nach jedem Ligaspiel: nächster Gegner mit Taktikvorschlag, dazu der Bericht deines letzten Ligaspiels`} />
      <div className="seite">
        <SpieltagReiter aktiv="gegner" />

        <div className="mt-5">
          <Matchplan l={l} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-label-3">
          {lauf && <span>Stand {datumZeit(lauf.gestartet)}</span>}
          {l.faelligAb && <span>Nächste automatische Auswertung ab {anstossText(l.faelligAb.toISOString())}</span>}
          <span className="ml-auto">
            <SpieltagKnopf />
          </span>
        </div>
        {l.letzterVersuch && l.letzterVersuch.ok === false && (
          <Card className="mt-4 border-l-4 border-orange p-4 text-[13.5px] text-label-2">
            <span className="font-semibold text-label">Letzter Versuch {datumZeit(l.letzterVersuch.gestartet)} nicht vollständig: </span>
            {l.letzterVersuch.meldung}
          </Card>
        )}

        {kurzfassung.length > 0 && (
          <Section title={`Das Wichtigste über ${gName}`} footer="Aus den Stats-XML seiner ausgewerteten Ligaspiele und seiner Kaderseite.">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
            <Card>
              <dl className="divide-y divide-separator">
                {kurzfassung.map((k) => (
                  <div key={k.titel} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
                    <dt className="text-[13px] font-bold uppercase tracking-wider text-label-2">{k.titel}</dt>
                    <dd className="text-[14.5px] leading-relaxed">{k.text}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            {erwartet && (
              <Card className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[14px] font-bold">Wahrscheinliche Aufstellung gegen dich</span>
                  <span className="display text-[22px] font-bold">{erwartet.formation}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-label-2">
                  So in {erwartet.positionen} von {erwartet.von} Ligaspielen ·{" "}
                  {erwartet.ohneWert.length === erwartet.feld.length
                    ? "Marktwerte n. v. (Kaderseite des Gegners noch nicht gelesen)"
                    : `Startelf-Wert ${euro(erwartet.summe)}${erwartet.ohneWert.length ? ` (ohne Wert: ${erwartet.ohneWert.join(", ")})` : ""}`}
                </div>
                <div className="mx-auto mt-3 max-w-[360px]">
                  <Spielfeld spieler={erwartet.feld} titel={`Aufstellung ${gName}`} heatmap={erwartet.ohneWert.length < erwartet.feld.length} />
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-label-3">
                  Aus seiner Sicht (sein Tor unten). Farbe = Marktwert im Vergleich zu seiner übrigen Elf (Kaderseite), genauer Wert beim Antippen. Seine linke Seite liegt deiner rechten gegenüber (x = 208 − x).
                </p>
                {erwartet.seiten.text && (
                  <div className="mt-3 rounded-[8px] bg-tint/[0.08] p-3 text-[13.5px] leading-relaxed">
                    <span className="font-bold">Angriffsseite: </span>
                    {erwartet.seiten.text}
                  </div>
                )}
              </Card>
            )}
            </div>
          </Section>
        )}

        {verlauf && (
          <Section
            title="Kaderwert über die Spielzeit"
            footer={`Summe der Marktwerte auf dem Feld je Zeitfenster zwischen den Wechseln, Verhältnis = deine ÷ seine; gewichtet nach Minuten (mz-wissen.md, Abschnitt 14). Du: ${verlauf.quelleEigen}. Er: ${verlauf.quelleGegner}.${verlauf.fehlend.length ? ` Ohne Marktwert (zählen mit 0): ${verlauf.fehlend.join(", ")}.` : ""}`}
          >
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                    <th className={th}>Minuten</th>
                    <th className={th}>Wechsel davor</th>
                    <th className={`${th} text-right`}>{TEAM.name}</th>
                    <th className={`${th} text-right`}>{gName}</th>
                    <th className={`${th} text-right`}>Verhältnis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {verlauf.fenster.map((f) => (
                    <tr key={f.von}>
                      <td className={td}>{f.von === 0 ? "Anpfiff" : `${f.von}.`} bis {f.bis}.</td>
                      <td className={`${td} text-label-2`}>{f.aenderung.join(", ") || "–"}</td>
                      <td className={`${td} text-right`}>{euro(f.eigen)}</td>
                      <td className={`${td} text-right`}>{euro(f.gegner)}</td>
                      <td className={`${td} text-right font-bold ${f.verhaeltnis >= 1 ? "text-green" : "text-red"}`}>
                        {f.verhaeltnis.toFixed(2).replace(".", ",")} ({f.verhaeltnis >= 1 ? "+" : ""}{Math.round((f.verhaeltnis - 1) * 100)} %)
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-card-2 font-semibold">
                    <td className={td} colSpan={2}>Nach Minuten gewichtet</td>
                    <td className={`${td} text-right`}>{euro(verlauf.gewichtet.eigen)}</td>
                    <td className={`${td} text-right`}>{euro(verlauf.gewichtet.gegner)}</td>
                    <td className={`${td} text-right ${verlauf.gewichtet.verhaeltnis >= 1 ? "text-green" : "text-red"}`}>
                      {verlauf.gewichtet.verhaeltnis.toFixed(2).replace(".", ",")} ({verlauf.gewichtet.verhaeltnis >= 1 ? "+" : ""}
                      {Math.round((verlauf.gewichtet.verhaeltnis - 1) * 100)} %)
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </Section>
        )}

        {scout && (
          <Section title={`Deine Scoutspiele gegen ${scout.gegner}`} footer={`${scout.quelle}. ${scout.vorbehalte.join(" ")}`}>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                    <th className={th}>Taktik</th>
                    <th className={`${th} text-right`}>Spiele</th>
                    <th className={`${th} text-right`}>S / U / N</th>
                    <th className={`${th} text-right`}>Punkte je Spiel</th>
                    <th className={`${th} text-right`}>Tore</th>
                    <th className={`${th} text-right`}>Ecken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {scout.taktiken.map((t) => (
                    <tr key={t.reiter} className={t.reiter === l.vorschlag?.taktik ? "bg-tint/[0.08] font-semibold" : ""}>
                      <td className={td}>
                        {t.reiter} <span className="font-normal text-label-2">({t.einstellung})</span>
                      </td>
                      <td className={`${td} text-right`}>{t.spiele}</td>
                      <td className={`${td} text-right`}>{t.S} / {t.U} / {t.N}</td>
                      <td className={`${td} text-right`}>{((3 * t.S + t.U) / t.spiele).toFixed(2).replace(".", ",")}</td>
                      <td className={`${td} text-right`}>{t.tore}:{t.gegentore}</td>
                      <td className={`${td} text-right`}>{t.ecken ? `${t.ecken[0]}:${t.ecken[1]}` : "n. v."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="mt-3 p-4">
              <ul className="space-y-1.5 text-[14px] leading-relaxed">
                {scout.befunde.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-tint" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Section>
        )}

        <details className="group mt-8">
          <summary className="flex min-h-[48px] cursor-pointer items-center rounded-[8px] bg-card px-4 text-[14px] font-bold uppercase tracking-wider text-tint karte">
            Alle Details zum Gegner: Aufstellung, Kaderwert, Steckbrief, Belege, Spiele
          </summary>
        {(ga || kw) && (
          <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
            {ga && (
              <Section title={`So stellt ${gName} auf`} footer={`Startaufstellung im neuesten ausgewerteten Ligaspiel (${datum(ga.datum)} gegen ${ga.gegen}), aus der Stats-XML in Editor-Koordinaten umgerechnet.`}>
                <Card className="p-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="display text-[26px] font-bold">{ga.formation ?? "?"}</span>
                    <span className="text-[13.5px] font-semibold text-label-2">{ga.einstellung}</span>
                  </div>
                  <div className="mx-auto max-w-[360px]">
                    <Spielfeld spieler={ga.feld} titel={`Aufstellung ${gName}`} />
                  </div>
                </Card>
              </Section>
            )}
            <Section title="Kaderwert der Startelf" footer="Marktwert aus deiner Kaderseite und der Kaderseite des Gegners; Startelf jeweils aus dem neuesten gespeicherten Spiel (mz-wissen.md, Abschnitt 10: immer Kaderwert vergleichen).">
              {kw?.eigen && kw.gegner ? (
                <Card className="p-4">
                  {[
                    { name: TEAM.name, w: kw.eigen, eigen: true },
                    { name: gName, w: kw.gegner, eigen: false },
                  ].map(({ name, w, eigen }) => {
                    const max = Math.max(kw.eigen!.summe, kw.gegner!.summe);
                    return (
                      <div key={name} className="py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold">{name}</span>
                          <span className="display text-[22px] font-bold tabular-nums">{euro(w.summe)}</span>
                        </div>
                        <div className="mt-1.5 h-2.5 rounded-full bg-fill">
                          <div className={`h-2.5 rounded-full ${eigen ? "bg-tint" : "bg-label-3"}`} style={{ width: `${(w.summe / max) * 100}%` }} />
                        </div>
                        <div className="mt-1 text-[12.5px] text-label-2">
                          {w.mitWert} von {w.spieler} Spielern mit Marktwert
                          {w.alterSchnitt !== undefined && ` · Altersschnitt ${w.alterSchnitt.toFixed(1).replace(".", ",")}`}
                          {w.fehlt.length > 0 && ` · ohne Wert: ${w.fehlt.join(", ")}`}
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-2 border-t border-separator pt-3 text-[14px] font-semibold">
                    {kw.gegner.summe > kw.eigen.summe
                      ? `${gName} ist laut Marktwert stärker (+${Math.round((kw.gegner.summe / kw.eigen.summe - 1) * 100)} %).`
                      : `Du bist laut Marktwert stärker (+${Math.round((kw.eigen.summe / kw.gegner.summe - 1) * 100)} %).`}
                  </div>
                </Card>
              ) : (
                <Unavailable title="Kaderwert" reason={!kw?.eigen ? "Kein eigenes Spiel mit Startelf gespeichert." : "Kaderseite des Gegners noch nicht gelesen; der nächste Spieltag-Abruf holt sie."} />
              )}
            </Section>
          </div>
        )}


        {sb && sb.spiele.length > 0 && (
          <Section title={`Steckbrief ${gName}`} footer="Alles aus den Stats-XML seiner ausgewerteten Ligaspiele. Gleiche Aufstellung = gleiche Plätze (±2 Punkte), egal wer dort stand.">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card className="p-4">
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                  <span className="display text-[26px] font-bold">
                    <span className="text-green">{sb.bilanz.S} S</span> · <span className="text-label-2">{sb.bilanz.U} U</span> · <span className="text-red">{sb.bilanz.N} N</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">Tore {sb.bilanz.tore}:{sb.bilanz.gegentore}</span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[460px] text-[13.5px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-label-3">
                        <th className="py-1 pr-3 font-semibold">Datum</th>
                        <th className="py-1 pr-3 font-semibold">Gegner</th>
                        <th className="py-1 pr-3 text-right font-semibold">Ergebnis</th>
                        <th className="py-1 pr-3 text-right font-semibold">Schüsse aufs Tor</th>
                        <th className="py-1 font-semibold">Gegentore (Min.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-separator">
                      {sb.spiele.map((x) => (
                        <tr key={x.mid}>
                          <td className="py-1 pr-3 tabular-nums">{datum(x.datum)}</td>
                          <td className="py-1 pr-3">{x.heim ? "vs" : "bei"} {x.gegner}</td>
                          <td className={`py-1 pr-3 text-right font-bold tabular-nums ${FARBE[x.ergebnis]}`}>{x.tore.eigen}:{x.tore.gegner}</td>
                          <td className="py-1 pr-3 text-right tabular-nums">{x.schuesseTor ?? "n. v."}</td>
                          <td className="py-1 tabular-nums text-label-2">{x.gegentorMinuten.length ? x.gegentorMinuten.map((m) => `${m}.`).join(", ") : "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 space-y-1 border-t border-separator pt-3 text-[13.5px] leading-relaxed">
                  <div>
                    <span className="font-semibold">Einstellung: </span>
                    {sb.einstellungen.map(([e, n]) => `${e} (${n}×)`).join(", ")}
                  </div>
                  <div>
                    <span className="font-semibold">Torschützen: </span>
                    {sb.torschuetzen.map(([n, z]) => `${n} ${z}`).join(", ") || "keine"}
                  </div>
                  <div>
                    <span className="font-semibold">Vorlagen: </span>
                    {sb.vorlagen.map(([n, z]) => `${n} ${z}`).join(", ") || "keine"}
                  </div>
                </div>
              </Card>
              {sb.stammElf && (
                <Card className="p-4">
                  <div className="text-[14px] font-semibold">
                    Gleiche Aufstellung in {sb.stammElf.positionen} von {sb.stammElf.von} Spielen{sb.stammElf.positionen !== sb.stammElf.spiele && `, mit denselben Spielern in ${sb.stammElf.spiele}`}
                    {sb.breite && <span className="font-normal text-label-2"> · äußerste Feldspieler bei x {sb.breite.min} und {sb.breite.max}</span>}
                  </div>
                  <ul className="mt-2 space-y-0.5 text-[13px] tabular-nums">
                    {sb.stammElf.elf.map((p) => (
                      <li key={p.name} className="flex justify-between gap-2">
                        <span className="min-w-0 break-words">{p.torwart ? `${p.name} (TW)` : p.name}</span>
                        <span className="shrink-0 text-label-2">{p.x}/{p.y}</span>
                      </li>
                    ))}
                  </ul>
                  {sb.stammElf.abweichungen.length > 0 && (
                    <div className="mt-3 border-t border-separator pt-2 text-[13px] text-label-2">
                      <span className="font-semibold text-label">Abweichungen: </span>
                      {sb.stammElf.abweichungen.map((a) => `${datum(a.datum)} ${a.text}`).join(" · ")}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </Section>
        )}

        {gegner && empfehlung && (
          <Section
            title="Alle Belege zum Taktikvorschlag"
            aktion={<Link href={`/gegner/${gegner.tid}`} className="text-[12.5px] font-semibold uppercase tracking-wider text-tint hover:text-tint-hell">Gegneranalyse →</Link>}
            footer="Der Vorschlag folgt den Faustregeln (mz-wissen.md, Abschnitt 10). Die Belege zeigen, ob die Spiele ihn stützen; mit wenigen Spielen sind sie Hinweise, keine Beweise."
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
            <Unavailable title={gName} reason="Noch keine Ligaspiele des Gegners mit Stats-XML gespeichert. Der nächste Abruf holt sie." />
          </Section>
        )}

        {gegen && gegen.spiele.length > 0 && (
          <Section title={`Ligaspiele von ${gName}`} footer={`Ergebnis aus Sicht von ${gName}: grün = er hat gewonnen, rot = verloren. Aufstellung und Einstellung seines Gegners aus derselben Stats-XML.`}>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                    <th className={th}>Datum</th>
                    <th className={th}>Gegner von {gName}</th>
                    <th className={th}>Dessen Aufstellung und Einstellung</th>
                    <th className={th}>Dessen Typ</th>
                    <th className={`${th} text-right`}>{gName}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {gegen.spiele.map((s) => (
                    <tr key={s.mid}>
                      <td className={td}>{datum(s.datum)}</td>
                      <td className={`${td} font-medium`}>{s.tid === TEAM.tid ? `${s.name} (du)` : s.name}</td>
                      <td className={td}>{s.stil}</td>
                      <td className={td}>{s.klasse}</td>
                      <td className={`${td} text-right font-bold ${FARBE[s.seinErgebnis]}`}>
                        {s.seinErgebnis === "S" ? "Sieg" : s.seinErgebnis === "N" ? "Niederlage" : "Remis"} {s.tore.gegen}:{s.tore.fuer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {gegen.spiele.some((x) => x.seinErgebnis !== "S") && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {gegen.spiele
                  .filter((x) => x.seinErgebnis !== "S")
                  .map((x) => (
                    <Card key={x.mid} className="p-3">
                      <div className="text-[13px] font-semibold">
                        {x.name}: {x.seinErgebnis === "N" ? "Sieg" : "Remis"} {x.tore.fuer}:{x.tore.gegen} gegen {gName}
                      </div>
                      <div className="mb-2 text-[12px] text-label-2">{x.stil} · {datum(x.datum)}</div>
                      <Spielfeld
                        spieler={[...x.feld.map((p) => ({ x: p.x, y: p.y, label: `${p.x}/${p.y}` })), ...(x.torwart ? [{ ...x.torwart, label: "TW", torwart: true }] : [])]}
                        titel={`Aufstellung ${x.name}`}
                      />
                    </Card>
                  ))}
              </div>
            )}
            <Card className="mt-3 p-4">
              <div className="kapitaelchen mb-2">Was gegen {gName} funktioniert hat</div>
              <ul className="space-y-1 text-[14px] leading-relaxed">
                {gegen.saetze.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Card>
          </Section>
        )}
        </details>
      </div>
    </>
  );
}
