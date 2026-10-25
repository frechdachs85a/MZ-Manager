import type Database from "better-sqlite3";

// Ein laufendes Gespräch: Verlauf für die API (unverändert wieder mitgeschickt) und Anzeige
export type ChatEintrag = { frage: string; antwort: string; werkzeuge: string[]; zeit: string; verweigert?: boolean };
export type ChatStand = { verlauf: unknown[]; eintraege: ChatEintrag[] };

const KEY = "chat";

export function ladeChat(db: Database.Database): ChatStand {
  const r = db.prepare("SELECT wert FROM einstellung WHERE schluessel = ?").get(KEY) as { wert: string } | undefined;
  return r ? (JSON.parse(r.wert) as ChatStand) : { verlauf: [], eintraege: [] };
}

export function speichereChat(db: Database.Database, c: ChatStand, zeit = new Date().toISOString()) {
  db.prepare(
    "INSERT INTO einstellung (schluessel, wert, geaendert) VALUES (?, ?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert",
  ).run(KEY, JSON.stringify(c), zeit);
}

export function loescheChat(db: Database.Database) {
  db.prepare("DELETE FROM einstellung WHERE schluessel = ?").run(KEY);
}
