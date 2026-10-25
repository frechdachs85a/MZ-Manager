import type Database from "better-sqlite3";

// Team, mit dem Freundschaftsspiele vereinbart werden (Team der Frau von Marcus). Laut ManagerZone-Support
// gelten für beide Konten dieselben Bedingungen; Transfers untereinander sind verboten. Die tid steht nur
// in der eigenen Datenbank, nie im öffentlichen Repo.
export type FreundTeam = { tid: number; taktik: string };
const KEY = "freund_team";

export function ladeFreundTeam(db: Database.Database): (FreundTeam & { geaendert: string }) | null {
  const r = db.prepare("SELECT wert, geaendert FROM einstellung WHERE schluessel = ?").get(KEY) as
    | { wert: string; geaendert: string }
    | undefined;
  return r ? { ...(JSON.parse(r.wert) as FreundTeam), geaendert: r.geaendert } : null;
}

export function speichereFreundTeam(db: Database.Database, t: FreundTeam, zeit = new Date().toISOString()) {
  db.prepare(
    "INSERT INTO einstellung (schluessel, wert, geaendert) VALUES (?, ?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert",
  ).run(KEY, JSON.stringify(t), zeit);
}
