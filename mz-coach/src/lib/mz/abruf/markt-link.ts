import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { ladeAuftraege } from "@/lib/db/gebot";
import { meldungAus, type Ergebnis } from "./kader";
import { mitMzSitzung } from "./sitzung";

// Einmaliger Test (nur lesen): Öffnet /?p=transfer mit dem Feld Name/ID (u) in der Adresse den Spieler auf dem
// Transfermarkt? Geprüft wird, ob nach dem Laden ein Spielerblock mit dieser Nummer auf der Seite steht.
export async function marktLinkTesten(db: Database.Database): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "markt-link-test");
  try {
    const pid = ladeAuftraege(db).find((a) => a.status === "aktiv")?.pid;
    if (!pid) throw new Error("Kein aktiver Bietomat-Auftrag für den Test.");
    const varianten = [`/?p=transfer&u=${pid}`, `/?p=transfer&issearch=true&u=${pid}`];
    const teile: string[] = [];
    await mitMzSitzung(
      db,
      async (s) => {
        for (const v of varianten) {
          const seite = await s.holeSeite(v, {
            aufSeite: async (page) => {
              await page.waitForTimeout(4000);
              return page.evaluate((id) => {
                const feld = (document.querySelector("#u") as HTMLInputElement | null)?.value ?? null;
                const ids = [...document.querySelectorAll(".player_id_span")].map((e) => (e.textContent ?? "").trim());
                return { feld, treffer: ids.length, gefunden: ids.includes(String(id)) };
              }, pid);
            },
          });
          speichereRohseite(db, { art: "markt-link-test", url: seite.url, status: seite.status, htmlRoh: null, htmlDom: seite.htmlDom });
          teile.push(`${v.replace(String(pid), "PID")}: ${JSON.stringify(seite.extra)}`);
        }
      },
      { manuell: true },
    );
    const meldung = `Markt-Link-Test mit ${pid}: ${teile.join(" · ")}`;
    abrufBeenden(db, log, true, meldung);
    return { ok: true, meldung };
  } catch (e) {
    const meldung = `Markt-Link-Test: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}
