import "server-only";
import type Database from "better-sqlite3";
import type { Page } from "playwright";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { ladeAuftraege, protokolliere, setzeBietomatLaeuft, setzeStatus, type GebotAuftrag } from "@/lib/db/gebot";
import { parseTransferSuche } from "@/lib/mz/parser/transfer";
import { TEAM } from "@/lib/wissen/startbasis";
import { endeUtc } from "./bietomat";
import { gebotErlaubt, HEISS_MS, naechsterSchritt, type Zustand } from "./bietomat-regeln";
import { meldungAus } from "./kader";
import { MARKT_PFAD, suchParameter } from "./markt";
import { mitFiltern } from "./markt-ziel";
import { mitMzSitzung, type MzSitzung } from "./sitzung";

// Bietomat, Stufe 2: bietet automatisch nach den Regeln in bietomat-regeln.ts, auf demselben Weg wie von Hand
// (Gebotsfenster und transfer.js gelesen 26.10.2026): Marktseite öffnen, buy(pid) öffnet das Gebotsfenster,
// ManagerZone füllt das kleinste zulässige Gebot in der Währung des Verkäufers vor, "Gebot" klicken, die
// Rückfrage "Bist Du sicher??" bestätigen. Vor jedem Klick: Umrechnung in Euro (Kurs aus dem Fenster) und harte
// Grenze Endpreis.

const LAUF_START_MS = HEISS_MS + 60_000; // Sitzung eine Minute vor der heißen Phase öffnen
const MAX_LAUF_MS = 2 * 3600_000; // Sicherung gegen Endlosschleifen
let laeuft = false;

const schlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function zustandLesen(s: MzSitzung, params: string, pid: number): Promise<Zustand & { rohEnde?: string }> {
  const a = await s.holeText(`/ajax.php?p=transfer&sub=transfer-search&sport=soccer${mitFiltern(params, { u: pid })}&o=0`);
  const sp = parseTransferSuche(a.text).spieler.find((x) => x.pid === pid);
  if (!sp) return { gefunden: false };
  const e = endeUtc(sp.markt.ende);
  return { gefunden: true, endeMs: e ? new Date(e).getTime() : undefined, bieterTid: sp.markt.bieterTid, hoechstgebotEur: sp.markt.hoechstgebot, rohEnde: sp.markt.ende };
}

type GebotErgebnis = { geboten: true; betrag: number; eur: number; antwort: string } | { geboten: false; grund: string; stop: boolean };

