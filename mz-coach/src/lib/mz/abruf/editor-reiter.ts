import "server-only";
import type Database from "better-sqlite3";
import type { Page } from "playwright";
import { ladeTaktiken, loescheTaktik, speichereEditorReiter, speichereTaktikXml, type EditorReiter } from "@/lib/db/taktik";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";

// Alle Reiter direkt aus dem Taktik-Editor lesen (Marcus, 31.10.2026: das Archiv soll den echten Stand zeigen, U18 hat
// einen Altersregler). Nur lesen, nichts speichern in ManagerZone: Reiter anklicken (changeTacticTab, wechselt nur im
// Browser), „Export“ (teamTactic.editor.exportTactic, schreibt die XML in #importExportData), Feld lesen. Altersregler
// aus teamTactic.tacticsDataLocal.Tactic[…]["@attributes"].age_from/age_to (tactics.js, gelesen 31.10.2026).
// Leere Reiter (weniger als 11 Spieler) werden gemeldet, aber nicht ins Archiv übernommen.

export type GelesenerReiter = EditorReiter & { xml?: string; fehler?: string };

export async function reiterAusEditor(page: Page): Promise<GelesenerReiter[]> {
  const liste = await page.evaluate(() => {
    const w = window as unknown as { teamTactic?: { tacticsIndexedArr: Record<string, number>; tacticsDataLocal: { Tactic: { "@attributes": Record<string, string>; TacticPlayer?: unknown[] }[] } } };
    const tt = w.teamTactic;
    const out: { slot: string; name: string; alterVon: number; alterBis: number; spieler: number }[] = [];
    for (const el of document.querySelectorAll('[id^="tactic"][id$="Tab"]')) {
      const m = el.id.match(/^tactic([A-Z])Tab$/);
      if (!m) continue;
      const slot = m[1].toLowerCase();
      const t = tt?.tacticsDataLocal?.Tactic?.[tt.tacticsIndexedArr[slot]];
      const a = t?.["@attributes"] ?? {};
      out.push({
        slot,
        name: (el.textContent ?? "").replace(/^\*/, "").trim(),
        alterVon: Number(a.age_from ?? 16) || 16,
        alterBis: Number(a.age_to ?? 38) || 38,
        spieler: Array.isArray(t?.TacticPlayer) ? t!.TacticPlayer!.length : 0,
      });
    }
    return out;
  });
  const ergebnis: GelesenerReiter[] = [];
  for (const r of liste) {
    if (r.spieler < 11) {
      ergebnis.push(r);
      continue;
    }
    await page.evaluate((x) => (document.querySelector(`#tacticTab_${x} a`) as HTMLElement | null)?.click(), r.slot);
    await page.waitForTimeout(1200);
    const aktiv = await page.evaluate(() => (document.querySelector("#current_tab") as HTMLInputElement | null)?.value);
    if (aktiv !== r.slot) {
      ergebnis.push({ ...r, fehler: `Reiter ließ sich nicht wählen (aktiv: ${aktiv ?? "?"})` });
      continue;
    }
    const xml = await page.evaluate(() => {
      const w = window as unknown as { teamTactic?: { editor?: { exportTactic?: () => void } } };
      w.teamTactic?.editor?.exportTactic?.();
      return (document.querySelector("#importExportData") as HTMLTextAreaElement | null)?.value ?? "";
    });
    ergebnis.push(xml.includes("<SoccerTactics") ? { ...r, xml } : { ...r, fehler: "Export lieferte keine XML" });
  }
  return ergebnis;
}

// Gelesene Reiter speichern: Liste (mit Altersregler) und je Reiter die XML im Archiv. Der Reiter „Liga“ schreibt die Seite
// selbst und kommt nicht ins Archiv. Archiv-Einträge, die nur in Groß/Klein von einem Editor-Namen abweichen
// (z. B. „Kupass“ neben „kupass“), werden durch den Editor-Stand ersetzt. Gibt eine kurze Meldung zurück.
export function reiterSpeichern(db: Database.Database, gelesen: GelesenerReiter[], zeit = new Date().toISOString()): string {
  speichereEditorReiter(
    db,
    gelesen.map(({ slot, name, alterVon, alterBis, spieler }) => ({ slot, name, alterVon, alterBis, spieler })),
    zeit,
  );
  const archiv = ladeTaktiken(db);
  const uebernommen: string[] = [];
  const fehler: string[] = [];
  for (const r of gelesen) {
    if (!r.xml || /^liga$/i.test(r.name)) {
      if (r.fehler) fehler.push(`${r.name}: ${r.fehler}`);
      continue;
    }
    try {
      parseTaktikXml(r.xml);
    } catch (e) {
      fehler.push(`${r.name}: XML nicht lesbar (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    const alt = archiv.find((a) => a.reiter === r.name);
    if (!alt || alt.xml.trim() !== r.xml.trim()) speichereTaktikXml(db, r.name, r.xml, `aus dem Editor gelesen (Reiter ${r.slot.toUpperCase()})`, zeit);
    for (const a of archiv) if (a.reiter !== r.name && a.reiter.toLowerCase() === r.name.toLowerCase()) loescheTaktik(db, a.reiter);
    uebernommen.push(r.name);
  }
  return `Editor: ${uebernommen.length} Reiter gelesen (${uebernommen.join(", ")})${fehler.length ? `; nicht gelesen: ${fehler.join("; ")}` : ""}.`;
}
