// Reiter „Spieler eintragen“ des Transfermarkts (Marcus, 01.11.2026: ganz vorne als eigener Reiter): Spieler per Nummer
// oder Name laden, Endpreis eingeben, der Bietomat bietet dann automatisch (Auftrag erscheint unter Gebote).

import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { MarktReiter } from "@/components/markt-reiter";
import { Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeAuftraege } from "@/lib/db/gebot";
import { ladeMarktRahmen } from "@/lib/db/markt";
import { marktErgebnis } from "@/lib/markt-ergebnis";
import { vorschlagAnzahl, watchlistAktuell } from "@/lib/watchlist";
import { Bietomat } from "../bietomat/formulare";

export default async function SpielerEintragen() {
  await connection();
  const db = getDb();
  const aktiv = ladeAuftraege(db).filter((a) => a.status === "aktiv").length;
  const watch = watchlistAktuell(db).liste.length;
  const vorschlaege = vorschlagAnzahl(db, marktErgebnis(db).ergebnis?.alle ?? []);
  return (
    <>
      <PageHeader title="Transfermarkt" subtitle="Spieler eintragen · per Nummer oder Name, mit Endpreis in den Bietomat" />
      <MarktReiter aktiv="/markt/eintragen" anzahl={{ "/markt": vorschlaege, "/markt/watchlist": watch, "/markt/bietomat": aktiv }} />
      <div className="seite">
        <Section
          title="Spieler selbst eintragen"
          footer="Spielernummer oder Name eintippen: Suche über das Feld Name/ID von ManagerZone, sonst mit den Standardfiltern der Marktseite. Mehrere Treffer: aus der Liste wählen. Danach Endpreis eingeben, der Bietomat bietet dann automatisch bis höchstens zu diesem Preis."
        >
          <Bietomat saldo={ladeMarktRahmen(db)?.werte.kapital} />
        </Section>
        <p className="mt-2 text-[13px] text-label-2">
          Gespeicherte Aufträge stehen unter{" "}
          <Link href="/markt/bietomat" className="font-semibold text-tint hover:underline">
            Gebote →
          </Link>
        </p>
      </div>
    </>
  );
}