// Im Browser auf der Marktseite: Gebotsfenster öffnen, vorausgefülltes Mindestgebot lesen, prüfen, bieten
function gebotImBrowser(pid: number, maximumEur: number) {
  return async (page: Page): Promise<GebotErgebnis> => {
    await page.evaluate((p) => (window as unknown as { buy: (x: number) => void }).buy(p), pid);
    await page.waitForSelector("#buyform_bid_player_currency", { timeout: 20_000 });
    const info = await page.evaluate(() => {
      const feld = document.querySelector("#buyform_bid_player_currency") as HTMLInputElement;
      // onkeyup="updateExchange('EUR', <Verkäuferwährung>, <deine Währung>, …)"
      const m = (feld.getAttribute("onkeyup") ?? "").match(/updateExchange\('[^']*',\s*(\d+)\s*,\s*(\d+)/);
      const von = m ? Number(m[1]) : NaN;
      const nach = m ? Number(m[2]) : NaN;
      const kurse = (window as unknown as { exchange_rates?: number[][] }).exchange_rates ?? [];
      const kurs = von === nach ? 1 : kurse.find((k) => k[0] === von && k[1] === nach)?.[2];
      return { betrag: parseInt(feld.value.replace(/\D/g, ""), 10), kurs, von, nach, fehler: document.querySelector(".transfer_bid_error_container")?.textContent?.trim() ?? "" };
    });
    if (info.fehler) return { geboten: false, grund: `ManagerZone meldet: ${info.fehler}`, stop: true };
    const ok = gebotErlaubt(info.betrag, info.kurs, maximumEur);
    if (!ok.ok) return { geboten: false, grund: ok.grund, stop: true };
    // Nur den vorausgefüllten Betrag bieten (eine Stufe). Warnhinweis "deutlich höher" verlangt das Häkchen.
    page.once("dialog", (d) => void d.accept());
    const antwort = page.waitForResponse((r) => /[?&]sub=bid(&|$)/.test(r.url()), { timeout: 30_000 });
    await page.evaluate(() => {
      const warnung = document.querySelector("#transferBidWarning");
      if (warnung && !warnung.hasAttribute("hidden")) (document.querySelector("#transferBidConfirm") as HTMLInputElement | null)?.click();
      (document.querySelector("#transfer_place_bid_button") as HTMLElement).click();
    });
    const r = await antwort;
    return { geboten: true, betrag: info.betrag, eur: ok.eur, antwort: (await r.text()).slice(0, 500) };
  };
}

export async function auftragAbarbeiten(db: Database.Database, a: GebotAuftrag): Promise<string> {
  const log = abrufBeginnen(db, "bietomat");
  setzeBietomatLaeuft(true);
  try {
    const text = await mitMzSitzung(
      db,
      async (s) => {
        const markt = await s.holeSeite(MARKT_PFAD);
        const params = suchParameter(markt.htmlDom ?? markt.htmlRoh ?? "");
        const start = Date.now();
        let letztesEndeMs = a.auktionEnde ? new Date(a.auktionEnde).getTime() : undefined;
        let letzterBieter: number | undefined;
        let gebote = 0;
        while (Date.now() - start < MAX_LAUF_MS) {
          const z = await zustandLesen(s, params, a.pid);
          if (z.endeMs && z.endeMs !== letztesEndeMs) {
            if (letztesEndeMs && z.endeMs > letztesEndeMs) protokolliere(db, a.pid, `Auktion verlängert bis ${z.rohEnde}.`);
            letztesEndeMs = z.endeMs;
            db.prepare("UPDATE gebot_auftrag SET auktion_ende = ? WHERE pid = ?").run(new Date(z.endeMs).toISOString(), a.pid);
          }
          if (z.gefunden) letzterBieter = z.bieterTid;
          const schritt = naechsterSchritt(z, { eigeneTid: TEAM.tid, bietenBisMs: a.bietenBis ? new Date(a.bietenBis).getTime() : undefined, letztesEndeMs, letzterBieter }, Date.now());
          if (schritt.art === "fertig") {
            setzeStatus(db, a.pid, schritt.status);
            protokolliere(db, a.pid, `${schritt.text} ${gebote} Gebot(e) abgegeben.`);
            return schritt.text;
          }
          if (schritt.art === "warten") {
            await schlafen(schritt.ms);
            continue;
          }
          const seite = await s.holeSeite(MARKT_PFAD, { aufSeite: gebotImBrowser(a.pid, a.maximum) });
          const g = seite.extra as GebotErgebnis | undefined;
          if (!g) throw new Error("Marktseite nicht eingeloggt geladen.");
          if (!g.geboten) {
            protokolliere(db, a.pid, g.grund);
            if (g.stop) {
              setzeStatus(db, a.pid, "beendet");
              return g.grund;
            }
            continue;
          }
          gebote++;
          if (gebote > 60) {
            setzeStatus(db, a.pid, "abgebrochen");
            protokolliere(db, a.pid, "Abgebrochen: mehr als 60 Gebote, bitte selbst prüfen.");
            return "Abgebrochen nach 60 Geboten.";
          }
          speichereRohseite(db, { art: "gebot-antwort", url: `gebot:${a.pid}`, status: null, htmlRoh: g.antwort, htmlDom: null });
          protokolliere(db, a.pid, `Geboten: ${g.betrag} (Verkäuferwährung) = ${g.eur} EUR. Antwort: ${g.antwort.slice(0, 120)}`, g.eur);
          await schlafen(5_000);
        }
        setzeStatus(db, a.pid, "abgebrochen");
        protokolliere(db, a.pid, "Abgebrochen: Bietomat lief länger als 2 Stunden.");
        return "Abgebrochen nach 2 Stunden.";
      },
      { manuell: true, vorrang: true },
    );
    abrufBeenden(db, log, true, `Bietomat ${a.name ?? a.pid}: ${text}`);
    return text;
  } catch (e) {
    const m = `Bietomat ${a.name ?? a.pid}: ${meldungAus(e)}`;
    protokolliere(db, a.pid, m);
    abrufBeenden(db, log, false, m);
    return m;
  } finally {
    setzeBietomatLaeuft(false);
  }
}

// Alle 20 Sekunden aus dem Zeitplan: den nächsten aktiven Auftrag abarbeiten, sobald seine Auktion nah ist.
// Immer nur einer gleichzeitig (eine ManagerZone-Sitzung); weitere warten.
export async function bietomatTakt(db: Database.Database, jetzt = Date.now()) {
  if (laeuft) return;
  const faellig = ladeAuftraege(db).find((a) => a.status === "aktiv" && a.auktionEnde && new Date(a.auktionEnde).getTime() - jetzt <= LAUF_START_MS);
  if (!faellig) return;
  laeuft = true;
  try {
    await auftragAbarbeiten(db, faellig);
  } finally {
    laeuft = false;
  }
}
