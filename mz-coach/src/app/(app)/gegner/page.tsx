import { PageHeader } from "@/components/page-header";
import { List, Row, Section, Unavailable } from "@/components/ui";
import { QUELLE_TOP10, TOP10 } from "@/lib/wissen/startbasis";

export default function Gegner() {
  return (
    <>
      <PageHeader title="Gegner" />
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
        <Section title="Analyse">
          <Unavailable title="Team analysieren" reason="Spielabruf, XML-Auswertung und Gegneranalyse folgen in Etappe 3 und 4." />
        </Section>
        <Section title="Top 10 Managerwertung" footer={`Quelle: ${QUELLE_TOP10}.`}>
          <List>
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
