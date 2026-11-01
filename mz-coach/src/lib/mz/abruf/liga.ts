import "server-only";
import type Database from "better-sqlite3";
import type { Page } from "playwright";
import { abrufBeenden, abrufBeginnen, ladeRohseite, letzteRohseite, letzterAbruf, speichereRohseite } from "@/lib/db/abruf";
import { spieltagLage } from "@/lib/spieltag";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import { TAKTIK_PFAD, meldungAus, type Ergebnis } from "./kader";
import { mitMzSitzung, MzFehler, type MzSitzung } from "./sitzung";
import { ladeTaktiken, loescheTaktik, speichereFortschritt, speichereTaktikXml } from "@/lib/db/taktik";
import { reiterAusEditor, reiterSpeichern, type GelesenerReiter } from "./editor-reiter";
import { ligaspieltag } from "@/lib/db/spieltag";

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
    feld: t.pos
      .filter((p) => p.pos === "normal")
      .map((p) => p.pid)
      .sort(),
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

type Ist =
  | { slot: string; feld: number[]; torwart: number; bank: number[]; tactics?: string; playstyle?: string; aggression?: string; alter?: string }
  | { fehler: string };

// Belegung eines Reiters im Editor (tacticsDataLocal; direkt nach dem Laden = gespeicherter Stand. tacticsData enthält
// die Reiter nicht unter demselben Index, gesehen 26.10.2026)
const belegung = (page: Page, slot: string, quelle: "tacticsData" | "tacticsDataLocal") =>
  page.evaluate(
    ([s, q]) => {
      const w = window as unknown as { teamTactic?: Record<string, unknown> };
      const tt = w.teamTactic as { tacticsIndexedArr: Record<string, number> } & Record<
        string,
        { Tactic: { TacticPlayer?: { "@attributes": Record<string, string> }[]; "@attributes": Record<string, string> }[] }
      >;
      if (!tt) return { fehler: "teamTactic fehlt auf der Seite." };
      const t = tt[q]?.Tactic?.[tt.tacticsIndexedArr[s]];
      if (!t) return { fehler: `Reiter ${s} nicht in ${q}.` };
      const sp = (t.TacticPlayer ?? []).map((p) => p["@attributes"]);
      const a = t["@attributes"];
      return {
        slot: s,
        feld: sp
          .filter((p) => p.pos === "on field")
          .map((p) => Number(p.playerId))
          .sort(),
        torwart: Number(sp.find((p) => p.pos === "gk")?.playerId ?? 0),
        bank: sp
          .filter((p) => String(p.pos).startsWith("subst"))
          .map((p) => Number(p.playerId))
          .sort(),
        tactics: a?.tactics,
        playstyle: a?.playstyle,
        aggression: a?.aggression,
        alter: `${a?.age_from ?? ""}-${a?.age_to ?? ""}`, // Altersregler (age_from/age_to)
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

// Formation Liga in den Editor-Reiter „Liga“ schreiben und prüfen
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
        const slot = await inEditorSchreiben(s, REITER_NAME, liga.xml, soll);
        return `Formation Liga gegen ${gegner} gespeichert (${liga.reiter}, Reiter ${slot.toUpperCase()}) und nach Neuladen geprüft.`;
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

// Liga-Kontrolle (Marcus, 31.10.2026): bis zum Ligaspiel regelmäßig prüfen, ob die hinterlegte Formation noch die beste
// ist (Verletzung, Sperre, Trainingslager, Skills, neue Gegnerdaten). Neu berechnen; nur wenn sich die XML gegenüber der
// zuletzt geschriebenen ändert oder das letzte Schreiben fehlschlug, in ManagerZone schreiben. Protokoll "liga-kontrolle".
export async function ligaKontrolle(db: Database.Database): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "liga-kontrolle");
  const lage = spieltagLage(db);
  const neu = lage.liga?.xml;
  const zuletzt = letzteRohseite(db, "liga-xml");
  const alt = zuletzt ? ladeRohseite(db, zuletzt.id, "roh")?.html : undefined;
  const letzterOk = letzterAbruf(db, "liga")?.ok === 1;
  const gegner = lage.lauf?.gegnerName ?? "nächster Gegner";
  if (neu && alt && neu.trim() === alt.trim() && letzterOk && zuletzt?.url === `liga:${gegner}`) {
    const meldung = `Liga gegen ${gegner} geprüft: weiterhin die beste Aufstellung, nichts geändert.`;
    abrufBeenden(db, log, true, meldung);
    return { ok: true, meldung };
  }
  const r = await ligaHinterlegen(db);
  const meldung = `Liga gegen ${gegner} geprüft: ${neu && alt ? "Änderung gefunden, neu geschrieben" : "neu geschrieben"}. ${r.meldung}`;
  abrufBeenden(db, log, r.ok, meldung);
  return { ok: r.ok, meldung };
}

// Eine XML in den Editor-Reiter mit dem Namen `reiterName` schreiben, wie von Hand: Reiter wählen, importieren, Import
// prüfen, "Speicher aktuellen Tab", dann neu laden und vergleichen. Wirft MzFehler, wenn etwas nicht passt. Gibt den
// Buchstaben des Reiters zurück.
async function inEditorSchreiben(s: MzSitzung, reiterName: string, xml: string, soll: Soll, melde: Melde = () => {}): Promise<string> {
  const seite = await s.holeSeite(TAKTIK_PFAD, {
    warteAuf: 'dd[id^="n_"]',
    aufSeite: async (page) => {
      const slot = await reiterSuchen(page, reiterName);
      if (!slot) return { fehler: `Kein Reiter mit dem Namen „${reiterName}“ im Editor: nichts geändert.` };
      await page.evaluate((x) => (document.querySelector(`#tacticTab_${x} a`) as HTMLElement | null)?.click(), slot);
      await page.waitForTimeout(1500);
      const aktiv = await page.evaluate(() => (document.querySelector("#current_tab") as HTMLInputElement | null)?.value);
      if (aktiv !== slot) return { fehler: `Reiter ${slot} ließ sich nicht wählen (aktiv: ${aktiv ?? "?"}): nichts geändert.` };
      // Altersregler merken: muss nach dem Speichern gleich sein (U18 bleibt U18, Marcus 31.10.2026)
      const vorher0 = await belegung(page, slot, "tacticsDataLocal");
      const alter = "fehler" in vorher0 ? undefined : vorher0.alter;
      await page.evaluate((x) => {
        (document.querySelector("#importExportData") as HTMLTextAreaElement).value = x;
        (document.querySelector("#import_button") as HTMLElement).click();
      }, xml);
      await page.waitForTimeout(2000);
      // Import prüfen, bevor gespeichert wird (unbekannte pid bricht den Import still ab)
      const lokal = await belegung(page, slot, "tacticsDataLocal");
      const vorher = abweichung(soll, lokal);
      if (vorher) return { fehler: `Import unvollständig (${vorher}): nicht gespeichert.` };
      melde(`${reiterName}: Import geprüft, speichern`);
      const antwort = page.waitForResponse((r) => r.url().includes("p=tactics") && r.url().includes("sub=save"), { timeout: 30_000 });
      await page.evaluate(() => (document.querySelector("#savecurrentb") as HTMLElement).click());
      const r = await antwort;
      return { slot, antwort: (await r.text()).slice(0, 300), alter };
    },
  });
  const x = seite.extra as { fehler: string } | { slot: string; antwort: string; alter?: string } | undefined;
  if (!x) throw new MzFehler("Taktikseite nicht eingeloggt geladen.");
  if ("fehler" in x) throw new MzFehler(x.fehler);
  // Antwort ist JSON; der Editor prüft data == "true" (gesehen 26.10.2026: ["true"], in JavaScript gleich "true")
  if (!/^\[?\s*"?true"?\s*\]?$/.test(x.antwort.trim())) throw new MzFehler(`ManagerZone hat das Speichern nicht bestätigt: ${x.antwort}`);
  melde(`${reiterName}: neu laden und prüfen`);
  const neu = await s.holeSeite(TAKTIK_PFAD, { warteAuf: 'dd[id^="n_"]', aufSeite: (page) => belegung(page, x.slot, "tacticsDataLocal") });
  const ist = neu.extra as Ist;
  const ab = abweichung(soll, ist);
  if (ab) throw new MzFehler(`Gespeichert, aber beim Neuladen anders: ${ab}.`);
  if (x.alter && !("fehler" in ist) && ist.alter !== x.alter)
    throw new MzFehler(`Gespeichert, aber der Altersregler hat sich geändert (vorher ${x.alter}, jetzt ${ist.alter}). Bitte im Editor prüfen.`);
  return x.slot;
}

// Reiter im Editor umbenennen, wie von Hand (tactics.js, renameTactic, gelesen 31.10.2026): Reiter anklicken,
// "Umbenennen" (#rename_tactics_button), Name ins Feld #tactic_name (maxlength 6), "Speichern"
// (#save_rename_tactics_button, POST ajax.php?p=tactics&sub=rename mit tactic_name und key). Ohne Clubmitgliedschaft
// lässt der Editor nur Reiter A umbenennen. Danach neu laden und prüfen, dass der Reiter den neuen Namen trägt.
// neu = "" setzt den Namen zurück: der Editor zeigt dann den Buchstaben des Reiters (tactics.js, renameTactic success).
async function reiterUmbenennen(s: MzSitzung, alt: string, neu: string, melde: Melde = () => {}): Promise<string> {
  if (neu.length > 6) throw new MzFehler(`Name „${neu}“ ungültig (höchstens 6 Zeichen).`);
  const seite = await s.holeSeite(TAKTIK_PFAD, {
    warteAuf: 'dd[id^="n_"]',
    aufSeite: async (page) => {
      const slot = await reiterSuchen(page, alt);
      if (!slot) return { fehler: `Kein Reiter „${alt}“ im Editor: nicht umbenannt.` };
      if (neu && alt.toLowerCase() !== neu.toLowerCase() && (await reiterSuchen(page, neu)))
        return { fehler: `Name „${neu}“ ist schon vergeben: nicht umbenannt.` };
      await page.evaluate((x) => (document.querySelector(`#tacticTab_${x} a`) as HTMLElement | null)?.click(), slot);
      await page.waitForTimeout(1500);
      const aktiv = await page.evaluate(() => (document.querySelector("#current_tab") as HTMLInputElement | null)?.value);
      if (aktiv !== slot) return { fehler: `Reiter ${slot} ließ sich nicht wählen (aktiv: ${aktiv ?? "?"}): nicht umbenannt.` };
      const club = await page.evaluate(() => (window as unknown as { clubMember?: number | string }).clubMember);
      if (Number(club) === 0 && slot !== "a") return { fehler: "Ohne Clubmitgliedschaft lässt ManagerZone nur Reiter A umbenennen." };
      await page.evaluate(() => (document.querySelector("#rename_tactics_button") as HTMLElement | null)?.click());
      const feld = await page.waitForSelector("#tactic_name", { timeout: 10_000 }).catch(() => null);
      if (!feld) return { fehler: "Namensfeld erschien nicht: nicht umbenannt." };
      await feld.fill(neu);
      const antwort = page.waitForResponse((r) => r.url().includes("p=tactics") && r.url().includes("sub=rename"), { timeout: 30_000 });
      await page.evaluate(() => (document.querySelector("#save_rename_tactics_button") as HTMLElement | null)?.click());
      const r = await antwort;
      return { slot, antwort: (await r.text()).slice(0, 300) };
    },
  });
  const x = seite.extra as { fehler: string } | { slot: string; antwort: string } | undefined;
  if (!x) throw new MzFehler("Taktikseite nicht eingeloggt geladen.");
  if ("fehler" in x) throw new MzFehler(x.fehler);
  melde(`Name „${neu || x.slot.toUpperCase()}“: neu laden und prüfen`);
  const neuGeladen = await s.holeSeite(TAKTIK_PFAD, { warteAuf: 'dd[id^="n_"]', aufSeite: (page) => reiterSuchen(page, neu || x.slot.toUpperCase()) });
  if (neuGeladen.extra !== x.slot) throw new MzFehler(`Umbenennen nicht bestätigt (Antwort: ${x.antwort}).`);
  return x.slot;
}

// Reiter löschen wie von Hand (Marcus, 31.10.2026): Reiter wählen, „Alles zurücksetzen“ (#clearb, clearAll(): Feld und
// Regeln leeren), „Speicher aktuellen Tab“, dann den Namen entfernen (leerer Name = Buchstabe). Nach dem Neuladen geprüft:
// keine Spieler mehr im Reiter, Name = Buchstabe. Reiter A darf laut Editor nicht leer sein (allowEmpty false).
async function reiterLeeren(s: MzSitzung, reiter: string, melde: Melde = () => {}): Promise<string> {
  const seite = await s.holeSeite(TAKTIK_PFAD, {
    warteAuf: 'dd[id^="n_"]',
    aufSeite: async (page) => {
      const slot = await reiterSuchen(page, reiter);
      if (!slot) return { fehler: `Kein Reiter „${reiter}“ im Editor: nichts gelöscht.` };
      if (slot === "a") return { fehler: "Reiter A darf in ManagerZone nicht leer sein: nichts gelöscht." };
      await page.evaluate((x) => (document.querySelector(`#tacticTab_${x} a`) as HTMLElement | null)?.click(), slot);
      await page.waitForTimeout(1500);
      const aktiv = await page.evaluate(() => (document.querySelector("#current_tab") as HTMLInputElement | null)?.value);
      if (aktiv !== slot) return { fehler: `Reiter ${slot} ließ sich nicht wählen (aktiv: ${aktiv ?? "?"}): nichts gelöscht.` };
      await page.evaluate(() => (document.querySelector("#clearb") as HTMLElement | null)?.click());
      await page.waitForTimeout(2000);
      const rest = await page.evaluate((x) => {
        const w = window as unknown as {
          teamTactic?: { tacticsIndexedArr: Record<string, number>; tacticsDataLocal: { Tactic: { TacticPlayer?: unknown[] }[] } };
        };
        const t = w.teamTactic?.tacticsDataLocal?.Tactic?.[w.teamTactic.tacticsIndexedArr[x]];
        return Array.isArray(t?.TacticPlayer) ? t!.TacticPlayer!.length : 0;
      }, slot);
      if (rest > 0) return { fehler: `Nach „Alles zurücksetzen“ noch ${rest} Spieler im Reiter: nicht gespeichert.` };
      melde(`${reiter}: zurückgesetzt, speichern`);
      const antwort = page.waitForResponse((r) => r.url().includes("p=tactics") && r.url().includes("sub=save"), { timeout: 30_000 });
      await page.evaluate(() => (document.querySelector("#savecurrentb") as HTMLElement).click());
      const r = await antwort;
      return { slot, antwort: (await r.text()).slice(0, 300) };
    },
  });
  const x = seite.extra as { fehler: string } | { slot: string; antwort: string } | undefined;
  if (!x) throw new MzFehler("Taktikseite nicht eingeloggt geladen.");
  if ("fehler" in x) throw new MzFehler(x.fehler);
  melde(`${reiter}: neu laden und prüfen`);
  const neu = await s.holeSeite(TAKTIK_PFAD, {
    warteAuf: 'dd[id^="n_"]',
    aufSeite: (page) =>
      page.evaluate((sl) => {
        const w = window as unknown as {
          teamTactic?: { tacticsIndexedArr: Record<string, number>; tacticsDataLocal: { Tactic: { TacticPlayer?: unknown[] }[] } };
        };
        const t = w.teamTactic?.tacticsDataLocal?.Tactic?.[w.teamTactic.tacticsIndexedArr[sl]];
        return Array.isArray(t?.TacticPlayer) ? t!.TacticPlayer!.length : 0;
      }, x.slot),
  });
  if (neu.extra !== 0) throw new MzFehler(`Leeren nicht bestätigt: nach dem Neuladen ${String(neu.extra)} Spieler im Reiter (Antwort: ${x.antwort}).`);
  return x.slot;
}

type Melde = (text: string) => void;

// Gemeinsamer Ablauf jeder Editor-Aktion auf Klick (Marcus, 31.10.2026: Fortschritt sehen, danach stimmt die Seite):
// Fortschritt in der Datenbank (die Taktikseite fragt ihn ab), Anmelden, die eigentliche Änderung, danach alle Reiter neu aus
// dem Editor lesen (editor-reiter.ts), damit Namen, Archiv und Vorschläge den neuen Stand zeigen.
async function editorAktion(db: Database.Database, aufgabe: string, schritte: number, lauf: (s: MzSitzung, melde: Melde) => Promise<string>, fehlerText: string): Promise<Ergebnis> {
  const log = abrufBeginnen(db, "taktik-check");
  const von = schritte + 2;
  const beginn = new Date().toISOString();
  let schritt = 0;
  const melde: Melde = (text) => speichereFortschritt(db, { aufgabe, schritt: Math.min(++schritt, von - 1), von, text, beginn, fertig: false });
  melde("Bei ManagerZone anmelden (wartet, falls gerade ein anderer Abruf läuft)");
  try {
    const meldung = await mitMzSitzung(
      db,
      async (s) => {
        const m = await lauf(s, melde);
        melde("Alle Reiter neu aus dem Editor lesen");
        const seite = await s.holeSeite(TAKTIK_PFAD, { warteAuf: 'dd[id^="n_"]', aufSeite: reiterAusEditor });
        if (Array.isArray(seite.extra)) reiterSpeichern(db, seite.extra as GelesenerReiter[]);
        return m;
      },
      { manuell: true },
    );
    abrufBeenden(db, log, true, meldung);
    speichereFortschritt(db, { aufgabe, schritt: von, von, text: meldung, beginn, fertig: true, ok: true });
    return { ok: true, meldung };
  } catch (e) {
    const meldung = `${fehlerText}: ${meldungAus(e)}`;
    abrufBeenden(db, log, false, meldung);
    speichereFortschritt(db, { aufgabe, schritt, von, text: meldung, beginn, fertig: true, ok: false });
    return { ok: false, meldung };
  }
}

// Reiter löschen (nur auf Klick): XML vorher als Sicherung speichern, leeren, Namen entfernen
export async function reiterLoeschen(db: Database.Database, reiter: string): Promise<Ergebnis> {
  if (/^liga$/i.test(reiter)) return { ok: false, meldung: "Den Reiter „Liga“ braucht die Seite." };
  const sicherung = ladeTaktiken(db).find((t) => t.reiter === reiter);
  if (sicherung) speichereRohseite(db, { art: "taktik-geloescht", url: `reiter:${reiter}`, status: null, htmlRoh: sicherung.xml, htmlDom: null });
  return editorAktion(
    db,
    `${reiter} löschen`,
    5,
    async (s, melde) => {
      melde(`${reiter}: Alles zurücksetzen`);
      const slot = await reiterLeeren(s, reiter, melde);
      melde(`${reiter}: Namen entfernen`);
      await reiterUmbenennen(s, reiter, "", melde);
      loescheTaktik(db, reiter);
      return `Reiter ${slot.toUpperCase()} („${reiter}“) geleert und Name entfernt (nach Neuladen geprüft). Die XML ist als Sicherung gespeichert.`;
    },
    `Löschen ${reiter}`,
  );
}

// Archiv-Eintrag unter dem neuen Namen führen
function archivUmbenennen(db: Database.Database, alt: string, neu: string, xml?: string) {
  const t = ladeTaktiken(db).find((x) => x.reiter === alt);
  const inhalt = xml ?? t?.xml;
  if (!inhalt) return;
  speichereTaktikXml(db, neu, inhalt, `${t?.quelle ?? "Archiv"}; umbenannt von ${alt} ${new Date().toISOString()}`);
  if (alt !== neu) loescheTaktik(db, alt);
}

// Umbenennen als Editor-Aktion
const umbenennenAktion = (db: Database.Database, alt: string, neu: string) =>
  editorAktion(
    db,
    `${alt} in „${neu}“ umbenennen`,
    2,
    async (s, melde) => {
      melde(`${alt}: umbenennen in „${neu}“`);
      const slot = await reiterUmbenennen(s, alt, neu, melde);
      archivUmbenennen(db, alt, neu);
      return `Reiter ${slot.toUpperCase()} heißt jetzt „${neu}“ statt „${alt}“ (nach Neuladen geprüft).`;
    },
    `Umbenennen ${alt}`,
  );

// Nur umbenennen (Sinnhaftigkeit: Name passt nicht zum Inhalt), auf Klick
export async function reiterNameUebernehmen(db: Database.Database, reiter: string): Promise<Ergebnis> {
  const { portfolioPlan } = await import("@/lib/portfolio-plan");
  const v = portfolioPlan(db).sinn.find((x) => x.reiter === reiter && x.name);
  if (!v?.name) return { ok: false, meldung: `Für Reiter „${reiter}“ gibt es keinen Namensvorschlag mehr.` };
  return umbenennenAktion(db, reiter, v.name);
}

// Reiter frei umbenennen (Taktikseite: Name eingeben oder Vorschlag übernehmen), auf Klick
export async function reiterUmbenennenFrei(db: Database.Database, alt: string, neu: string): Promise<Ergebnis> {
  const { ladeEditorReiter } = await import("@/lib/db/taktik");
  const { nameErlaubt } = await import("@/lib/reiter-uebersicht");
  const namen = ladeEditorReiter(db)?.reiter.map((r) => r.name) ?? ladeTaktiken(db).map((t) => t.reiter);
  const fehler = nameErlaubt(neu, alt, namen);
  if (fehler) return { ok: false, meldung: fehler };
  if (/^liga$/i.test(alt)) return { ok: false, meldung: "Den Reiter „Liga“ braucht die Seite unter diesem Namen." };
  return umbenennenAktion(db, alt, neu.trim());
}

// Vorschlag für den Reiter freund übernehmen: "bank" = wichtigste Spieler auf die Bank, "stil" = anderer Stil
export async function freundUebernehmen(db: Database.Database, reiter: string, was: "bank" | "stil"): Promise<Ergebnis> {
  const { reiterUebersicht } = await import("@/lib/reiter-uebersicht");
  const k = reiterUebersicht(db).karten.find((x) => x.name === reiter && x.art === "freund");
  const xml = was === "bank" ? k?.freund?.xml : k?.freund?.stilVorschlag?.xml;
  if (!xml) return { ok: false, meldung: `Für „${reiter}“ gibt es diesen Vorschlag nicht mehr.` };
  return xmlUebernehmen(db, reiter, xml, was === "bank" ? "freund: wichtigste Spieler auf die Bank" : `freund: anderer Stil ${k!.freund!.stilVorschlag!.stil}`);
}

// Eine XML auf Klick in den gleichnamigen Editor-Reiter schreiben und prüfen; optional danach umbenennen
async function xmlUebernehmen(db: Database.Database, reiter: string, xml: string, was: string, neuerName?: string): Promise<Ergebnis> {
  const umbenennen = !!neuerName && neuerName !== reiter;
  return editorAktion(
    db,
    `${reiter}: ${was}`,
    umbenennen ? 5 : 3,
    async (s, melde) => {
      melde(`${reiter}: Reiter wählen und XML importieren`);
      const slot = await inEditorSchreiben(s, reiter, xml, sollAus(xml), melde);
      speichereTaktikXml(db, reiter, xml, `${was}, übernommen ${new Date().toISOString()}`);
      let m = `Taktik ${reiter}: ${was} in ManagerZone gespeichert (Reiter ${slot.toUpperCase()}) und nach Neuladen geprüft.`;
      if (umbenennen) {
        try {
          melde(`${reiter}: umbenennen in „${neuerName}“`);
          await reiterUmbenennen(s, reiter, neuerName!, melde);
          archivUmbenennen(db, reiter, neuerName!);
          m += ` Neuer Name: „${neuerName}“.`;
        } catch (e) {
          m += ` Umbenennen in „${neuerName}“ fehlgeschlagen (${meldungAus(e)}), bitte im Editor von Hand.`;
        }
      }
      return m;
    },
    `Taktik ${reiter}`,
  );
}

// Vorschlag des Taktik-Checks für einen Reiter übernehmen (nur auf Klick, Marcus 30.10.2026)
export async function taktikUebernehmen(db: Database.Database, reiter: string): Promise<Ergebnis> {
  const { taktikCheck } = await import("@/lib/taktik-check");
  const c = taktikCheck(db).find((x) => x.reiter === reiter);
  if (!c) return { ok: false, meldung: `Reiter „${reiter}“ nicht im Archiv.` };
  if (!c.aenderbar) return { ok: false, meldung: `Reiter „${reiter}“ braucht keine Änderung.` };
  return xmlUebernehmen(db, reiter, c.xml, "Vorschlag des Taktik-Checks");
}

// Neu erzeugte Taktik vor dem Schreiben vollständig prüfen (Marcus, 01.11.2026: „die Taktiken müssen immer komplett
// durchdacht sein und zum Erfolg führen“): Prüfliste aus mz-wissen.md (11 Spieler, 1 Torwart, Stürmer, Abstände, Bank,
// Rot-Regel …) und Ausdauer-Wechsel. Bei einem Fehler wird nichts geschrieben.
async function vollstaendigGeprueft(db: Database.Database, reiter: string, xml: string): Promise<string | null> {
  const { pruefeTaktik } = await import("@/lib/mz/taktik/pruefer");
  const { parseTaktikXml } = await import("@/lib/mz/taktik/xml");
  const { ladeKader } = await import("@/lib/db/kader");
  const { pruefeTaktikGegenKader } = await import("@/lib/taktik-check");
  const { heuteInBerlin } = await import("@/lib/format");
  const { naechsterLigaspieltag } = await import("@/lib/wissen/startbasis");
  const kader = ladeKader(db);
  const p = pruefeTaktik(parseTaktikXml(xml), kader);
  if (!p.ok) return `Nicht geschrieben, Prüfliste nicht erfüllt: ${p.fehler.map((f) => f.text).join(" ")}`;
  const { alterGrenze, stilGegenAussen } = await import("@/lib/taktik-check");
  // Maßgeblich ist der Stil der XML, die geschrieben wird (nicht der bisherige Inhalt des Reiters): wird 343flo durch 442flL
  // ersetzt, gilt der Stil von 442flL. außenR und außenL immer (Faustregel).
  const kopfballInnen = /^au(ß|ss)en[rl]$/i.test(reiter) || stilGegenAussen(db, xml);
  const c = pruefeTaktikGegenKader(reiter, xml, kader, ligaspieltag(db), alterGrenze(db, reiter), { kopfballInnen });
  if (c.aenderbar) return `Nicht geschrieben, die tägliche Prüfung würde noch ändern: ${c.aenderungen.length ? "Besetzung, " : ""}${c.wechselregeln.join("; ")}`;
  return null;
}

// Vorschlag des Portfolio-Plans übernehmen: Reiter mit dem neuen Stil überschreiben und nach dem Inhalt benennen
export async function portfolioUebernehmen(db: Database.Database, reiter: string): Promise<Ergebnis> {
  const { portfolioPlan } = await import("@/lib/portfolio-plan");
  const v = portfolioPlan(db).vorschlaege.find((x) => x.reiter === reiter);
  if (!v) return { ok: false, meldung: `Für Reiter „${reiter}“ gibt es keinen Portfolio-Vorschlag mehr.` };
  // Besetzung wie die tägliche Prüfung (bei Stilen gegen Gegner über außen mit Kopfball innen), dann volle Prüfung
  const { pruefeTaktikGegenKader, stilGegenAussen } = await import("@/lib/taktik-check");
  const { ladeKader } = await import("@/lib/db/kader");
  const { heuteInBerlin } = await import("@/lib/format");
  const { naechsterLigaspieltag } = await import("@/lib/wissen/startbasis");
  const c = pruefeTaktikGegenKader(reiter, v.xml, ladeKader(db), ligaspieltag(db), undefined, { kopfballInnen: stilGegenAussen(db, v.xml) });
  const xml = c.fehler ? v.xml : c.xml;
  const fehlt = await vollstaendigGeprueft(db, reiter, xml);
  if (fehlt) return { ok: false, meldung: fehlt };
  return xmlUebernehmen(db, reiter, xml, `Portfolio: ${v.stil} gegen ${v.klasse}`, v.name);
}

// Portfolio-Lücke gegen den nächsten Ligagegner übernehmen (Marcus, 31.10.2026): in den gewählten Reiter schreiben und nach
// dem Inhalt benennen. Nur auf Klick.
export async function lueckeUebernehmen(db: Database.Database, reiter: string): Promise<Ergebnis> {
  const { spieltagLage } = await import("@/lib/spieltag");
  const l = spieltagLage(db).luecke;
  if (!l) return { ok: false, meldung: "Kein fehlender bewährter Stil gegen den nächsten Gegner mehr." };
  if (!l.reiter.some((r) => r.name === reiter)) return { ok: false, meldung: `Reiter „${reiter}“ darf hierfür nicht überschrieben werden.` };
  const fehlt = await vollstaendigGeprueft(db, reiter, l.xml);
  if (fehlt) return { ok: false, meldung: fehlt };
  return xmlUebernehmen(db, reiter, l.xml, `Portfolio gegen ${l.klasse}: ${l.stil.schluessel}`, l.name);
}

// Spielstand-Regeln und Ausdauer-Wechsel in einem bestehenden Reiter ergänzen (auf ausdrücklichen Wunsch, Marcus
// 01.11.2026). Nur was fehlt; danach volle Prüfung, erst dann schreiben.
export async function regelnErgaenzen(db: Database.Database, reiter: string): Promise<Ergebnis> {
  const { ladeTaktiken } = await import("@/lib/db/taktik");
  const { abstaendeHalten, mitSpielstandRegeln, unpassendeRegelnEntfernen } = await import("@/lib/mz/taktik/mit-wechseln");
  const { pruefeTaktikGegenKader } = await import("@/lib/taktik-check");
  const { ladeKader } = await import("@/lib/db/kader");
  const { heuteInBerlin } = await import("@/lib/format");
  const { naechsterLigaspieltag } = await import("@/lib/wissen/startbasis");
  const t = ladeTaktiken(db).find((x) => x.reiter === reiter);
  if (!t) return { ok: false, meldung: `Reiter „${reiter}“ nicht im Archiv.` };
  const u = unpassendeRegelnEntfernen(t.xml);
  const a = abstaendeHalten(u.xml);
  const s = mitSpielstandRegeln(a.xml);
  // Altersreiter (U18): nur Spieler im Alter, keine Ausdauer-Wechsel (wie die tägliche Prüfung)
  const { alterGrenze, reiterGegenAussen, reiterOptionen } = await import("@/lib/taktik-check");
  const c = pruefeTaktikGegenKader(reiter, s.xml, ladeKader(db), ligaspieltag(db), alterGrenze(db, reiter), reiterOptionen(reiterGegenAussen(db), reiter));
  const xml = c.fehler ? s.xml : c.xml;
  if (xml === t.xml) return { ok: true, meldung: `Reiter „${reiter}“ hat schon alle Regeln, nichts geändert.` };
  const fehlt = await vollstaendigGeprueft(db, reiter, xml);
  if (fehlt) return { ok: false, meldung: fehlt };
  return xmlUebernehmen(db, reiter, xml, `Regeln angepasst: ${[...u.entfernt, ...a.verschoben, ...s.regeln, ...c.wechselregeln].join("; ")}`);
}

// Alle Reiter auf denselben Stand (Marcus, 01.11.2026: „in jeder Taktik, die ich habe, wo das fehlt … jetzt“): nacheinander
// regelnErgaenzen für jeden Reiter im Editor außer Liga (baut die Seite selbst aus dem Archiv-Reiter) und freund (Marcus:
// dort egal). U18 bekommt die Spielstand-Regeln auch (Marcus, 01.11.2026: „damit die erfolgreicher ist“), mit
// Altersgrenze und ohne Ausdauer-Wechsel. Ergebnis je Reiter im Protokoll.
export async function regelnAlleErgaenzen(db: Database.Database): Promise<Ergebnis> {
  const { ladeTaktiken, ladeEditorReiter } = await import("@/lib/db/taktik");
  const { FREUND } = await import("@/lib/freund-check");
  const editor = ladeEditorReiter(db);
  const reiter = ladeTaktiken(db)
    .map((t) => t.reiter)
    .filter((r) => !/^liga$/i.test(r) && !FREUND.test(r))
    .filter((r) => !editor || editor.reiter.some((x) => x.name.toLowerCase() === r.toLowerCase()));
  const teile: string[] = [];
  let ok = true;
  for (const r of reiter) {
    const e = await regelnErgaenzen(db, r);
    if (!e.ok) ok = false;
    teile.push(`${r}: ${e.meldung}`);
  }
  return { ok, meldung: teile.join(" | ") };
}

// Alternative 1 und 2 für einen Reiter ohne echte Alternativen nach dem Vorbild deines ähnlichsten Reiters bauen, die
// App-Wechsel (Ausdauer) auf die WECHSEL_MINUTE ziehen und alles nach voller Prüfung schreiben (Marcus, 01.11.2026 für
// 343kp: „so anpassen, dass sie optimal ist, Alternative 1 und 2 passend bauen und einfügen“).
export async function alternativenErgaenzen(db: Database.Database, reiter: string): Promise<Ergebnis> {
  const { ladeTaktiken } = await import("@/lib/db/taktik");
  const { aehnlichsteVorlage, alternativenUebertragen, hatAlternativen } = await import("@/lib/mz/taktik/alternativen");
  const { abstaendeHalten, mitSpielstandRegeln } = await import("@/lib/mz/taktik/mit-wechseln");
  const { parseTaktikXml } = await import("@/lib/mz/taktik/xml");
  const { WECHSEL_MINUTE, alterGrenze, pruefeTaktikGegenKader } = await import("@/lib/taktik-check");
  const { ladeKader } = await import("@/lib/db/kader");
  const { heuteInBerlin } = await import("@/lib/format");
  const { naechsterLigaspieltag } = await import("@/lib/wissen/startbasis");
  const alle = ladeTaktiken(db);
  const t = alle.find((x) => x.reiter === reiter);
  if (!t) return { ok: false, meldung: `Reiter „${reiter}“ nicht im Archiv.` };
  if (hatAlternativen(parseTaktikXml(t.xml))) return { ok: true, meldung: `Reiter „${reiter}“ hat schon eigene Alternativen, nichts geändert.` };
  const vorbild = aehnlichsteVorlage(
    t.xml,
    alle.filter((x) => x.reiter !== reiter && !/^(liga|freund)$/i.test(x.reiter) && !/^u(18|21|23)\b/i.test(x.reiter)),
  );
  if (!vorbild) return { ok: false, meldung: "Kein eigener Reiter mit echten Alternativen als Vorbild gefunden." };
  const text: string[] = [`Vorbild: ${vorbild.reiter}`];
  const a = alternativenUebertragen(t.xml, vorbild.xml);
  text.push(...a.text);
  let xml = mitSpielstandRegeln(a.xml).xml;
  // Ausdauer-Wechsel der App (feste Minute, Spielerwechsel, ohne Spielstand) auf die WECHSEL_MINUTE ziehen
  xml = xml.replace(/<TacticRule\b[^>]*>/g, (z) =>
    /check_time="true"/.test(z) && /check_goal_condition="false"/.test(z) && /check_player_event="false"/.test(z) && /out_player="\d+"/.test(z) && /\stime="70"/.test(z)
      ? z.replace(/\stime="70"/, ` time="${WECHSEL_MINUTE}"`)
      : z,
  );
  if (xml !== a.xml) text.push(`Ausdauer-Wechsel auf die ${WECHSEL_MINUTE}. Minute`);
  const ab = abstaendeHalten(xml);
  xml = ab.xml;
  text.push(...ab.verschoben);
  const { reiterGegenAussen, reiterOptionen } = await import("@/lib/taktik-check");
  const c = pruefeTaktikGegenKader(reiter, xml, ladeKader(db), ligaspieltag(db), alterGrenze(db, reiter), reiterOptionen(reiterGegenAussen(db), reiter));
  if (!c.fehler) xml = c.xml;
  const fehlt = await vollstaendigGeprueft(db, reiter, xml);
  if (fehlt) return { ok: false, meldung: `${text.join("; ")}. ${fehlt}` };
  return xmlUebernehmen(db, reiter, xml, `Alternativen und Regeln: ${text.join("; ")}`);
}

// Minute eines bestimmten Spielerwechsels in einem Reiter setzen (auf ausdrücklichen Wunsch, Marcus 01.11.2026: außenR wie
// außenL, Hyuga/Ishizaki gleich stark → früh wechseln wie die Topteams). Nur diese eine Regel, danach volle Prüfung.
export async function wechselMinuteSetzen(db: Database.Database, reiter: string, raus: number, rein: number, minute: number): Promise<Ergebnis> {
  const { ladeTaktiken } = await import("@/lib/db/taktik");
  const t = ladeTaktiken(db).find((x) => x.reiter === reiter);
  if (!t) return { ok: false, meldung: `Reiter „${reiter}“ nicht im Archiv.` };
  if (!Number.isInteger(minute) || minute < 1 || minute > 90) return { ok: false, meldung: "Minute ungültig." };
  let gefunden = 0;
  const xml = t.xml.replace(/<TacticRule\b[^>]*>/g, (z) => {
    if (!new RegExp(`out_player="${raus}"`).test(z) || !new RegExp(`in_player_id="${rein}"`).test(z) || !/check_time="true"/.test(z)) return z;
    gefunden++;
    return z.replace(/\stime="\d+"/, ` time="${minute}"`);
  });
  if (gefunden !== 1) return { ok: false, meldung: `Wechsel ${raus} → ${rein} in „${reiter}“ ${gefunden ? "mehrfach" : "nicht"} gefunden, nichts geändert.` };
  if (xml === t.xml) return { ok: true, meldung: `Wechsel steht schon in der ${minute}. Minute.` };
  const fehlt = await vollstaendigGeprueft(db, reiter, xml);
  if (fehlt) return { ok: false, meldung: fehlt };
  return xmlUebernehmen(db, reiter, xml, `Wechsel ${raus} → ${rein} auf die ${minute}. Minute`);
}
