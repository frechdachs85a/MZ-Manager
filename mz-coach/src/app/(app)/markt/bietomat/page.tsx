// Bietomat-Seite: neuer Auftrag, Regeln des automatischen Bietens, Aufträge mit Gebotskarte und Spielerprofil, Protokoll.

import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Badge, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeAuftraege, ladeProtokoll } from "@/lib/db/gebot";
import { ladeMarktRahmen } from "@/lib/db/markt";
import { datumZeit } from "@/lib/format";
import { auftragLoeschen } from "./actions";
import { Bietomat, GebotKarte } from "./formulare";
import { SpielerProfil } from "@/components/spieler-profil";
import { MarktInfo } from "@/components/markt-info";

const STATUS_TON = {
  aktiv: "green",
  beendet: undefined,
  abgebrochen: "red",
} as const;

// Seite Bietomat
export default async function BietomatSeite() {
  await connection();
  const db = getDb();
  const auftraege = ladeAuftraege(db);
  const log = ladeProtokoll(db, undefined, 30);
  const saldo = ladeMarktRahmen(db)?.werte.kapital;
  const namen = new Map(auftraege.map((a) => [a.pid, a.name ?? String(a.pid)]));
  return (
    <>
      <PageHeader title="Bietomat" subtitle="Spieler per Nummer laden, Höchstgebot und Zeitraum festlegen" />
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-8">
        <div>
          <Section
            title="Neuer Auftrag"
            footer="Spielernummer oder Name eintippen: Suche über das Feld Name/ID von ManagerZone, sonst mit den Standardfiltern der Marktseite. Mehrere Treffer: aus der Liste wählen. Ohne „Bieten bis“ gilt das Auktionsende."
          >
            <Bietomat saldo={saldo} />
          </Section>
          <Section title="Automatisches Bieten">
            <List>
              <Row
                title={<Badge tone="green">aktiv</Badge>}
                detail="Ab 3 Minuten vor Ende: nur wenn ein anderer vorne liegt, immer nur die kleinste zulässige Stufe (Vorschlag von ManagerZone), nie über deinem Endpreis (in Euro umgerechnet, aufgerundet). Verlängerungen werden verfolgt, bis die Auktion vorbei ist."
              />
              <Row title="Vorrang" detail="45 Minuten vor bis 60 Minuten nach einem Auktionsende starten keine anderen Abrufe." />
            </List>
          </Section>
        </div>
        <div>
          <Section title="Aufträge">
            {auftraege.length ? (
              <List>
                {auftraege.map((a) => (
                  <li key={a.pid} className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[14.5px] font-medium leading-snug">{`${a.name ?? "?"} (${a.pid})`}</div>
                        {!a.auktionEnde && (
                          <div className="mt-0.5 text-[12.5px] text-red">Auktionsende unbekannt: Spieler neu laden und Auftrag erneut speichern, sonst wird nicht geboten.</div>
                        )}
                      </div>
                      <Badge tone={STATUS_TON[a.status]}>{a.status}</Badge>
                      <form action={auftragLoeschen}>
                        <input type="hidden" name="pid" value={a.pid} />
                        <button type="submit" className="text-[13px] font-semibold text-red">
                          Löschen
                        </button>
                      </form>
                    </div>
                    <GebotKarte
                      pid={a.pid}
                      maximum={a.maximum}
                      bietenBis={a.bietenBis}
                      auktionEnde={a.auktionEnde}
                      eigenesGebot={ladeProtokoll(db, a.pid, 50).find((l) => l.text.startsWith("Geboten:"))?.betrag ?? undefined}
                    />
                    {a.spieler && (
                      <div className="mt-3">
                        <MarktInfo s={a.spieler} stand={`Stand beim Laden (${datumZeit(a.erstellt)}); Gebot und Ende verfolgt der Bietomat in der heißen Phase live.`} />
                      </div>
                    )}
                    {a.spieler && (
                      <div className="mt-3">
                        <SpielerProfil skills={a.spieler.skills} scout={a.spieler.scout} />
                      </div>
                    )}
                  </li>
                ))}
              </List>
            ) : (
              <Unavailable title="Aufträge" reason="Noch kein Auftrag gespeichert." />
            )}
          </Section>
          <Section title="Protokoll">
            {log.length ? (
              <List>
                {log.map((l, i) => (
                  <Row key={i} title={l.text} detail={`${namen.get(l.pid) ?? l.pid} · ${datumZeit(l.zeit)}`} />
                ))}
              </List>
            ) : (
              <Unavailable title="Protokoll" reason="Noch keine Einträge." />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
