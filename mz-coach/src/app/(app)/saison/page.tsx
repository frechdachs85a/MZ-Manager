// Saisonstatistik: eigene Ligaspiele mit Ergebnis, Toren und Kennzahlen.

import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Card, Kachel, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { spielDatum } from "@/lib/format";
import { saisonAuswertung } from "@/lib/saison";
import { LigaTabelle } from "@/components/liga-tabelle";
import { TEAM } from "@/lib/wissen/startbasis";

const komma = (n?: number, s = 1) => (n === undefined ? "n. v." : n.toFixed(s).replace(".", ","));
const FARBE = { S: "bg-tint text-white", U: "bg-gold-hell text-ink", N: "bg-red/85 text-white" } as const;

// Seite Saison
export default async function Saison() {
  await connection();
  const a = saisonAuswertung(getDb());
  const n = a.spiele.length;
  return (
    <>
      <PageHeader title="Saison" subtitle={`${TEAM.name} · ${TEAM.liga} · ${n} Ligaspiele mit Stats-XML`} />
      {n === 0 ? (
        <div className="seite">
          <LigaTabelle db={getDb()} titel="Ligatabelle" />
          <Section title="Ligaspiele">
            <Unavailable
              title="Saisonstatistik"
              reason="Noch keine eigenen Ligaspiele dieser Saison gespeichert. Der tägliche Abruf (ab 4 Uhr) holt sie mit Login."
            />
          </Section>
        </div>
      ) : (
        <>
          <div className="seite mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            <Kachel titel="Bilanz" wert={`${a.bilanz.S}–${a.bilanz.U}–${a.bilanz.N}`} unten="Siege, Unentschieden, Niederlagen" />
            <Kachel titel="Tore" wert={`${a.tore}:${a.gegentore}`} unten={`Differenz ${a.tore - a.gegentore >= 0 ? "+" : ""}${a.tore - a.gegentore}`} />
            <Kachel titel="Ballbesitz" wert={`${komma(a.ballbesitz, 0)} %`} unten="im Schnitt" />
            <Kachel titel="Schüsse aufs Tor" wert={komma(a.schuesseAufsTor)} unten="je Spiel im Schnitt" />
          </div>
          <div className="seite">
            <LigaTabelle db={getDb()} titel="Ligatabelle" />
            <Section title="Formkurve" footer="Neuestes Spiel links. Nur gespeicherte Spiele mit Stats-XML.">
              <div className="flex flex-wrap gap-2">
                {a.spiele.map((s) => (
                  <Link
                    key={s.mid}
                    href={`/spiele/${s.mid}`}
                    title={`${spielDatum(s.datum)} ${s.heim ? "gegen" : "bei"} ${s.gegner} ${s.eigen}:${s.gegnerTore}`}
                    className={`flex h-12 w-12 flex-col items-center justify-center rounded-[10px] text-[15px] font-semibold ${FARBE[s.ergebnis]}`}
                  >
                    {s.ergebnis}
                    <span className="text-[10px] font-normal opacity-80">
                      {s.eigen}:{s.gegnerTore}
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          </div>
          <div className="seite lg:grid lg:grid-cols-3 lg:gap-x-10">
            <Section title="Spiele">
              <List>
                {a.spiele.map((s) => (
                  <Row
                    key={s.mid}
                    title={`${s.heim ? "" : "@ "}${s.gegner}`}
                    detail={`${spielDatum(s.datum)} · Ballbesitz ${komma(s.ballbesitz, 0)} %`}
                    value={
                      <span className="display text-[18px] font-semibold text-label tabular-nums">
                        {s.eigen}:{s.gegnerTore}
                      </span>
                    }
                  />
                ))}
              </List>
            </Section>
            <Section title="Torschützen">
              {a.torschuetzen.length ? (
                <List>
                  {a.torschuetzen.map(([name, z]) => (
                    <Row key={name} title={name} value={<span className="tabular-nums">{z}</span>} />
                  ))}
                </List>
              ) : (
                <Card className="p-5 text-[14px] text-label-2">Noch keine Tore.</Card>
              )}
            </Section>
            <Section title="Vorlagen">
              {a.vorlagengeber.length ? (
                <List>
                  {a.vorlagengeber.map(([name, z]) => (
                    <Row key={name} title={name} value={<span className="tabular-nums">{z}</span>} />
                  ))}
                </List>
              ) : (
                <Card className="p-5 text-[14px] text-label-2">Noch keine Vorlagen.</Card>
              )}
            </Section>
          </div>
        </>
      )}
    </>
  );
}
