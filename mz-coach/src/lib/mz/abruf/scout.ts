import type Database from "better-sqlite3";
import type { Page } from "playwright";
import { speichereRohseite } from "@/lib/db/abruf";
import { aktualisiereSpieler } from "@/lib/db/kader";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { parseSpielerSeite, scoutTextAus } from "@/lib/mz/parser/status";

// Scoutbericht-Text (Auftrag Marcus, 25.10.2026). Der Text steht nicht in der Spieleransicht, das Seiten-Skript
// lädt ihn erst beim Klick auf das Symbol "Scoutbericht" nach (Link mit href="#"). Die Webseite klickt deshalb
// wie ein Mensch und liest die Antwort mit, die die Seite selbst anfordert: keine erratene Adresse.
// Nur für Spieler ohne gespeicherten Text oder mit geänderten Sternen, nacheinander mit Pause.
export const PAUSE_MS = 2500;
const WARTEN_MS = 15_000;

export type ScoutAntwort = { pid: number; url: string; roh: string; text: string };

const sterneText = (s?: SpielerDaten["scoutSterne"]) => (s?.hoch !== undefined && s?.niedrig !== undefined ? `${s.hoch}/${s.niedrig}` : undefined);

// Welche Spieler einen (neuen) Text brauchen: Scoutbericht vorhanden und Text fehlt oder Sterne geändert
export function brauchtText(alt: SpielerDaten | undefined, sterne: string): boolean {
  return !alt?.scoutText || alt.scoutTextSterne !== sterne;
}

export function scoutKlicker(gespeichert: Map<number, SpielerDaten>) {
  return async (page: Page, html: string): Promise<{ antworten: ScoutAntwort[]; fehler: string[] }> => {
    const antworten: ScoutAntwort[] = [];
    const fehler: string[] = [];
    const seite = parseSpielerSeite(html);
    for (const sp of seite.spieler) {
      if (!sp.scout || !sp.hatScoutLink) continue;
      if (!brauchtText(gespeichert.get(sp.pid), `${sp.scout.hoch}/${sp.scout.niedrig}`)) continue;
      try {
        const link = page.locator(`#${sp.block} .scout_report a`).first();
        // Erste Anfrage, die das Seiten-Skript nach dem Klick stellt
        // Antworten nach dem Klick sammeln; die Seite fragt nebenbei regelmäßig p=events ab (beobachtet 25.10.2026),
        // genommen wird nur eine Antwort, deren Text "Scoutbericht" enthält
        const kandidaten: Promise<{ url: string; roh: string } | null>[] = [];
        const mit = (r: import("playwright").Response) => {
          if (!["xhr", "fetch"].includes(r.request().resourceType()) || /[?&]p=events\b/.test(r.url())) return;
          kandidaten.push(r.text().then((roh) => ({ url: r.url(), roh })).catch(() => null));
        };
        page.on("response", mit);
        await link.click();
        let treffer: { url: string; roh: string } | null = null;
        const bis = Date.now() + WARTEN_MS;
        while (!treffer && Date.now() < bis) {
          await page.waitForTimeout(500);
          for (const k of await Promise.all(kandidaten)) if (k && scoutTextAus(k.roh).includes("Scoutbericht")) treffer = k;
        }
        page.off("response", mit);
        if (!treffer) throw new Error("keine Antwort mit Scoutbericht");
        antworten.push({ pid: sp.pid, url: treffer.url, roh: treffer.roh, text: scoutTextAus(treffer.roh) });
        await page.keyboard.press("Escape").catch(() => {});
      } catch (e) {
        fehler.push(`${sp.name}: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`);
      }
      await page.waitForTimeout(PAUSE_MS);
    }
    return { antworten, fehler };
  };
}

export function speichereScoutTexte(db: Database.Database, antworten: ScoutAntwort[], stand: string, quelle: string) {
  if (!antworten.length) return 0;
  // Erste Antwort roh sichern, damit der Aufbau geprüft werden kann
  speichereRohseite(db, { art: "scoutbericht", url: antworten[0].url, status: null, htmlRoh: antworten[0].roh, htmlDom: null }, stand);
  const nachPid = new Map(antworten.map((a) => [a.pid, a]));
  aktualisiereSpieler(
    db,
    (alt) => {
      const a = nachPid.get(alt.pid);
      if (!a || !a.text) return alt;
      return { ...alt, scoutText: a.text, scoutTextStand: stand, scoutTextSterne: sterneText(alt.scoutSterne) };
    },
    quelle,
    stand,
  );
  return antworten.filter((a) => a.text).length;
}
