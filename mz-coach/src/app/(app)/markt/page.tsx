import { PageHeader } from "@/components/page-header";
import { Section, Unavailable } from "@/components/ui";

export default function Markt() {
  return (
    <>
      <PageHeader title="Markt" />
      <div className="seite">
        <Section title="Transfermarkt-Scout">
          <Unavailable title="Verbesserungen für deinen Kader" reason="Folgt in Etappe 8 (99-Regel, Alter, Budget, MZ-Wert-Vergleich)." />
        </Section>
      </div>
    </>
  );
}
