"use server";

import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { pruefeTaktik, type Befund } from "@/lib/mz/taktik/pruefer";
import { aufstellung, parseTaktikXml, TaktikXmlFehler } from "@/lib/mz/taktik/xml";
import type { FeldSpieler } from "@/components/spielfeld";

export type PruefState = {
  fehlerXml?: string;
  ergebnis?: {
    ok: boolean;
    fehler: Befund[];
    hinweise: Befund[];
    aufstellungen: (FeldSpieler[] | null)[];
    bank: { y: number; name: string; torwart: boolean }[];
    team: Record<string, string>;
  };
};

export async function taktikPruefen(_prev: PruefState, formData: FormData): Promise<PruefState> {
  const xml = String(formData.get("xml") ?? "");
  if (!xml.trim()) return { fehlerXml: "Bitte den XML-Code der Taktik einfügen." };
  try {
    const t = parseTaktikXml(xml);
    const kader = ladeKader(getDb());
    const nach = new Map(kader.map((s) => [s.pid, s]));
    // Kurzform wie auf der ManagerZone-Taktikseite: "Liu Chao Feng" -> "L Chao Feng"
    const kurz = (pid: number) => {
      const teile = nach.get(pid)?.name.split(" ");
      return teile ? (teile.length > 1 ? `${teile[0][0]} ${teile.slice(1).join(" ")}` : teile[0]) : String(pid);
    };
    const pruefung = pruefeTaktik(t, kader);
    const aufstellungen = ([0, 1, 2] as const).map((k) => {
      const a = aufstellung(t, k);
      if (k > 0 && a.every((s) => !s.p)) return null;
      return a
        .filter((s) => s.p)
        .map((s) => {
          const st = nach.get(s.pid)?.status;
          return {
            x: s.p!.x,
            y: s.p!.y,
            label: kurz(s.pid),
            torwart: s.pos === "goalie",
            ton: st?.aufstellbar === false || st?.verletzt ? ("rot" as const) : ("normal" as const),
          };
        });
    });
    const bank = [...t.subs].sort((a, b) => a.y - b.y).map((s) => ({ y: s.y, name: nach.get(s.pid)?.name ?? `pid ${s.pid}`, torwart: s.pos === "subgoalie" }));
    return { ergebnis: { ...pruefung, aufstellungen, bank, team: t.team } };
  } catch (e) {
    return { fehlerXml: e instanceof TaktikXmlFehler ? e.message : "XML konnte nicht gelesen werden." };
  }
}

export type ArchivState = { ok?: boolean; meldung?: string };

export async function taktikArchivieren(_prev: ArchivState, formData: FormData): Promise<ArchivState> {
  const reiter = String(formData.get("reiter") ?? "").trim();
  const xml = String(formData.get("xml") ?? "");
  if (!reiter) return { meldung: "Bitte den Namen des Reiters angeben." };
  try {
    parseTaktikXml(xml);
  } catch (e) {
    return { meldung: e instanceof TaktikXmlFehler ? e.message : "XML nicht lesbar." };
  }
  const { speichereTaktikXml } = await import("@/lib/db/taktik");
  speichereTaktikXml(getDb(), reiter, xml, "von Hand eingefügt (Export aus dem Taktik-Editor)");
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
  return { ok: true, meldung: `${reiter} gespeichert.` };
}

export async function taktikEntfernen(formData: FormData) {
  const reiter = String(formData.get("reiter") ?? "");
  const { loescheTaktik } = await import("@/lib/db/taktik");
  if (reiter) loescheTaktik(getDb(), reiter);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
}
