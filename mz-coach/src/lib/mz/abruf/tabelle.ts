import "server-only";
import type Database from "better-sqlite3";
import { parse } from "node-html-parser";
import { speichereRohseite } from "@/lib/db/abruf";
import type { MzSitzung } from "./sitzung";

// Ligatabelle holen (Marcus, 31.10.2026: ändert sich nur nach Ligaspielen, daher nur im Spieltag-Abruf 5 Stunden nach
// jedem Ligaspiel). Die Tabelle steht nicht im Seiten-HTML von ?p=league&type=senior, sondern kommt über den Reiter
// "Tabelle" (a#league_tab_table, ajax.php …&sub=table), wie bei der Weltliga gesehen (30.10.2026).
export async function ligaTabelleHolen(db: Database.Database, s: MzSitzung): Promise<string> {
  const seite = await s.holeSeite("/?p=league&type=senior");
  speichereRohseite(db, { art: "liga-seite", url: seite.url, status: seite.status, htmlRoh: seite.htmlRoh, htmlDom: seite.htmlDom });
  const reiter = parse(seite.htmlDom ?? seite.htmlRoh ?? "").querySelector("a#league_tab_table")?.getAttribute("href");
  if (!reiter) {
    speichereRohseite(db, { art: "tabelle", url: seite.url, status: seite.status, htmlRoh: seite.htmlRoh, htmlDom: seite.htmlDom });
    return "Ligatabelle: Reiter „Tabelle“ nicht gefunden, Seite gespeichert.";
  }
  const t = await s.holeText(reiter.replace(/&amp;/g, "&"));
  speichereRohseite(db, { art: "tabelle", url: t.url, status: t.status, htmlRoh: t.text, htmlDom: null });
  return "Ligatabelle gelesen.";
}
