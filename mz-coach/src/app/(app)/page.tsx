import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Card, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { letzteAenderungen } from "@/lib/db/kader";
import { datumZeit } from "@/lib/format";
import { naechsterLigaspieltag, TEAM } from "@/lib/wissen/startbasis";

function heuteInBerlin(): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" })
    .format(new Date())
    .split("-")
    .map(Number);
  return new Date(y, m - 1, d);
}

export default async function Uebersicht() {
  await connection(); // Datum pro Anfrage, nicht beim Build
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const aenderungen = letzteAenderungen(getDb(), 8);
  const datum = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(spieltag);

  return (
    <>
      <PageHeader
        title="Übersicht"
        subtitle={`${TEAM.name} · ${TEAM.liga}`}
        action={
          <Link href="/einstellungen" aria-label="Einstellungen" className="pressable -mr-2 flex h-11 w-11 items-center justify-center text-tint">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        }
      />
      <div className="px-safe mx-auto max-w-2xl">
        <Section title="Nächstes Ligaspiel" footer="Datum aus der Regel: Ligaspiele immer mittwochs und sonntags. Gegner und Anstoß kommen mit dem Spielplan-Abruf.">
          <Card className="p-4">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-tint">Ligaspieltag</div>
            <div className="mt-1 text-[22px] font-bold tracking-tight">{datum}</div>
            <div className="mt-1 text-[15px] text-label-2">Gegner und Countdown: noch nicht verfügbar</div>
          </Card>
        </Section>

        <Section title="Empfohlene Taktik">
          <Unavailable title="Taktik fürs nächste Spiel" reason="Gegneranalyse und Taktik-Generator folgen in Etappe 4 und 5." />
        </Section>

        <Section title="Ausfälle">
          <Unavailable title="Verletzt, gesperrt, Trainingslager" reason="Wird mit dem Kaderabruf von ManagerZone geladen (Etappe 2)." />
        </Section>

        <Section title="Tabelle">
          <Unavailable title={TEAM.liga} reason="Tabellenabruf folgt mit dem ManagerZone-Abruf." />
        </Section>

        <Section title="Letzte Skill-Änderungen">
          {aenderungen.length ? (
            <List>
              {aenderungen.map((a, i) => (
                <Row
                  key={i}
                  title={`${a.name}: ${a.feld}`}
                  detail={datumZeit(a.datum)}
                  value={<span className="tabular-nums">{a.alt ?? "?"} → {a.neu ?? "?"}</span>}
                />
              ))}
            </List>
          ) : (
            <Unavailable title="Änderungsliste" reason="Entsteht ab dem zweiten Kaderabruf, jede Änderung wird mit Datum gespeichert." />
          )}
        </Section>
      </div>
    </>
  );
}
