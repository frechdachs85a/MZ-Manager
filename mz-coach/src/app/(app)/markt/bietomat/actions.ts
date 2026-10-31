"use server";

// Server-Aktionen des Bietomats: Spieler laden (Nummer oder Name), Auftrag speichern, ändern, löschen, aus der Empfehlung übernehmen.

import { entferneVonWatchlist, nimmAufWatchlist } from "@/lib/db/watch";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { aendereAuftrag, ladeAuftraege, loescheAuftrag, protokolliere, speichereAuftrag } from "@/lib/db/gebot";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";
import type { Verkauf } from "@/lib/mz/parser/verkauf";
import { endpreisFehler } from "@/lib/mz/abruf/bietomat-regeln";

export type LadeState = { meldung?: string; spieler?: MarktSpieler & { verkauf?: Verkauf }; endeUtc?: string; auswahl?: (MarktSpieler & { endeUtc?: string })[] };
export type AuftragState = { meldung?: string; ok?: boolean };

const ganzzahl = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").replace(/[\s.]/g, "");
  return /^\d+$/.test(t) ? Number(t) : undefined;
};

// Spieler laden: aus der Trefferliste gewählt oder per Nummer/Name gesucht
export async function spielerLadenAktion(_prev: LadeState, formData: FormData): Promise<LadeState> {
  // Auswahl aus der Trefferliste: per Spielernummer neu laden (frische Daten und letzter Verkauf)
  const gewaehlt = formData.get("gewaehlt");
  const eingabe = gewaehlt ? String((JSON.parse(String(gewaehlt)) as MarktSpieler).pid) : String(formData.get("suche") ?? "").trim();
  if (eingabe.length < 2) return { meldung: "Bitte Spielernummer oder Namen eintragen." };
  const { spielerLaden } = await import("@/lib/mz/abruf/bietomat");
  const r = await spielerLaden(getDb(), eingabe);
  return r.ok ? { spieler: r.spieler, endeUtc: r.spieler.endeUtc } : { meldung: r.meldung, auswahl: r.auswahl };
}

// Neuen Auftrag speichern (Endpreis, Auktionsende). Geboten wird bis zum Endpreis, ohne Zeitgrenze.
export async function auftragSpeichern(_prev: AuftragState, formData: FormData): Promise<AuftragState> {
  const pid = ganzzahl(formData.get("pid"));
  const maximum = ganzzahl(formData.get("maximum"));
  if (!pid) return { meldung: "Spielernummer fehlt." };
  if (!maximum) return { meldung: "Bitte das Maximalgebot als ganze Zahl (EUR) eintragen." };
  const spieler = JSON.parse(String(formData.get("spieler") ?? "null")) as MarktSpieler | null;
  const auktionEnde = String(formData.get("ende") ?? "") || undefined;
  const fehler = endpreisFehler(maximum, spieler?.markt);
  if (fehler) return { meldung: fehler };
  const db = getDb();
  speichereAuftrag(db, { pid, name: spieler?.name, maximum, auktionEnde, spieler: spieler ?? undefined, status: "aktiv" });
  protokolliere(db, pid, `Auftrag gespeichert: höchstens ${maximum} EUR.`, maximum);
  revalidatePath("/markt/bietomat");
  revalidatePath("/markt/watchlist");
  return { ok: true, meldung: "Auftrag gespeichert." };
}

// Auftrag löschen (läuft der Bietomat, hört er in der nächsten Runde auf)
export async function auftragLoeschen(formData: FormData) {
  const pid = ganzzahl(formData.get("pid"));
  if (!pid) return;
  const db = getDb();
  const auftrag = ladeAuftraege(db).find((x) => x.pid === pid);
  loescheAuftrag(db, pid);
  if (formData.get("danach") === "watchlist" && auftrag?.spieler) {
    nimmAufWatchlist(db, auftrag.spieler);
    protokolliere(db, pid, "Auftrag gelöscht, zurück auf die Watchlist.");
  } else {
    entferneVonWatchlist(db, pid);
    protokolliere(db, pid, "Auftrag gelöscht und verworfen.");
  }
  revalidatePath("/markt/bietomat");
  revalidatePath("/markt/watchlist");
  revalidatePath("/markt/watchlist");
  revalidatePath("/markt");
}

// Endpreis eines Auftrags ändern
export async function auftragAendern(_prev: AuftragState, formData: FormData): Promise<AuftragState> {
  const pid = ganzzahl(formData.get("pid"));
  const maximum = ganzzahl(formData.get("maximum"));
  if (!pid) return { meldung: "Spielernummer fehlt." };
  if (!maximum) return { meldung: "Bitte den Endpreis als ganze Zahl (EUR) eintragen." };
  const db = getDb();
  const a = ladeAuftraege(db).find((x) => x.pid === pid);
  if (!a) return { meldung: "Auftrag nicht gefunden." };
  // Stand beim Laden; ein höheres Gebot seitdem erkennt der Bietomat selbst ("Endpreis erreicht")
  const fehler = endpreisFehler(maximum, a.spieler?.markt);
  if (fehler) return { meldung: fehler };
  aendereAuftrag(db, pid, maximum);
  protokolliere(db, pid, `Auftrag geändert: Endpreis ${a.maximum} → ${maximum} EUR.`, maximum);
  revalidatePath("/markt/bietomat");
  revalidatePath("/markt/watchlist");
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
  const fehler = endpreisFehler(maximum, spieler.markt);
  if (fehler) return { meldung: fehler };
  speichereAuftrag(db, { pid, name: spieler.name, maximum, auktionEnde: endeUtc, spieler, status: "aktiv" });
  protokolliere(db, pid, `Auftrag aus der Empfehlung gespeichert: höchstens ${maximum} EUR.`, maximum);
  revalidatePath("/markt");
  revalidatePath("/markt/bietomat");
  revalidatePath("/markt/watchlist");
  return { ok: true, meldung: `Im Bietomat: Endpreis ${new Intl.NumberFormat("de-DE").format(maximum)} EUR, Ende ${spieler.markt.ende ?? "?"}.` };
}
