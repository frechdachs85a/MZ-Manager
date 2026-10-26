import "server-only";
import type Database from "better-sqlite3";
import type { Page } from "playwright";
import { abrufBeenden, abrufBeginnen, letzterAbruf, speichereRohseite } from "@/lib/db/abruf";
import { spieltagLage } from "@/lib/spieltag";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import { TAKTIK_PFAD, meldungAus, type Ergebnis } from "./kader";
import { mitMzSitzung, MzFehler } from "./sitzung";

// Formation "Liga" in ManagerZone hinterlegen (Auftrag Marcus, 26.10.2026): nach jeder Spieltag-Analyse die berechnete
// Aufstellung gegen den nächsten Gegner in den Editor-Reiter mit dem Namen "Liga" schreiben. Welcher Reiter im Spiel
// gilt, stellt Marcus selbst ein. Weg wie von Hand im Editor (tactics.js, gelesen 26.10.2026):
// Reiter anklicken (changeTacticTab), XML in #importExportData, "Importieren" (teamTactic.editor.importTactic),
// "Speicher aktuellen Tab" (#savecurrentb, save_all=0 -> ajax.php?p=tactics&sub=save, Antwort "true").
// Danach Seite neu laden und die gespeicherte Belegung des Reiters mit der XML vergleichen.
export const REITER_NAME = "Liga";

type Soll = { feld: number[]; torwart: number; bank: number[]; tactics?: string; playstyle?: string; aggression?: string };

function sollAus(xml: string): Soll {
  const t = parseTaktikXml(xml);
  return {
    feld: t.pos.filter((p) => p.pos === "normal").map((p) => p.pid).sort(),
    torwart: t.pos.find((p) => p.pos === "goalie")?.pid ?? 0,
    bank: t.subs.map((s) => s.pid).sort(),
    tactics: t.team.tactics,
    playstyle: t.team.playstyle,
    aggression: t.team.aggression,
  };
}

// Buchstabe des Reiters, dessen Name genau "Liga" ist (ohne Groß/Klein), sonst null
const reiterSuchen = (page: Page, name: string) =>
  page.evaluate((n) => {
    for (const el of document.querySelectorAll('[id^="tactic"][id$="Tab"]')) {
      const m = el.id.match(/^tactic([A-Z])Tab$/);
      if (m && (el.textContent ?? "").trim().toLowerCase() === n.toLowerCase()) return m[1].toLowerCase();
    }
    return null;
  }, name);

type Ist = { slot: string; feld: number[]; torwart: number; bank: number[]; tactics?: string; playstyle?: string; aggression?: string } | { fehler: string };

// Gespeicherte (tacticsData) oder lokale (tacticsDataLocal) Belegung eines Reiters
const belegung = (page: Page, slot: string, quelle: "tacticsData" | "tacticsDataLocal") =>
  page.evaluate(
    ([s, q]) => {
      const w = window as unknown as { teamTactic?: Record<string, unknown> };
      const tt = w.teamTactic as { tacticsIndexedArr: Record<string, number> } & Record<string, { Tactic: { TacticPlayer?: { "@attributes": Record<string, string> }[]; "@attributes": Record<string, string> }[] }>;
      if (!tt) return { fehler: "teamTactic fehlt auf der Seite." };
      const t = tt[q]?.Tactic?.[tt.tacticsIndexedArr[s]];
      if (!t) return { fehler: `Reiter ${s} nicht in ${q}.` };
      const sp = (t.TacticPlayer ?? []).map((p) => p["@attributes"]);
      const a = t["@attributes"];
      return {
        slot: s,
        feld: sp.filter((p) => p.pos === "on field").map((p) => Number(p.playerId)).sort(),
        torwart: Number(sp.find((p) => p.pos === "gk")?.playerId ?? 0),
        bank: sp.filter((p) => String(p.pos).startsWith("subst")).map((p) => Number(p.playerId)).sort(),
        tactics: a?.tactics,
        playstyle: a?.playstyle,
        aggression: a?.aggression,
      };
    },
    [slot, quelle] as const,
  ) as Promise<Ist>;

