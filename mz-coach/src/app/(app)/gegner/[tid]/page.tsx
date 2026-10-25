import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LinkZeile } from "@/components/link-zeile";
import { PageHeader } from "@/components/page-header";
import { Card, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeTeamSpiele, teamName } from "@/lib/db/gegner";
import { LIGA_MID_AB } from "@/lib/mz/parser/spielliste";

const MZ = "https://www.managerzone.com";
const datumDe = (d: string) => d.split("-").reverse().join(".");

export default async function GegnerSeite(props: PageProps<"/gegner/[tid]">) {
  await connection();
  const { tid: tidText } = await props.params;
  const tid = Number(tidText);
  const db = getDb();
  const spiele = ladeTeamSpiele(db, tid);
  if (spiele.length === 0) notFound();
  const name = teamName(db, tid) ?? `tid ${tid}`;
  const liga = spiele.filter((s) => s.art === "Ligaspiel" && s.mid > LIGA_MID_AB);
  const fehlen = liga.filter((s) => !s.xml);
  const andere = spiele.length - liga.length;
  const ergebnis = (s: (typeof spiele)[number]) =>
    `${s.heim.name} ${s.tore ? `${s.tore.heim}:${s.tore.gast}` : "–"} ${s.gast.name}`;

  return (
    <>
      <PageHeader title={name} subtitle={`tid ${tid} · ${liga.length} Ligaspiele dieser Saison eingelesen`} />
      <div className="seite lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <div>
          <Section
            title="Ligaspiele dieser Saison"
            footer={`Nur Ligaspiele zählen für die Analyse (mz-wissen.md, Abschnitt 10). Saison erkannt an mid > ${LIGA_MID_AB} (Stand Saison 100). ${andere} weitere Spiele (Pokal, Freundschaft, Scout) eingelesen, aber nicht gewertet.`}
          >
            <List>
              {liga.map((s) =>
                s.xml ? (
                  <LinkZeile key={s.mid} href={`/spiele/${s.mid}`} detail={`${datumDe(s.datum)} · mid ${s.mid} · Stats-XML gespeichert`}>
                    {ergebnis(s)}
                  </LinkZeile>
                ) : (
                  <Row key={s.mid} title={ergebnis(s)} detail={`${datumDe(s.datum)} · mid ${s.mid} · Stats-XML fehlt`} />
                ),
              )}
            </List>
          </Section>
          <Section title="Analyse">
            <Unavailable
              title="Spielt er immer gleich?"
              reason={
                fehlen.length
                  ? `Noch ${fehlen.length} von ${liga.length} Ligaspielen ohne Stats-XML. Die Auswertung folgt, sobald die Spiele da sind.`
                  : "Gegneranalyse wird gerade gebaut (Etappe 4)."
              }
            />
          </Section>
        </div>
        {fehlen.length > 0 && (
          <Section
            title="Fehlende Stats-XML holen"
            footer="Je Spiel: erste Adresse öffnen und neu laden, bis „ok“ kommt. Dann die zweite Adresse öffnen, Strg+A, Strg+C und unter Spiele einfügen."
          >
            <Card className="space-y-4 p-4">
              {fehlen.map((s) => (
                <div key={s.mid}>
                  <div className="text-[15px] font-semibold">{datumDe(s.datum)} · {ergebnis(s)}</div>
                  <div className="mt-1 select-all break-all font-mono text-[12px] text-label-2">
                    {`${MZ}/ajax.php?p=matchViewer&sub=check-match&type=2d&mid=${s.mid}&sport=soccer`}
                  </div>
                  <div className="mt-1 select-all break-all font-mono text-[12px] text-label-2">
                    {`view-source:${MZ}/matchviewer/getMatchFiles.php?type=stats&mid=${s.mid}&sport=soccer`}
                  </div>
                </div>
              ))}
            </Card>
          </Section>
        )}
      </div>
    </>
  );
}
