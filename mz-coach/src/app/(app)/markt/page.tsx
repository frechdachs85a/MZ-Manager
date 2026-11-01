// Transfermarkt: Empfehlung je Schwachstelle mit Spielerprofil und Bietomat, Kandidaten, Schwachstellen, Rahmen.

import Link from "next/link";
import { stilDe } from "@/lib/mz/analyse/gegner";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { letzterAbruf } from "@/lib/db/abruf";
import { datumZeit, spielDatum } from "@/lib/format";
import { GRUND_TEXT, HEIMATLAND, type Grund, type Schwachstelle } from "@/lib/mz/analyse/markt";
import { zuruecknehmen } from "./actions";
import { posDe } from "@/lib/mz/formel";
import { VorschlagKarte } from "@/components/vorschlag-karte";
import { watchlistAktuell } from "@/lib/watchlist";
import { MarktReiter } from "@/components/markt-reiter";
import { RahmenForm, SuchKnopf } from "./formulare";
import { ladeAuftraege } from "@/lib/db/gebot";
import { marktErgebnis } from "@/lib/markt-ergebnis";
import { ladeVerkaeufe } from "@/lib/db/verkauf";

const komma = (n: number, s = 2) => n.toFixed(s).replace(".", ",");

// Seite Transfermarkt
export default async function Markt(props: PageProps<"/markt">) {
  await connection();
  const db = getDb();
  const { kader, start, suche, rahmen, abgelehnt, schwach, luecken, r, ergebnis } = marktErgebnis(db);
  const abruf = letzterAbruf(db, "markt");
  const imBietomat = new Map(
    ladeAuftraege(db)
      .filter((a) => a.status === "aktiv")
      .map((a) => [a.pid, a.maximum]),
  );
  const verkaeufe = ladeVerkaeufe(db);
  const auftraege = ladeAuftraege(db).filter((a) => a.status === "aktiv");
  const watch = watchlistAktuell(db).liste;
  const aufWatch = new Set(watch.map((w) => w.pid));
  // Vorschläge (Marcus, 31.10.2026): die 30 mit der größten Verbesserung (ohne Watchlist), sortiert nach Verbesserung
  // oder nach Preis-Leistung (MZ-Gewinn je Million Mindestpreis), zum Durchblättern
  const TOP = 30;
  const sp = await props.searchParams;
  const sortPreis = sp.sort === "preis";
  const pl = (b: { gewinn: number; preis: number }) => b.gewinn / Math.max(1, b.preis / 1_000_000);
  // Wer auf der Watchlist steht oder ein aktives Gebot hat, ist kein Vorschlag mehr (Marcus, 31.10.2026)
  const imGebot = new Set(auftraege.map((a) => a.pid));
  const top = (ergebnis?.alle ?? []).filter((b) => !aufWatch.has(b.kandidat.pid) && !imGebot.has(b.kandidat.pid)).slice(0, TOP);
  const alleVorschlaege = sortPreis ? [...top].sort((a, b) => pl(b) - pl(a)) : top;
  const JE_SEITE = 4;
  const seiten = Math.max(1, Math.ceil(alleVorschlaege.length / JE_SEITE));
  const seitenLink = (n: number) => `/markt?seite=${n}${sortPreis ? "&sort=preis" : ""}`;
  const seite = Math.min(seiten, Math.max(1, Number(typeof sp.seite === "string" ? sp.seite : 1) || 1));
  const vorschlaege = alleVorschlaege.slice((seite - 1) * JE_SEITE, seite * JE_SEITE);
  const auslaender = kader.filter((s) => s.nationalitaet && s.nationalitaet !== HEIMATLAND);

  return (
    <>
      <PageHeader
        title="Transfermarkt"
        subtitle={suche ? `Suche vom ${datumZeit(suche.zeit)} · ${suche.spieler.length} Spieler geprüft` : "Transfermarkt-Scout"}
      />
      <MarktReiter aktiv="/markt" anzahl={{ "/markt": alleVorschlaege.length, "/markt/watchlist": watch.length, "/markt/bietomat": auftraege.filter((a) => a.status === "aktiv").length }} />
      <div className="seite">
        <Section
          title="Vorschläge"
          footer="Die 30 Spieler aus der letzten Marktsuche, die deine Startelf am meisten verbessern. Preis-Leistung = MZ-Gewinn je Million Mindestpreis (höheres aus Startgebot und aktuellem Gebot; der Endpreis kann höher liegen). Annehmen setzt ihn auf die Watchlist, Ablehnen blendet ihn aus."
        >
          {schwach && schwach.zugaenge.length > 0 && (
            <Card className="mb-3 border-l-4 border-green p-3 text-[13.5px]">
              <div className="font-semibold">Zugänge schon eingerechnet (kommen etwa 24 Stunden nach Auktionsende in den Kader)</div>
              <ul className="mt-1 space-y-0.5 text-label-2">
                {schwach.zugaenge.map((z) => {
                  const e = schwach.ersetzt.find((x) => x.zugang === z.spieler.name);
                  return (
                    <li key={z.spieler.pid}>
                      <b className="text-label">{z.spieler.name}</b> ({z.spieler.alter ?? "?"} J.)
                      {e
                        ? `: übernimmt ${posDe(e.rolle)} statt ${e.statt} (${e.alt.toFixed(2).replace(".", ",")} → ${e.neu.toFixed(2).replace(".", ",")}); gesucht wird jetzt für die nächste Schwachstelle.`
                        : ": verbessert keinen Startplatz, ändert die Suche nicht."}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {luecken.length > 0 && (
            <Card className="mb-3 border-l-4 border-orange p-3 text-[13.5px]">
              <div className="font-semibold">Erfolgreiche Top-10-Taktiken, für die dir ein Spielertyp fehlt</div>
              <ul className="mt-1 space-y-1 text-label-2">
                {luecken.map((l) => (
                  <li key={l.stil.schluessel}>
                    <b className="text-label">{stilDe(l.stil.schluessel)}</b> gegen „{l.klasse}“: {l.stil.S} S / {l.stil.U} U / {l.stil.N} N ({Math.round(l.stil.quote * 100)} %)
                    {l.deinBester ? `, dein bester Stil dagegen ${stilDe(l.deinBester.schluessel)} ${Math.round(l.deinBester.quote * 100)} %` : ", du hast keinen bewährten Stil dagegen"}. Fehlt:{" "}
                    {l.plaetze.map((p) => `${posDe(p.rolle)} (dein bester: ${p.spieler.name} ${p.wert.toFixed(2).replace(".", ",")})`).join(", ")}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[12px] text-label-3">
                „Fehlt“ = dein bester Spieler für diesen Platz ist schwächer als dein heute schwächster Startelf-Platz. Passende Kandidaten stehen unten mit „für …“.
              </p>
            </Card>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="mr-1 text-label-2">Sortieren:</span>
            {[
              { href: "/markt", aktiv: !sortPreis, label: "Größte Verbesserung" },
              { href: "/markt?sort=preis", aktiv: sortPreis, label: "Bestes Preis-Leistungs-Verhältnis" },
            ].map((c) => (
              <Link
                key={c.label}
                href={c.href}
                scroll={false}
                className={`rounded-full border px-2.5 py-0.5 ${c.aktiv ? "border-tint bg-tint/10 text-tint" : "border-separator text-label-2 hover:text-label"}`}
              >
                {c.label}
              </Link>
            ))}
          </div>
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
                  <VorschlagKarte
                    key={b.kandidat.pid}
                    b={b}
                    rang={(seite - 1) * JE_SEITE + i + 1}
                    verkauf={verkaeufe.get(b.kandidat.pid)}
                    imBietomat={imBietomat.get(b.kandidat.pid)}
                  />
                ))}
              </div>
              {seiten > 1 && (
                <nav className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[14px]" aria-label="Vorschläge blättern">
                  <Link
                    href={seitenLink(Math.max(1, seite - 1))}
                    scroll={false}
                    aria-disabled={seite === 1}
                    className={`rounded-md border border-separator px-3 py-1 ${seite === 1 ? "pointer-events-none opacity-40" : "hover:text-tint"}`}
                  >
                    ← zurück
                  </Link>
                  {Array.from({ length: seiten }, (_, n) => n + 1).map((n) => (
                    <Link
                      key={n}
                      href={seitenLink(n)}
                      scroll={false}
                      className={`min-w-8 rounded-md border px-2 py-1 text-center tabular-nums ${n === seite ? "border-tint bg-tint/10 font-semibold text-tint" : "border-separator hover:text-tint"}`}
                    >
                      {n}
                    </Link>
                  ))}
                  <Link
                    href={seitenLink(Math.min(seiten, seite + 1))}
                    scroll={false}
                    aria-disabled={seite === seiten}
                    className={`rounded-md border border-separator px-3 py-1 ${seite === seiten ? "pointer-events-none opacity-40" : "hover:text-tint"}`}
                  >
                    weiter →
                  </Link>
                </nav>
              )}
              <p className="mt-2 text-center text-[12px] text-label-3">
                {alleVorschlaege.length} Vorschläge · Seite {seite} von {seiten} · Stand der Marktsuche vom {datumZeit(suche.zeit)}.
              </p>
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
                <span className="mr-1.5 inline-block w-[4.6rem] text-[12px] font-semibold uppercase tracking-wide text-label-2">{posDe(s.rolle)}</span>
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