function abweichung(soll: Soll, ist: Ist): string | null {
  if ("fehler" in ist) return ist.fehler;
  const fehlt: string[] = [];
  if (ist.feld.join() !== soll.feld.join()) fehlt.push(`Feldspieler ${ist.feld.length} statt ${soll.feld.length} wie berechnet`);
  if (ist.torwart !== soll.torwart) fehlt.push("Torwart anders");
  if (ist.bank.join() !== soll.bank.join()) fehlt.push(`Bank ${ist.bank.length} statt ${soll.bank.length} wie berechnet`);
  for (const k of ["tactics", "playstyle", "aggression"] as const) if (soll[k] && ist[k] !== soll[k]) fehlt.push(`${k} ${ist[k]} statt ${soll[k]}`);
  return fehlt.length ? fehlt.join(", ") : null;
}

export async function ligaHinterlegen(db: Database.Database, opt = { manuell: false }): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "liga");
  try {
    const lage = spieltagLage(db);
    const liga = lage.liga;
    if (!liga) throw new MzFehler("Keine Formation Liga berechnet (kein Vorschlag oder zu wenige aufstellbare Spieler).");
    const soll = sollAus(liga.xml);
    const gegner = lage.lauf?.gegnerName ?? "nächster Gegner";
    speichereRohseite(db, { art: "liga-xml", url: `liga:${gegner}`, status: null, htmlRoh: liga.xml, htmlDom: null });

    const meldung = await mitMzSitzung(
      db,
      async (s) => {
        // 1. Reiter wählen, importieren, aktuellen Reiter speichern
        const seite = await s.holeSeite(TAKTIK_PFAD, {
          warteAuf: 'dd[id^="n_"]',
          aufSeite: async (page) => {
            const slot = await reiterSuchen(page, REITER_NAME);
            if (!slot) return { fehler: `Kein Reiter mit dem Namen „${REITER_NAME}“ im Editor: nichts geändert.` };
            await page.evaluate((x) => (document.querySelector(`#tacticTab_${x} a`) as HTMLElement | null)?.click(), slot);
            await page.waitForTimeout(1500);
            const aktiv = await page.evaluate(() => (document.querySelector("#current_tab") as HTMLInputElement | null)?.value);
            if (aktiv !== slot) return { fehler: `Reiter ${slot} ließ sich nicht wählen (aktiv: ${aktiv ?? "?"}): nichts geändert.` };
            await page.evaluate((xml) => {
              (document.querySelector("#importExportData") as HTMLTextAreaElement).value = xml;
              (document.querySelector("#import_button") as HTMLElement).click();
            }, liga.xml);
            await page.waitForTimeout(2000);
            // Import prüfen, bevor gespeichert wird (unbekannte pid bricht den Import still ab)
            const lokal = await belegung(page, slot, "tacticsDataLocal");
            const vorher = abweichung(soll, lokal);
            if (vorher) return { fehler: `Import unvollständig (${vorher}): nicht gespeichert.` };
            const antwort = page.waitForResponse((r) => r.url().includes("p=tactics") && r.url().includes("sub=save"), { timeout: 30_000 });
            await page.evaluate(() => (document.querySelector("#savecurrentb") as HTMLElement).click());
            const r = await antwort;
            return { slot, antwort: (await r.text()).slice(0, 300) };
          },
        });
        const x = seite.extra as { fehler: string } | { slot: string; antwort: string } | undefined;
        if (!x) throw new MzFehler("Taktikseite nicht eingeloggt geladen.");
        if ("fehler" in x) throw new MzFehler(x.fehler);
        // Antwort ist JSON; der Editor prüft data == "true" (gesehen 26.10.2026: ["true"], in JavaScript gleich "true")
        if (!/^\[?\s*"?true"?\s*\]?$/.test(x.antwort.trim())) throw new MzFehler(`ManagerZone hat das Speichern nicht bestätigt: ${x.antwort}`);

        // 2. Neu laden und vergleichen
        const neu = await s.holeSeite(TAKTIK_PFAD, { warteAuf: 'dd[id^="n_"]', aufSeite: (page) => belegung(page, x.slot, "tacticsData") });
        const ab = abweichung(soll, neu.extra as Ist);
        if (ab) throw new MzFehler(`Gespeichert, aber beim Neuladen anders: ${ab}.`);
        return `Formation Liga gegen ${gegner} gespeichert (${liga.reiter}, Reiter ${x.slot.toUpperCase()}) und nach Neuladen geprüft.`;
      },
      opt,
    );
    abrufBeenden(db, log, true, meldung);
    return { ok: true, meldung };
  } catch (e) {
    const meldung = `Formation Liga: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}

export const letzteLigaMeldung = (db: Database.Database) => letzterAbruf(db, "liga");
