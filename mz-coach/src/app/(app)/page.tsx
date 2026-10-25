import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Hero, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader, letzteAenderungen } from "@/lib/db/kader";
import { einsatzImLigaspiel } from "@/lib/mz/einsatz";
import { StatusBadges } from "@/components/status";
import { datumZeit, heuteInBerlin } from "@/lib/format";
import { naechsterLigaspieltag, TEAM } from "@/lib/wissen/startbasis";

export default async function Uebersicht() {
  await connection(); // Datum pro Anfrage, nicht beim Build
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const db = getDb();
  const aenderungen = letzteAenderungen(db, 8);
  const kader = ladeKader(db);
  const einsatz = kader.map((s) => ({ s, e: einsatzImLigaspiel(s, spieltag) }));
  const taktikStand = kader.map((s) => s.statusStand?.aufstellbar).filter(Boolean).sort().at(-1);
  const fehlen = einsatz.filter((x) => x.e.lage === "nicht_bereit" || x.e.lage === "unklar" || x.s.status?.verletzt);
  const zurueck = einsatz.filter((x) => x.e.lage === "wieder_bereit");
  const gesperrt = kader.filter((s) => s.status?.gesperrt);
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
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-8">
        <Section title="Nächstes Ligaspiel" footer="Datum aus der Regel: Ligaspiele immer mittwochs und sonntags. Gegner und Anstoß kommen mit dem Spielplan-Abruf.">
          <Hero>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">Ligaspieltag</div>
            <div className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight">{datum}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-[12px] bg-white/15 px-3 py-1.5 text-[13px] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              Gegner und Countdown: noch nicht verfügbar
            </div>
          </Hero>
        </Section>

        <Section title="Empfohlene Taktik">
          <Unavailable title="Taktik fürs nächste Spiel" reason="Gegneranalyse und Taktik-Generator folgen in Etappe 4 und 5." />
        </Section>

        <Section
          title={`Einsatz am ${datum}`}
          footer={
            taktikStand
              ? `Kegel laut Taktikseite (Stand ${datumZeit(taktikStand)}) plus Enddatum aus dem Trainingslager. Ob ein Spieler am Enddatum selbst schon frei ist, ist nicht belegt. Sperren stehen auf ManagerZone je Wettbewerb.`
              : undefined
          }
        >
          {!taktikStand ? (
            <Unavailable title="Wer ist aufstellbar?" reason="Taktikseite noch nicht eingelesen (Einstellungen, Seiten hochladen)." />
          ) : (
            <List>
              {fehlen.length === 0 && zurueck.length === 0 && gesperrt.length === 0 && (
                <Row title="Alle aufstellbar" detail="Laut Taktikseite hat kein Spieler einen Kegel." />
              )}
              {fehlen.map(({ s, e }) => (
                <Row key={s.pid} title={<span className="flex flex-wrap items-center gap-1.5">{s.name} <StatusBadges s={s} /></span>} detail={e.text} />
              ))}
              {zurueck.map(({ s, e }) => (
                <Row key={s.pid} title={<span className="flex flex-wrap items-center gap-1.5">{s.name} <span className="text-[13px] text-green">wieder dabei</span></span>} detail={e.text} />
              ))}
              {gesperrt.map((s) => (
                <Row
                  key={`g${s.pid}`}
                  title={`${s.name}: Sperre`}
                  detail={(s.sperren ?? [])
                    .map((x) => `${x.karte}, ${x.spiele} Spiel(e), gilt laut Seite für ${x.art}: ${x.wettbewerb}`)
                    .join(" · ")}
                />
              ))}
            </List>
          )}
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
