import type Database from "better-sqlite3";
import { ladeAuftraege } from "@/lib/db/gebot";
import { ladeLetzteSuche } from "@/lib/db/markt";
import { ladeWatchlist, watchlistAufraeumen, type WatchEintrag } from "@/lib/db/watch";

// Watchlist laden und vorher aufräumen (beendete Auktionen fliegen raus, Momentaufnahmen aus der neuesten Suche)
export function watchlistAktuell(db: Database.Database): { liste: WatchEintrag[]; entfernt: string[] } {
  const auftragEnde = new Map(
    ladeAuftraege(db)
      .filter((a) => a.auktionEnde)
      .map((a) => [a.pid, a.auktionEnde!]),
  );
  const entfernt = watchlistAufraeumen(db, ladeLetzteSuche(db)?.spieler ?? [], auftragEnde);
  // Wer ein aktives Gebot hat, steht unter Gebote, nicht auf der Watchlist (Marcus, 31.10.2026)
  const imGebot = new Set(
    ladeAuftraege(db)
      .filter((a) => a.status === "aktiv")
      .map((a) => a.pid),
  );
  return { liste: ladeWatchlist(db).filter((w) => !imGebot.has(w.pid)), entfernt };
}
