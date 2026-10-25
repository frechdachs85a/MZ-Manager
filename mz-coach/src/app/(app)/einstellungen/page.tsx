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
import { HochladenForm } from "./hochladen-form";
import { zugangLoeschen } from "./actions";
import { ZugangForm } from "./zugang-form";
import { FreundForm } from "./freund-form";
import { ladeFreundTeam } from "@/lib/db/freunde";

export default async function Einstellungen() {
  await connection();
  const db = getDb();
  const zugang = zugangStatus(db);
  const abruf = letzterAbruf(db, "kader");
  const roh = letzteRohseite(db, "kader");
  const freund = ladeFreundTeam(db);
  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="seite">
        <div className="lg:max-w-2xl">
        <Section title="Team">
          <List>
            <Row title="Team" value={TEAM.name} />
            <Row title="Team-ID" value={TEAM.tid} />
            <Row title="Liga" value={<span className="text-[15px]">div1.1</span>} />
          </List>
        </Section>
        <Section
          title="Freundschaftsspiele"
          footer="Team, das jeden Dienstag eingeladen wird (Do und Fr, je 11 und 19 Uhr). Annehmen macht das andere Team selbst. Mit diesem Team sind laut ManagerZone-Support keine Transfers erlaubt: seine Spieler werden auf dem Markt nie vorgeschlagen."
        >
          <FreundForm tid={freund?.tid} taktik={freund?.taktik} />
        </Section>
        <Section
          title="ManagerZone-Zugang"
          footer="Wird nur auf dem Server gespeichert, mit AES-256-GCM verschlüsselt. Der Schlüssel liegt nur auf dem Server (geheimnisse.json auf dem Laufwerk oder Umgebungsvariable MZ_TRESOR_KEY), nie im Code oder Browser."
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
        <Section title="Kader aktualisieren">
          {abruf ? (
            <List>
              <Row
                title="Letzte Aktualisierung"
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
                  detail={`Stand ${datumZeit(roh.abgerufen)} · ${roh.bytes} Zeichen`}
                  value={
                    <a className="text-[15px] text-tint" href={`/api/rohseite/${roh.id}`}>
                      Herunterladen
                    </a>
                  }
                />
              )}
            </List>
          ) : (
            <Card className="p-4 text-[15px] text-label-2">Noch keine Kaderseite eingelesen.</Card>
          )}
        </Section>
        <Section
          title="Von Hand (ohne automatischen Abruf)"
          footer="Auf managerzone.com eingeloggt diese Seiten öffnen, jeweils mit Strg+S (Mac: Cmd+S) speichern und hier hochladen: Kaderübersicht (?p=players&sub=alt), Verletzt / Gesperrt (?p=players&sub=unavailable), Trainingslager (?p=training_camp), Taktik (?p=tactics, zeigt wer aufstellbar ist). Die Seitenart wird erkannt."
        >
          <HochladenForm />
        </Section>
        {zugang.eingerichtet && (
          <Section
            title="Automatisch"
            footer="Login im echten Browser (Playwright), Sitzungs-Cookie verschlüsselt gespeichert. Höchstens 2 Anfragen gleichzeitig, 2 bis 4 Sekunden Pause. Nach einem fehlgeschlagenen Login kein automatischer neuer Versuch. Läuft auf eigenes Risiko (Regeln: docs/mz-seiten.md)."
          >
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
      </div>
    </>
  );
}
