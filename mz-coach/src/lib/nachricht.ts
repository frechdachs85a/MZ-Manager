import "server-only";
import type Database from "better-sqlite3";
import webpush from "web-push";

// Nachrichten an Marcus (31.10.2026: Auktionsbericht als Push aufs Handy und als Pop-up beim nächsten Besuch der Seite).
// Jede Nachricht wird gespeichert (Pop-up, bis sie als gelesen markiert ist) und an alle angemeldeten Geräte gepusht.
// Die VAPID-Schlüssel entstehen beim ersten Bedarf und liegen in der Datenbank (Tabelle einstellung), nie im Repo.

export type Nachricht = { id: number; zeit: string; titel: string; text: string; link: string | null };

const VAPID_KEY = "push_vapid";
const KONTAKT = "mailto:mz-coach@localhost";

// Öffentlicher und privater Schlüssel (einmal erzeugt, danach gleich)
export function vapid(db: Database.Database): { publicKey: string; privateKey: string } {
  const r = db.prepare("SELECT wert FROM einstellung WHERE schluessel = ?").get(VAPID_KEY) as { wert: string } | undefined;
  if (r) return JSON.parse(r.wert);
  const k = webpush.generateVAPIDKeys();
  const zeit = new Date().toISOString();
  db.prepare("INSERT INTO einstellung (schluessel, wert, geaendert) VALUES (?, ?, ?)").run(VAPID_KEY, JSON.stringify(k), zeit);
  return k;
}

// Gerät für Push anmelden (Abo aus dem Browser)
export function pushAnmelden(db: Database.Database, abo: { endpoint: string }) {
  db.prepare("INSERT INTO push_abo (endpoint, abo_json, erstellt) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET abo_json = excluded.abo_json").run(
    abo.endpoint,
    JSON.stringify(abo),
    new Date().toISOString(),
  );
}

export function pushAbmelden(db: Database.Database, endpoint: string) {
  db.prepare("DELETE FROM push_abo WHERE endpoint = ?").run(endpoint);
}

export function pushGeraete(db: Database.Database): number {
  return (db.prepare("SELECT count(*) AS n FROM push_abo").get() as { n: number }).n;
}

// Nachricht speichern und an alle Geräte pushen. Abgelaufene Abos (404/410) werden entfernt. Gibt die Zahl der
// erreichten Geräte zurück; Fehler beim Pushen verhindern nie das Speichern.
export async function benachrichtige(db: Database.Database, n: { titel: string; text: string; link?: string }): Promise<number> {
  const zeit = new Date().toISOString();
  const id = Number(db.prepare("INSERT INTO nachricht (zeit, titel, text, link) VALUES (?, ?, ?, ?)").run(zeit, n.titel, n.text, n.link ?? null).lastInsertRowid);
  const abos = db.prepare("SELECT endpoint, abo_json FROM push_abo").all() as { endpoint: string; abo_json: string }[];
  if (!abos.length) return 0;
  const k = vapid(db);
  webpush.setVapidDetails(KONTAKT, k.publicKey, k.privateKey);
  const nutzlast = JSON.stringify({ id, titel: n.titel, text: n.text, link: n.link ?? "/" });
  let ok = 0;
  for (const a of abos) {
    try {
      await webpush.sendNotification(JSON.parse(a.abo_json), nutzlast, { TTL: 24 * 3600 });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) pushAbmelden(db, a.endpoint);
    }
  }
  return ok;
}

// Ungelesene Nachrichten (für das Pop-up)
export function ungelesen(db: Database.Database): Nachricht[] {
  return db.prepare("SELECT id, zeit, titel, text, link FROM nachricht WHERE gelesen = 0 ORDER BY id").all() as Nachricht[];
}

export function alsGelesen(db: Database.Database, ids: number[]) {
  const u = db.prepare("UPDATE nachricht SET gelesen = 1 WHERE id = ?");
  db.transaction(() => ids.forEach((i) => u.run(i)))();
}
