import { PageHeader } from "@/components/page-header";
import { Section, Unavailable } from "@/components/ui";

export default function Chat() {
  return (
    <>
      <PageHeader title="Chat" />
      <div className="seite">
        <div className="lg:max-w-3xl">
        <Section>
          <Unavailable title="Frag den MZ Coach" reason="Chat mit Werkzeugen und Wissensspeicher folgt in Etappe 6." />
        </Section>
        </div>
      </div>
    </>
  );
}
