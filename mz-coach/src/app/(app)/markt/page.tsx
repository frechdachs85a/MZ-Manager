// Transfermarkt: Empfehlung je Schwachstelle mit Spielerprofil und Bietomat, Kandidaten, Schwachstellen, Rahmen.

import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { letzterAbruf } from "@/lib/db/abruf";
import { datumZeit, euro, spielDatum } from "@/lib/format";
import { GRUND_TEXT, HEIMATLAND, type Grund, type Schwachstelle } from "@/lib/mz/analyse/markt";
import { vonWatchlist, zuruecknehmen } from "./actions";
import { VorschlagKarte } from "@/components/vorschlag-karte";
import { ladeWatchlist } from "@/lib/db/watch";
import { RahmenForm, SuchKnopf } from "./formulare";
import { InBietomat } from "./bietomat/formulare";
import { MarktInfo } from "@/components/markt-info";
import { ladeAuftraege } from "@/lib/db/gebot";
import { marktErgebnis } from "@/lib/markt-ergebnis";
import { ladeVerkaeufe } from "@/lib/db/verkauf";

const MZ = "https://www.managerzone.com";
const komma = (n: number, s = 2) => n.toFixed(s).replace(".", ",");

// Seite Transfermarkt
export default async function Markt() {
  await connection();
  const db = getDb();
  const { kader, start, suche, rahmen, abgelehnt, schwach, r, ergebnis } = marktErgebnis(db);
  const abruf = letzterAbruf(db, "markt");
  const imBietomat = new Map(
    ladeAuftraege(db)
      .filter((a) => a.status === "aktiv")
      .map((a) => [a.pid, a.maximum]),
  );
  const verkaeufe = ladeVerkaeufe(db);
  const auftraege = ladeAuftraege(db).filter((a) => a.status === "aktiv");
  const watch = ladeWatchlist(db);
  const aufWatch = new Set(watch.map((w) => w.pid));
  // Vorschläge: alle, die verbessern, ohne die schon auf der Watchlist; höchstens 8
  const vorschlaege = (ergebnis?.alle ?? []).filter((b) => !aufWatch.has(b.kandidat.pid)).slice(0, 8);
  const auslaender = kader.filter((s) => s.nationalitaet && s.nationalitaet !== HEIMATLAND);

  return (
    <>
      <PageHeader
        title="Transfermarkt"
        subtitle={suche ? `Suche vom ${datumZeit(suche.zeit)} · ${suche.spieler.length} Spieler geprüft` : "Transfermarkt-Scout"}
      />
      <div className="seite">
        <Section
          title="Vorschläge"
          footer="Spieler aus der letzten Marktsuche, die einen Platz deiner Startelf verbessern, größter Gewinn zuerst. Annehmen setzt ihn auf die Watchlist, Ablehnen blendet ihn aus."
        >
          {!schwach ? (
            <Unavailable title="Vorschläge" reason="Kein eigenes Spiel mit Stats-XML gespeichert, daher keine Startelf." />
          ) : !suche ? (
            <Unavailable title="Vorschläge" reason="Noch keine Marktsuche. Sie läuft täglich ab 6 Uhr automatisch, oder unten jetzt suchen." />
          ) : vorschlaege.length ? (
            <>
              {!r && (
                <p className="mb-3 rounded-md bg-orange/10 px-3 py-2 text-[13px] text-orange">
                  Rahmen noch nicht eingetragen (rechts): Budget, Ausländerplätze und Arbeitsbewilligungen sind bei diesen Vorschlägen nicht geprüft.
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {vorschlaege.map((b, i) => (
                  <VorschlagKarte key={b.kandidat.pid} b={b} rang={i + 1} verkauf={verkaeufe.get(b.kandidat.pid)} imBietomat={imBietomat.get(b.kandidat.pid)} />
                ))}
              </div>
              <p className="mt-2 text-[12px] text-label-3">Stand der Marktsuche vom {datumZeit(suche.zeit)}.</p>
            </>
          ) : (
            <Card className="p-4">
              <div className="text-[17px] font-semibold">Heute kein passender Spieler auf dem Markt</div>
              <p className="mt-1 text-[15px] text-label-2">
                Von {ergebnis?.geprueft ?? 0} geprüften Spielern verbessert keiner deine Startelf innerhalb deiner Grenzen. Gründe siehe unten.
              </p>
            </Card>
          )}
        </Section>
      </div>
      <div className="seite lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-x-8">
        <div>
          <Section title="Watchlist" footer="Angenommene Vorschläge. Mit einem Endpreis kommt der Spieler in den Bietomat; entfernen geht jederzeit.">
            {watch.length ? (
              <div className="grid gap-3">
                {watch.map((w) => (
                  <Card key={w.pid} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a href={`${MZ}/?p=players&pid=${w.pid}`} target="_blank" rel="noreferrer" className="text-[17px] font-bold hover:underline">
                          {w.name}
                        </a>
                        {w.bewertung && (
                          <div className="text-[12.5px] text-label-2">
                            als {w.bewertung.rolle} statt {w.bewertung.statt}: +{komma(w.bewertung.gewinn)} MZ-Wert (beim Annehmen)
                          </div>
                        )}
                      </div>
                      <form action={vonWatchlist}>
                        <input type="hidden" name="pid" value={w.pid} />
                        <button className="pressable rounded-md border border-separator px-2.5 py-1 text-[12.5px] font-semibold text-red">Entfernen</button>
                      </form>
                    </div>
                    <div className="mt-2">
                      <MarktInfo s={w.spieler} verkauf={verkaeufe.get(w.pid)} stand={`Stand beim Annehmen (${datumZeit(w.aufgenommen)})`} />
                    </div>
                    <div className="mt-3">
                      <InBietomat pid={w.pid} imBietomat={imBietomat.get(w.pid)} />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-4 text-[14px] text-label-2">Noch leer. Vorschläge mit „Annehmen“ hierher holen.</Card>
            )}
          </Section>

          <Section title="Im Bietomat" footer="Deine aktiven Aufträge. Ändern oder löschen im Bietomat.">
            {auftraege.length ? (
              <List>
                {auftraege.map((a) => (
                  <Row
                    key={a.pid}
                    title={a.name ?? String(a.pid)}
                    detail={`Endpreis ${euro(a.maximum)}${a.auktionEnde ? ` · Ende ${datumZeit(a.auktionEnde)}` : ""}`}
                    value={<Badge tone="green">aktiv</Badge>}
                  />
                ))}
              </List>
            ) : (
              <Card className="p-4 text-[14px] text-label-2">Kein aktiver Auftrag.</Card>
            )}
          </Section>

          {ergebnis && (
            <Section title="Nicht vorgeschlagen" footer={`Von ${ergebnis.geprueft} Spielern der letzten Suche.`}>
              <List>
                {(Object.entries(ergebnis.ausgeschlossen) as [Grund, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([g, n]) => (
                    <Row key={g} title={GRUND_TEXT[g]} value={<span className="tabular-nums">{n}</span>} />
                  ))}
                {Object.keys(ergebnis.ausgeschlossen).length === 0 && <Row title="Keiner ausgeschlossen" />}
              </List>
            </Section>
          )}

          <Section title="Bietomat">
            <Link href="/markt/bietomat" className="pressable flex min-h-[46px] w-full items-center justify-center knopf text-[16px] font-bold">
              Spieler per Nummer laden und Gebot planen
            </Link>
          </Section>

          <Section
            title="Suche"
            footer={
              abruf
                ? `Letzter Abruf ${datumZeit(abruf.gestartet)}: ${abruf.meldung ?? "läuft"}`
                : "Läuft täglich ab 6 Uhr (Berlin), wenn der ManagerZone-Zugang eingerichtet ist."
            }
          >
            <SuchKnopf />
          </Section>
        </div>

        <div>
          <Section
            title="Deine Schwachstellen"
            footer={
              start
                ? `Startelf aus ${start.spiel.liga ? "dem Ligaspiel" : "dem Spiel"} vom ${spielDatum(start.spiel.datum) ?? "?"} (mid ${start.spiel.mid}). Rolle je Platz: Torwart; Abwehr y ≥ 215 = VT; außen (x ≤ 40 oder ≥ 170) = Flügel; Sturm y ≤ 110; sonst MF. Wert = MZ-Formel (mz-wissen.md, Abschnitt 6), Skala 0 bis 10.`
                : undefined
            }
          >
            {!schwach ? (
              <Unavailable title="Startelf" reason="Kein eigenes Spiel mit Stats-XML gespeichert." />
            ) : (
              <SchwachstellenKarte liste={schwach.liste} fehlt={schwach.fehlt} />
            )}
          </Section>

          <Section
            title="Dein Rahmen"
            footer={`${rahmen ? `Zuletzt geändert ${datumZeit(rahmen.geaendert)}. ` : ""}Liest die Seite bei jeder Marktsuche selbst aus dem Gebotsfenster von ManagerZone (verfügbarer Saldo, Ausländer, Arbeitsbewilligungen); von Hand ändern geht weiterhin. Ein Ausländer mit Arbeitsbewilligung zählt nicht als ausländischer Spieler; ist kein Ausländerplatz frei, braucht ein neuer Ausländer eine Arbeitsbewilligung (Kosten kommen dazu).`}
          >
            <RahmenForm werte={r} />
          </Section>

          <Section title="Nicht einheimisch im Kader" footer="Aus der Spieleransicht (?p=players). Fehlt die Seite, steht hier nichts.">
            {auslaender.length ? (
              <List>
                {auslaender.map((s) => (
                  <Row
                    key={s.pid}
                    title={s.name}
                    detail={s.nationalitaet}
                    value={
                      s.arbeitsbewilligung ? (
                        <Badge tone="green">Arbeitsbewilligung{s.arbeitsbewilligung.tage !== undefined ? ` · ${s.arbeitsbewilligung.tage} Tage` : ""}</Badge>
                      ) : (
                        <Badge>ohne Arbeitsbewilligung</Badge>
                      )
                    }
                  />
                ))}
              </List>
            ) : (
              <Unavailable title="Nationalitäten" reason="Spieleransicht noch nicht mit Nationalität eingelesen (Einstellungen, Kader abrufen)." />
            )}
          </Section>

          {abgelehnt.length > 0 && (
            <Section title="Abgelehnt" footer="Werden nicht mehr vorgeschlagen.">
              <List>
                {abgelehnt.map((a) => (
                  <Row
                    key={a.pid}
                    title={a.name}
                    detail={datumZeit(a.datum)}
                    accessory={
                      <form action={zuruecknehmen}>
                        <input type="hidden" name="pid" value={a.pid} />
                        <button className="pressable text-[15px] text-tint">Zurücknehmen</button>
                      </form>
                    }
                  />
                ))}
              </List>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function SchwachstellenKarte({ liste, fehlt }: { liste: Schwachstelle[]; fehlt: string[] }) {
  return (
    <Card className="px-4 py-3">
      <ul className="space-y-2.5">
        {liste.map((s, i) => (
          <li key={s.slot.pid} title={`${s.spieler.name} · x ${s.slot.x} / y ${s.slot.y}`}>
            <div className="flex items-baseline justify-between gap-2 text-[15px]">
              <span className="min-w-0 truncate">
                <span className="mr-1.5 inline-block w-[4.6rem] text-[12px] font-semibold uppercase tracking-wide text-label-2">{s.rolle}</span>
                {s.spieler.name}
              </span>
              <span className={`tabular-nums ${i === 0 ? "font-semibold" : "text-label-2"}`}>{komma(s.wert)}</span>
            </div>
            <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-fill">
              <div className={`h-full rounded-full ${i === 0 ? "bg-tint" : "bg-label-3"}`} style={{ width: `${s.wert * 10}%` }} />
            </div>
            {s.ohneWechsel && (
              <div className="mt-1 text-[12px] font-semibold text-red">
                Ausdauer {s.spieler.skills.ausdauer?.wert}: bräuchte einen Wechsel, alle 3 sind vergeben
              </div>
            )}
            {i === 0 && <div className="mt-1 text-[12px] font-semibold text-tint">größte Schwachstelle</div>}
          </li>
        ))}
      </ul>
      {fehlt.length > 0 && <p className="mt-3 text-[13px] text-label-2">Nicht bewertet: {fehlt.join(" ")}</p>}
    </Card>
  );
}
