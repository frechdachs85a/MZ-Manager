import "server-only";
import type Database from "better-sqlite3";
import { speichereVerkauf } from "@/lib/db/verkauf";
import { parseVerkaufshistorie, type Verkauf } from "@/lib/mz/parser/verkauf";
import type { MzSitzung } from "./sitzung";

// Spielerseite ?p=players&pid=… öffnen und den letzten Verkauf (Kasten "Transfers") speichern. Ohne Kasten: nichts
// speichern und undefined zurückgeben, statt einen Verkauf anzunehmen.
export async function verkaufLaden(db: Database.Database, s: MzSitzung, pid: number): Promise<Verkauf | undefined> {
  const seite = await s.holeSeite(`/?p=players&pid=${pid}`);
  const v = parseVerkaufshistorie(seite.htmlDom ?? seite.htmlRoh ?? "");
  if (!v) return undefined;
  speichereVerkauf(db, pid, v);
  return v;
}
