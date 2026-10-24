import { logout } from "@/app/login/actions";
import { PageHeader } from "@/components/page-header";
import { Card, List, Row, Section } from "@/components/ui";
import { TEAM } from "@/lib/wissen/startbasis";

export default function Einstellungen() {
  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="px-safe mx-auto max-w-2xl">
        <Section title="Team">
          <List>
            <Row title="Team" value={TEAM.name} />
            <Row title="Team-ID" value={TEAM.tid} />
            <Row title="Liga" value={<span className="text-[15px]">div1.1</span>} />
          </List>
        </Section>
        <Section title="ManagerZone-Zugang" footer="Kommt in Etappe 2. Gespeichert wird nur serverseitig und verschlüsselt.">
          <List>
            <Row title="Status" value="nicht eingerichtet" />
          </List>
        </Section>
        <Section>
          <Card>
            <form action={logout}>
              <button type="submit" className="pressable min-h-11 w-full px-4 py-3 text-left text-[17px] text-red">
                Abmelden
              </button>
            </form>
          </Card>
        </Section>
      </div>
    </>
  );
}
