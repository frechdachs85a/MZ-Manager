"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { aendereAuftrag, ladeAuftraege, loescheAuftrag, protokolliere, speichereAuftrag } from "@/lib/db/gebot";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";
import { berlinZuUtc } from "@/lib/mz/parser/kader";

export type LadeState = { meldung?: string; spieler?: MarktSpieler; endeUtc?: string; auswahl?: (MarktSpieler & { endeUtc?: string })[] };
export type AuftragState = { meldung?: string; ok?: boolean };

const ganzzahl = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").replace(/[\s.]/g, "");
  return /^\d+$/.test(t) ? Number(t) : undefined;
};

export async function spielerLadenAktion(_prev: LadeState, formData: FormData): Promise<LadeState> {
  // Auswahl aus der Trefferliste: Daten liegen schon vor, nichts neu laden
  const gewaehlt = formData.get("gewaehlt");
  if (gewaehlt) {
    const sp = JSON.parse(String(gewaehlt)) as MarktSpieler & { endeUtc?: string };
    return { spieler: sp, endeUtc: sp.endeUtc };
  }
  const eingabe = String(formData.get("suche") ?? "").trim();
  if (eingabe.length < 2) return { meldung: "Bitte Spielernummer oder Namen eintragen." };
  const { spielerLaden } = await import("@/lib/mz/abruf/bietomat");
  const r = await spielerLaden(getDb(), eingabe);
  return r.ok ? { spieler: r.spieler, endeUtc: r.spieler.endeUtc } : { meldung: r.meldung, auswahl: r.auswahl };
}

// "bieten bis" kommt als datetime-local (Berliner Zeit, ohne Zone)
function berlinIso(v: string): string | undefined {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  return berlinZuUtc(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString();
}

export async function auftragSpeichern(_prev: AuftragState, formData: FormData): Promise<AuftragState> {
  const pid = ganzzahl(formData.get("pid"));
  const maximum = ganzzahl(formData.get("maximum"));
  if (!pid) return { meldung: "Spielernummer fehlt." };
  if (!maximum) return { meldung: "Bitte das Maximalgebot als ganze Zahl (EUR) eintragen." };
  const spieler = JSON.parse(String(formData.get("spieler") ?? "null")) as MarktSpieler | null;
  const bisText = String(formData.get("bis") ?? "");
  const bietenBis = bisText ? berlinIso(bisText) : undefined;
  if (bisText && !bietenBis) return { meldung: "„Bieten bis“ ist kein gültiger Zeitpunkt." };
  const auktionEnde = String(formData.get("ende") ?? "") || undefined;
  if (bietenBis && auktionEnde && bietenBis > auktionEnde) return { meldung: "„Bieten bis“ liegt nach dem Auktionsende." };
  const db = getDb();
  speichereAuftrag(db, { pid, name: spieler?.name, maximum, bietenBis, auktionEnde, spieler: spieler ?? undefined, status: "aktiv" });
  protokolliere(db, pid, `Auftrag gespeichert: höchstens ${maximum} EUR${bietenBis ? `, bieten bis ${bietenBis}` : ""}.`, maximum);
  revalidatePath("/markt/bietomat");
  return { ok: true, meldung: "Auftrag gespeichert." };
}

export async function auftragLoeschen(formData: FormData) {
  const pid = ganzzahl(formData.get("pid"));
  if (!pid) return;
  const db = getDb();
  loescheAuftrag(db, pid);
  protokolliere(db, pid, "Auftrag gelöscht.");
  revalidatePath("/markt/bietomat");
}

export async function auftragAendern(_prev: AuftragState, formData: FormData): Promise<AuftragState> {
  const pid = ganzzahl(formData.get("pid"));
  const maximum = ganzzahl(formData.get("maximum"));
  if (!pid) return { meldung: "Spielernummer fehlt." };
  if (!maximum) return { meldung: "Bitte den Endpreis als ganze Zahl (EUR) eintragen." };
  const db = getDb();
  const a = ladeAuftraege(db).find((x) => x.pid === pid);
  if (!a) return { meldung: "Auftrag nicht gefunden." };
  const bisText = String(formData.get("bis") ?? "");
  const bietenBis = bisText ? berlinIso(bisText) : undefined;
  if (bisText && !bietenBis) return { meldung: "„Bieten bis“ ist kein gültiger Zeitpunkt." };
  aendereAuftrag(db, pid, maximum, bietenBis ?? null);
  protokolliere(db, pid, `Auftrag geändert: Endpreis ${a.maximum} → ${maximum} EUR${bietenBis ? `, bieten bis ${bietenBis}` : ""}.`, maximum);
  revalidatePath("/markt/bietomat");
  return { ok: true, meldung: "Gespeichert." };
}

// Aus der Empfehlung des Transfermarkts (Marcus, 26.10.2026): Spieler frisch laden (aktuelles Ende, Gebot, Scout-Daten)
// und als Auftrag speichern
export async function empfehlungInBietomat(_prev: AuftragState, formData: FormData): Promise<AuftragState> {
  const pid = ganzzahl(formData.get("pid"));
  const maximum = ganzzahl(formData.get("maximum"));
  if (!pid) return { meldung: "Spielernummer fehlt." };
  if (!maximum) return { meldung: "Bitte den Endpreis als ganze Zahl (EUR) eintragen." };
  const { spielerLaden } = await import("@/lib/mz/abruf/bietomat");
  const db = getDb();
  const r = await spielerLaden(db, String(pid));
  if (!r.ok) return { meldung: r.meldung };
  const { endeUtc, ...spieler } = r.spieler;
  speichereAuftrag(db, { pid, name: spieler.name, maximum, auktionEnde: endeUtc, spieler, status: "aktiv" });
  protokolliere(db, pid, `Auftrag aus der Empfehlung gespeichert: höchstens ${maximum} EUR.`, maximum);
  revalidatePath("/markt");
  revalidatePath("/markt/bietomat");
  return { ok: true, meldung: `Im Bietomat: Endpreis ${new Intl.NumberFormat("de-DE").format(maximum)} EUR, Ende ${spieler.markt.ende ?? "?"}.` };
}
