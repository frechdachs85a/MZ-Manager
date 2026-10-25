import { connection } from "next/server";
import { LinkZeile } from "@/components/link-zeile";
import { PageHeader } from "@/components/page-header";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { listeEchteGegner } from "@/lib/db/gegner";
import { ladeTopTeams } from "@/lib/db/top";
import { datumZeit } from "@/lib/format";
import { LIGA_MID_AB } from "@/lib/mz/parser/spielliste";
import { QUELLE_TOP10, TEAM, TOP10 } from "@/lib/wissen/startbasis";

export default async function Gegner() {
  await connection();
  const db = getDb();
  const gegner = listeEchteGegner(db, LIGA_MID_AB, new Set([...ladeTopTeams(db).map((t) => t.tid), TEAM.tid]));
  return (
    <>
      <PageHeader title="Gegner" />
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
        <div>
          <Section
            title="Eingelesene Teams"
            footer="Spielliste des Teams auf ManagerZone öffnen (?p=match&sub=played&tid=…), oben „Ligaspiel“ und „Max“ wählen, mit Strg+S als „Webseite, vollständig“ speichern und unter Einstellungen hochladen."
          >
            {gegner.length === 0 ? (
              <Card className="p-4 text-[15px] text-label-2">Noch keine Spielliste eingelesen.</Card>
            ) : (
              <List>
                {gegner.map((g) => (
                  <LinkZeile
                    key={g.tid}
                    href={`/gegner/${g.tid}`}
                    detail={`${g.liga} Ligaspiele dieser Saison, ${g.mitXml} mit Stats-XML · Stand ${datumZeit(g.stand)}`}
                  >
                    {g.name ?? `tid ${g.tid}`}
                  </LinkZeile>
                ))}
              </List>
            )}
          </Section>
          <Section title="Spiele">
            <List>
              <LinkZeile href="/spiele">Gespeicherte Spiele und Spiel hinzufügen</LinkZeile>
            </List>
          </Section>
        </div>
        <Section title="Top 10 Managerwertung" footer={`Quelle: ${QUELLE_TOP10}. Ihre Spiele werden als Lernmaterial ausgewertet.`}>
          <List>
            <LinkZeile href="/top10" detail="Stile, Wechsel, Taktikwechsel und was gegen welchen Gegner gewinnt">
              Top-10-Analyse öffnen
            </LinkZeile>
            {TOP10.map((t) => (
              <Row
                key={t.tid}
                title={
                  <span className="flex items-baseline gap-2">
                    <span className="w-6 shrink-0 text-right text-[15px] tabular-nums text-label-2">{t.rang}</span>
                    <span>{t.name}</span>
                  </span>
                }
                value={<span className="text-[13px] tabular-nums">tid {t.tid}</span>}
              />
            ))}
          </List>
        </Section>
      </div>
    </>
  );
}
