import { connection } from "next/server";
import { logout } from "@/app/login/actions";
import { PageHeader } from "@/components/page-header";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { datumZeit } from "@/lib/format";
import { zugangStatus } from "@/lib/mz/zugang";
import { TEAM } from "@/lib/wissen/startbasis";
import { zugangLoeschen } from "./actions";
import { ZugangForm } from "./zugang-form";

export default async function Einstellungen() {
  await connection();
  const zugang = zugangStatus(getDb());
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
        <Section
          title="ManagerZone-Zugang"
          footer="Wird nur auf dem Server gespeichert, mit AES-256-GCM verschlüsselt. Der Schlüssel liegt in der Umgebungsvariable MZ_TRESOR_KEY, nie im Code oder Browser."
        >
          {zugang.eingerichtet ? (
            <List>
              <Row title="Status" value={<span className="text-green">eingerichtet</span>} detail={`seit ${datumZeit(zugang.geaendert!)}`} />
              <li>
                <form action={zugangLoeschen}>
                  <button type="submit" className="pressable min-h-11 w-full py-3 text-left text-[17px] text-red">
                    Zugang löschen
                  </button>
                </form>
              </li>
            </List>
          ) : (
            <ZugangForm />
          )}
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
