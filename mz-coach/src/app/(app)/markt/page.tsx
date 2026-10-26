import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Hero, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { letzterAbruf } from "@/lib/db/abruf";
import { ladeKader } from "@/lib/db/kader";
import { ladeFreundTeam } from "@/lib/db/freunde";
import { ladeAblehnungen, ladeLetzteSuche, ladeMarktRahmen, startelfAusLetztemSpiel } from "@/lib/db/markt";
import { datumZeit, euro, spielDatum } from "@/lib/format";
import { bewerteMarkt, GRUND_TEXT, HEIMATLAND, schwachstellen, type Bewertung, type Grund, type Schwachstelle } from "@/lib/mz/analyse/markt";
import { ablehnen, zuruecknehmen } from "./actions";
import { RahmenForm, SuchKnopf } from "./formulare";

const MZ = "https://www.managerzone.com";
const komma = (n: number, s = 2) => n.toFixed(s).replace(".", ",");

export default async function Markt() {
  await connection();
  const db = getDb();
  const kader = ladeKader(db);
  const start = startelfAusLetztemSpiel(db);
  const suche = ladeLetzteSuche(db);
  const rahmen = ladeMarktRahmen(db);
  const freund = ladeFreundTeam(db);
  const abgelehnt = ladeAblehnungen(db);
  const abruf = letzterAbruf(db, "markt");
  const schwach = start ? schwachstellen(start.elf, kader) : null;
  const r = rahmen?.werte;
  const ergebnis =
    schwach && suche && r
      ? bewerteMarkt(suche.spieler, schwach.liste, {
          kapital: r.kapital,
          auslaenderFrei: r.auslaenderMax - r.auslaender,
          bewilligungenFrei: r.bewilligungenMax - r.bewilligungen,
          abgelehnt: new Set(abgelehnt.map((a) => a.pid)),
          eigene: new Set(kader.map((s) => s.pid)),
          gesperrteTeams: new Set(freund ? [freund.tid] : []),
        })
      : null;
  const auslaender = kader.filter((s) => s.nationalitaet && s.nationalitaet !== HEIMATLAND);

  return (
    <>
      <PageHeader
        title="Transfermarkt"
        subtitle={suche ? `Suche vom ${datumZeit(suche.zeit)} · ${suche.spieler.length} Spieler geprüft` : "Transfermarkt-Scout"}
      />
      <div className="seite lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-x-8">
        <div>
          <Section title="Empfehlung">
            {!schwach ? (
              <Unavailable title="Empfehlung" reason="Kein eigenes Spiel mit Stats-XML gespeichert, daher keine Startelf." />
            ) : !r ? (
              <Unavailable title="Empfehlung" reason="Rahmen unten eintragen (Saldo, Ausländer, Arbeitsbewilligungen). Ohne diese Grenzen wird nichts vorgeschlagen." />
            ) : !suche ? (
              <Unavailable title="Empfehlung" reason="Noch keine Marktsuche. Sie läuft täglich ab 6 Uhr automatisch, oder unten jetzt suchen." />
            ) : ergebnis?.empfehlung ? (
              <EmpfehlungKarte b={ergebnis.empfehlung} />
            ) : (
              <Card className="p-4">
                <div className="text-[17px] font-semibold">Heute kein passender Spieler auf dem Markt</div>
                <p className="mt-1 text-[15px] text-label-2">
                  Von {ergebnis?.geprueft ?? 0} geprüften Spielern verbessert keiner deine Startelf innerhalb deiner Grenzen. Gründe siehe unten.
                </p>
              </Card>
            )}
          </Section>

          {ergebnis && ergebnis.weitere.length > 0 && (
            <Section title="Nächste Kandidaten" footer="Kommen nach, wenn du die Empfehlung ablehnst.">
              <List>
                {ergebnis.weitere.map((b) => (
                  <Row
                    key={b.kandidat.pid}
                    title={b.kandidat.name}
                    detail={`${b.ziel.rolle} statt ${b.ziel.spieler.name} · ${b.kandidat.alter ?? "?"} J. · ${b.kandidat.nationalitaet} · ab ${euro(b.preis)}`}
                    value={<span className="font-semibold tabular-nums text-label">+{komma(b.gewinn)}</span>}
                  />
                ))}
              </List>
            </Section>
          )}

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

          <Section title="Suche" footer={abruf ? `Letzter Abruf ${datumZeit(abruf.gestartet)}: ${abruf.meldung ?? "läuft"}` : "Läuft täglich ab 6 Uhr (Berlin), wenn der ManagerZone-Zugang eingerichtet ist."}>
            <SuchKnopf />
          </Section>
        </div>

        <div>
          <Section
            title="Deine Schwachstellen"
            footer={
              start
                ? `Startelf aus ${start.spiel.liga ? "dem Ligaspiel" : "dem Spiel"} vom ${spielDatum(start.spiel.datum) ?? "?"} (mid ${start.spiel.mid}). Rolle je Platz: Torwart; Abwehr y ≥ 222 = VT; außen (x ≤ 40 oder ≥ 170) = Flügel; Sturm y ≤ 110; sonst MF. Wert = MZ-Formel (mz-wissen.md, Abschnitt 6), Skala 0 bis 10.`
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
            footer={`${rahmen ? `Zuletzt geändert ${datumZeit(rahmen.geaendert)}. ` : ""}Die Zahlen stehen oben im Gebotsfenster von ManagerZone. Ein Ausländer mit Arbeitsbewilligung zählt nicht als ausländischer Spieler; ist kein Ausländerplatz frei, braucht ein neuer Ausländer eine Arbeitsbewilligung (Kosten kommen dazu).`}
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

function EmpfehlungKarte({ b }: { b: Bewertung }) {
  const k = b.kandidat;
  return (
    <div className="space-y-3">
      <Hero>
        <div className="kapitaelchen !text-gold-hell">Verstärkt am meisten</div>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <a href={`${MZ}/?p=players&pid=${k.pid}`} target="_blank" rel="noreferrer" className="text-[26px] font-bold leading-tight tracking-tight underline-offset-4 hover:underline">
              {k.name}
            </a>
            <div className="mt-1 text-[14px] text-white/80">
              {k.alter ?? "?"} J. · {k.nationalitaet} · als {b.ziel.rolle} für {b.ziel.spieler.name}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[34px] font-bold leading-none tabular-nums">+{komma(b.gewinn)}</div>
            <div className="mt-1 text-[12px] text-white/70">MZ-Wert</div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-[13px]">
          <Vergleich label={b.ziel.spieler.name} wert={b.ziel.wert} hell={false} />
          <Vergleich label={k.name} wert={b.neu} hell />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
          <span className="rounded-[10px] bg-white/15 px-2.5 py-1">ab {euro(b.preis)}</span>
          {k.markt.ende && <span className="rounded-[10px] bg-white/15 px-2.5 py-1">Ende {k.markt.ende}</span>}
          <span className="rounded-[10px] bg-white/15 px-2.5 py-1">
            Startelf {komma(b.elfVorher)} → {komma(b.elfNachher)}
          </span>
        </div>
      </Hero>
      <Card className="p-4">
        <div className="text-[15px] font-semibold">Warum dieser Spieler</div>
        <ul className="mt-2 space-y-1.5 text-[15px]">
          {b.gruende.map((g, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-tint" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-[15px] font-semibold">Vorbehalte</div>
        <ul className="mt-2 space-y-1.5 text-[15px] text-label-2">
          {b.vorbehalte.map((g, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </Card>
      <form action={ablehnen}>
        <input type="hidden" name="pid" value={k.pid} />
        <input type="hidden" name="name" value={k.name} />
        <button className="pressable karte min-h-[50px] w-full rounded-[14px] bg-card text-[17px] font-semibold text-red">
          Ablehnen und nächsten suchen
        </button>
      </form>
    </div>
  );
}

// Balken auf der MZ-Skala 0 bis 10, Wert immer als Zahl daneben
function Vergleich({ label, wert, hell }: { label: string; wert: number; hell: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_3rem] items-center gap-2">
      <span className="truncate text-white/80">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-white/15">
        <span className={`block h-full rounded-full ${hell ? "bg-white" : "bg-white/45"}`} style={{ width: `${wert * 10}%` }} />
      </span>
      <span className="text-right font-semibold tabular-nums">{komma(wert)}</span>
    </div>
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
            {i === 0 && <div className="mt-1 text-[12px] font-semibold text-tint">größte Schwachstelle</div>}
          </li>
        ))}
      </ul>
      {fehlt.length > 0 && <p className="mt-3 text-[13px] text-label-2">Nicht bewertet: {fehlt.join(" ")}</p>}
    </Card>
  );
}
