// Reiter Watchlist des Transfermarkts (Marcus, 31.10.2026): angenommene Vorschläge, mit Endpreis direkt in den Bietomat,
// jederzeit entfernen. Spieler, deren Auktion vorbei ist, verschwinden von selbst (lib/watchlist.ts).

import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { MarktReiter } from "@/components/markt-reiter";
import { Card, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeAuftraege } from "@/lib/db/gebot";
import { ladeVerkaeufe } from "@/lib/db/verkauf";
import { marktErgebnis, verbesserungFuer } from "@/lib/markt-ergebnis";
import { SpielerKarte } from "@/components/vorschlag-karte";
import { vorschlagAnzahl, watchlistAktuell } from "@/lib/watchlist";
import { vonWatchlist } from "../actions";
import { InBietomat } from "../bietomat/formulare";

export default async function Watchlist() {
  await connection();
  const db = getDb();
  const { liste: watch, entfernt } = watchlistAktuell(db);
  const verkaeufe = ladeVerkaeufe(db);
  const aktiv = ladeAuftraege(db).filter((a) => a.status === "aktiv");
  const imBietomat = new Map(aktiv.map((a) => [a.pid, a.maximum]));
  const vorschlaege = vorschlagAnzahl(db, marktErgebnis(db).ergebnis?.alle ?? []);
  return (
    <>
      <PageHeader title="Transfermarkt" subtitle={`Watchlist · ${watch.length} Spieler`} />
      <MarktReiter aktiv="/markt/watchlist" anzahl={{ "/markt": vorschlaege, "/markt/watchlist": watch.length, "/markt/bietomat": aktiv.length }} />
      <div className="seite">
        {entfernt.length > 0 && (
          <p className="mt-4 rounded-md bg-fill px-3 py-2 text-[13px] text-label-2">Auktion vorbei, von der Watchlist entfernt: {entfernt.join(", ")}.</p>
        )}
        <Section title="Watchlist" footer="Angenommene Vorschläge. Mit einem Endpreis kommt der Spieler in den Bietomat; entfernen geht jederzeit.">
          {watch.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {watch.map((w) => (
                <SpielerKarte
                  key={w.pid}
                  k={w.spieler}
                  v={verbesserungFuer(db, w.spieler)}
                  verkauf={verkaeufe.get(w.pid)}
                  fuss={
                    <div className="space-y-2">
                      <InBietomat pid={w.pid} imBietomat={imBietomat.get(w.pid)} />
                      <form action={vonWatchlist}>
                        <input type="hidden" name="pid" value={w.pid} />
                        <button className="pressable min-h-[40px] w-full rounded-[10px] border border-red/40 text-[14px] font-semibold text-red">
                          Von der Watchlist entfernen
                        </button>
                      </form>
                    </div>
                  }
                />
              ))}
            </div>
          ) : (
            <Card className="p-4 text-[14px] text-label-2">Noch leer. Vorschläge mit „Annehmen“ hierher holen.</Card>
          )}
        </Section>
      </div>
    </>
  );
}
