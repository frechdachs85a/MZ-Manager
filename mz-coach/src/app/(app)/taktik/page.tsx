import { PageHeader } from "@/components/page-header";
import { Spielfeld } from "@/components/spielfeld";
import { PruefForm } from "./pruef-form";
import { Badge, Card, List, Row, Section, Unavailable } from "@/components/ui";
import { QUELLE_TAKTIKEN, TAKTIKEN } from "@/lib/wissen/startbasis";
import { connection } from "next/server";
import { LinkZeile } from "@/components/link-zeile";
import { getDb } from "@/lib/db";
import { datumZeit } from "@/lib/format";
import { archivLaden, spieleJeTaktik } from "@/lib/taktik-archiv";
import { ArchivForm } from "./archiv-form";

export default async function Taktik() {
  await connection();
  const db = getDb();
  const archiv = archivLaden(db);
  const spiele = spieleJeTaktik(db, archiv);
  return (
    <>
      <PageHeader title="Taktik" subtitle={`${archiv.length} von ${TAKTIKEN.length} Reitern im Archiv`} />
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-10 lg:items-start">
        <div>
          <Section
            title="Archiv"
            footer="Geprüft gegen den aktuellen Kader (Kegel, Verletzung, Sperre ändern sich). Spiele: eigene gespeicherte Spiele, deren Startaufstellung bis auf 2 Punkte zur Taktik passt."
          >
            {archiv.length > 0 && (
              <div className="mb-4">
                <List>
                  {archiv.map((a) => {
                    const sp = spiele.get(a.reiter) ?? [];
                    const s = sp.filter((x) => x.eigen > x.gegnerTore).length;
                    const u = sp.filter((x) => x.eigen === x.gegnerTore).length;
                    const n = sp.length - s - u;
                    return (
                      <LinkZeile
                        key={a.reiter}
                        href={`/taktik/${encodeURIComponent(a.reiter)}`}
                        detail={`${a.pruefung ? (a.pruefung.ok ? "Prüfung ohne Fehler" : `${a.pruefung.fehler.length} Fehler`) : `XML-Fehler: ${a.xmlFehler}`}${a.pruefung?.hinweise.length ? `, ${a.pruefung.hinweise.length} Hinweise` : ""} · ${sp.length ? `${sp.length} ${sp.length === 1 ? "Spiel" : "Spiele"} (${s} S, ${u} U, ${n} N)` : "noch kein Spiel zugeordnet"} · gespeichert ${datumZeit(a.gespeichert)}`}
                      >
                        <span className="flex items-center gap-2">
                          {a.reiter}
                          {a.pruefung && <Badge tone={a.pruefung.ok ? "green" : "red"}>{a.pruefung.ok ? "ok" : "Fehler"}</Badge>}
                        </span>
                      </LinkZeile>
                    );
                  })}
                </List>
              </div>
            )}
            <ArchivForm reiter={TAKTIKEN.map((t) => t.name)} />
          </Section>
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
