import { PageHeader } from "@/components/page-header";
import { Badge, List, Row, Section, Unavailable } from "@/components/ui";
import { QUELLE_TAKTIKEN, TAKTIKEN } from "@/lib/wissen/startbasis";

export default function Taktik() {
  return (
    <>
      <PageHeader title="Taktik" />
      <div className="px-safe mx-auto max-w-2xl">
        <Section title="Taktik gegen Gegner">
          <Unavailable title="Taktik-Generator mit Prüfer" reason="Folgt in Etappe 5, inklusive komplettem XML-Code und automatischer Prüfliste." />
        </Section>
        <Section title="Deine Reiter im Editor" footer={`Quelle: ${QUELLE_TAKTIKEN}.`}>
          <List>
            {TAKTIKEN.map((t) => (
              <Row
                key={t.name}
                title={
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {t.einsatz === "Standard" && <Badge tone="tint">Standard</Badge>}
                  </span>
                }
                detail={
                  <>
                    {t.inhalt}
                    <br />
                    Einsatz: {t.einsatz}
                  </>
                }
              />
            ))}
          </List>
        </Section>
      </div>
    </>
  );
}
