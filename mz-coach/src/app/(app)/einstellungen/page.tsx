import { connection } from "next/server";
import { logout } from "@/app/login/actions";
import { PageHeader } from "@/components/page-header";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { datumZeit } from "@/lib/format";
import { zugangStatus } from "@/lib/mz/zugang";
import { TEAM } from "@/lib/wissen/startbasis";
import { letzteRohseite, letzterAbruf } from "@/lib/db/abruf";
import { AbrufButton } from "./abruf-button";
import { zugangLoeschen } from "./actions";
import { ZugangForm } from "./zugang-form";

export default async function Einstellungen() {
  await connection();
  const db = getDb();
  const zugang = zugangStatus(db);
  const abruf = letzterAbruf(db, "kader");
  const roh = letzteRohseite(db, "kader");
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
        {zugang.eingerichtet && (
          <Section
            title="Abruf von ManagerZone"
            footer="Login im echten Browser (Playwright), Sitzungs-Cookie verschlüsselt gespeichert. Höchstens 2 Anfragen gleichzeitig, 2 bis 4 Sekunden Pause. Nach einem fehlgeschlagenen Login kein automatischer neuer Versuch. Die Seite wird vorerst nur gespeichert, das Auslesen der Spieler folgt."
          >
            {abruf && (
              <div className="mb-3">
                <List>
                  <Row
                    title="Letzter Abruf"
                    value={
                      abruf.ok === null ? (
                        <span>läuft</span>
                      ) : abruf.ok ? (
                        <span className="text-green">ok</span>
                      ) : (
                        <span className="text-red">Fehler</span>
                      )
                    }
                    detail={`${datumZeit(abruf.gestartet)}${abruf.meldung ? ` · ${abruf.meldung}` : ""}`}
                  />
                  {roh && (
                    <Row
                      title="Gespeicherte Kaderseite"
                      detail={`${datumZeit(roh.abgerufen)} · ${roh.bytes} Zeichen`}
                      value={
                        <span className="flex gap-3 text-[15px]">
                          <a className="text-tint" href={`/api/rohseite/${roh.id}`}>Seite</a>
                          <a className="text-tint" href={`/api/rohseite/${roh.id}?v=roh`}>Roh</a>
                        </span>
                      }
                    />
                  )}
                </List>
              </div>
            )}
            <AbrufButton />
          </Section>
        )}
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
