import type Database from "better-sqlite3";

export type RohseiteNeu = {
  art: string;
  url: string;
  status: number | null;
  htmlRoh: string | null;
  htmlDom: string | null;
};

export function speichereRohseite(db: Database.Database, s: RohseiteNeu, zeit = new Date().toISOString()): number {
  const r = db
    .prepare("INSERT INTO rohseite (art, url, abgerufen, status, html_roh, html_dom) VALUES (?, ?, ?, ?, ?, ?)")
    .run(s.art, s.url, zeit, s.status, s.htmlRoh, s.htmlDom);
  return Number(r.lastInsertRowid);
}

export type RohseiteInfo = { id: number; art: string; url: string; abgerufen: string; status: number | null; bytes: number };

export function letzteRohseite(db: Database.Database, art: string): RohseiteInfo | null {
  return (
    (db
      .prepare(
        `SELECT id, art, url, abgerufen, status, length(coalesce(html_dom, html_roh, '')) AS bytes
         FROM rohseite WHERE art = ? ORDER BY abgerufen DESC, id DESC LIMIT 1`,
      )
      .get(art) as RohseiteInfo | undefined) ?? null
  );
}

export function ladeRohseite(db: Database.Database, id: number, variante: "roh" | "dom"): { url: string; html: string } | null {
  const row = db.prepare("SELECT url, html_roh, html_dom FROM rohseite WHERE id = ?").get(id) as
    | { url: string; html_roh: string | null; html_dom: string | null }
    | undefined;
  if (!row) return null;
  const html = variante === "roh" ? row.html_roh : row.html_dom;
  return html === null ? null : { url: row.url, html };
}

export function abrufBeginnen(db: Database.Database, art: string, zeit = new Date().toISOString()): number {
  return Number(db.prepare("INSERT INTO abruf_log (art, gestartet) VALUES (?, ?)").run(art, zeit).lastInsertRowid);
}

export function abrufBeenden(db: Database.Database, id: number, ok: boolean, meldung: string, zeit = new Date().toISOString()) {
  db.prepare("UPDATE abruf_log SET beendet = ?, ok = ?, meldung = ? WHERE id = ?").run(zeit, ok ? 1 : 0, meldung, id);
}

export type AbrufEintrag = { id: number; art: string; gestartet: string; beendet: string | null; ok: number | null; meldung: string | null };

export function letzterAbruf(db: Database.Database, art: string): AbrufEintrag | null {
  return (
    (db.prepare("SELECT * FROM abruf_log WHERE art = ? ORDER BY id DESC LIMIT 1").get(art) as AbrufEintrag | undefined) ??
    null
  );
}
