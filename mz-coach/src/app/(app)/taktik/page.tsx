import { PageHeader } from "@/components/page-header";
import { Spielfeld } from "@/components/spielfeld";
import { PruefForm } from "./pruef-form";
import { Badge, Card, List, Row, Section, Unavailable } from "@/components/ui";
import { QUELLE_TAKTIKEN, TAKTIKEN } from "@/lib/wissen/startbasis";

export default function Taktik() {
  return (
    <>
      <PageHeader title="Taktik" />
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
        <div>
          <Section
            title="Taktik prüfen"
            footer="Prüfliste aus mz-wissen.md, Abschnitt 5. Fehler = Regel eindeutig verletzt. Hinweis = Regel ohne genaue Grenze oder nur teilweise prüfbar. Kegel, Verletzung und Sperren aus den eingelesenen Seiten."
          >
            <PruefForm />
          </Section>
          <Section title="Taktik gegen Gegner">
            <Unavailable title="Taktik-Generator" reason="Folgt in Etappe 5, baut auf Gegneranalyse (Etappe 4) und diesem Prüfer auf." />
          </Section>
        </div>
        <div>
        <Section title="Vorlagen auf dem Feld" footer={`Feldspieler-Koordinaten aus ${QUELLE_TAKTIKEN} (ohne Torwart, dort nicht angegeben). Gestrichelt: Sturm-Grenze y 110 und vorderste Linie y 63.`}>
          <Card className="grid grid-cols-2 gap-3 p-3">
            {TAKTIKEN.filter((t) => t.koordinaten).map((t) => (
              <Spielfeld key={t.name} titel={t.name} spieler={t.koordinaten!.map((k) => ({ x: k.x, y: k.y, label: k.rolle }))} />
            ))}
          </Card>
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
      </div>
    </>
  );
}
