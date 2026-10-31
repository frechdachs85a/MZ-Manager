// Reiter Watchlist des Transfermarkts (Marcus, 31.10.2026): angenommene Vorschläge, mit Endpreis direkt in den Bietomat,
// jederzeit entfernen. Spieler, deren Auktion vorbei ist, verschwinden von selbst (lib/watchlist.ts).

import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { MarktReiter } from "@/components/markt-reiter";
import { MarktInfo } from "@/components/markt-info";
import { Card, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeAuftraege } from "@/lib/db/gebot";
import { ladeVerkaeufe } from "@/lib/db/verkauf";
import { datumZeit } from "@/lib/format";
import { posDe } from "@/lib/mz/formel";
import { marktErgebnis, verbesserungFuer } from "@/lib/markt-ergebnis";
import { SpielerProfil } from "@/components/spieler-profil";
import { VerbesserungZeile } from "@/components/verbesserung-zeile";
import { watchlistAktuell } from "@/lib/watchlist";
import { vonWatchlist } from "../actions";
import { InBietomat } from "../bietomat/formulare";

const MZ = "https://www.managerzone.com";
const komma = (n: number) => n.toFixed(2).replace(".", ",");

export default async function Watchlist() {
  await connection();
  const db = getDb();
  const { liste: watch, entfernt } = watchlistAktuell(db);
  const verkaeufe = ladeVerkaeufe(db);
  const aktiv = ladeAuftraege(db).filter((a) => a.status === "aktiv");
  const imBietomat = new Map(aktiv.map((a) => [a.pid, a.maximum]));
  const aufWatch = new Set(watch.map((w) => w.pid));
  const vorschlaege = (marktErgebnis(db).ergebnis?.alle ?? []).filter((b) => !aufWatch.has(b.kandidat.pid)).length;
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
            <div className="grid gap-3">
              {watch.map((w) => (
                <Card key={w.pid} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a href={`${MZ}/?p=players&pid=${w.pid}`} target="_blank" rel="noreferrer" className="text-[17px] font-bold hover:underline">
                        {w.name}
                      </a>
                      {w.bewertung && (
                        <div className="text-[12.5px] text-label-2">
                          als {posDe(w.bewertung.rolle)} statt {w.bewertung.statt}: +{komma(w.bewertung.gewinn)} MZ-Wert (beim Annehmen)
                        </div>
                      )}
                    </div>
                    <form action={vonWatchlist}>
                      <input type="hidden" name="pid" value={w.pid} />
                      <button className="pressable rounded-md border border-separator px-2.5 py-1 text-[12.5px] font-semibold text-red">Entfernen</button>
                    </form>
                  </div>
                  <div className="mt-2">
                    <VerbesserungZeile v={verbesserungFuer(db, w.spieler)} />
                    <div className="mt-2">
                      <MarktInfo s={w.spieler} verkauf={verkaeufe.get(w.pid)} stand={`Stand der letzten Marktsuche oder beim Annehmen (${datumZeit(w.aufgenommen)})`} />
                    </div>
                    <div className="mt-3">
                      <SpielerProfil skills={w.spieler.skills} scout={w.spieler.scout} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <InBietomat pid={w.pid} imBietomat={imBietomat.get(w.pid)} />
                  </div>
                </Card>
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
