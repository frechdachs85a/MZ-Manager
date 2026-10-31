import type Database from "better-sqlite3";
import { ladeAuftraege } from "@/lib/db/gebot";
import { euro } from "@/lib/format";

// Auktionsbericht (Marcus, 31.10.2026): am Ende jeder Auktion des Bietomats ein Bericht, ob der Spieler kam oder nicht,
// als Push und Pop-up. Grundlage ist nur, was der Bietomat gesehen hat: wer zuletzt Höchstbietender war, die eigenen
// Gebote aus dem Protokoll und das eingestellte Maximum. Ob der Kauf in ManagerZone abgeschlossen ist, prüft er nicht.

export type Bericht = { titel: string; text: string; link: string };

export function auktionsBericht(db: Database.Database, pid: number, ergebnis: string): Bericht | null {
  if (ergebnis.startsWith("Auftrag gelöscht")) return null; // von dir beendet: kein Bericht
  const a = ladeAuftraege(db).find((x) => x.pid === pid);
  const name = a?.name ?? `Spieler ${pid}`;
  const seit = a?.erstellt ?? "";
  const gebote = db.prepare("SELECT betrag FROM gebot_log WHERE pid = ? AND zeit >= ? AND betrag IS NOT NULL ORDER BY id").all(pid, seit) as { betrag: number }[];
  const hoechstes = gebote.length ? Math.max(...gebote.map((g) => g.betrag)) : undefined;
  const bekommen = ergebnis.includes("du warst zuletzt Höchstbietender");
  const verloren = ergebnis.includes("ein anderer Verein war zuletzt Höchstbietender");
  // Bekommen: dein letztes (höchstes) Gebot ist der Kaufpreis, du warst ja zuletzt Höchstbietender
  const titel = bekommen
    ? `✅ ${name} bekommen${hoechstes !== undefined ? ` für ${euro(hoechstes)}` : ""}`
    : verloren
      ? `❌ ${name}: nicht bekommen`
      : `⚠️ ${name}: Bietomat beendet`;
  const teile = [
    bekommen
      ? `Du warst am Ende Höchstbietender${hoechstes !== undefined ? `, Preis ${euro(hoechstes)}` : ""}. Bitte den Kauf in ManagerZone prüfen.`
      : verloren
        ? "Ein anderer Verein hat zuletzt höher geboten."
        : ergebnis,
    gebote.length ? `${gebote.length} Gebot(e) abgegeben, dein höchstes: ${euro(hoechstes!)}.` : "Kein eigenes Gebot abgegeben.",
    a ? `Dein Maximum: ${euro(a.maximum)}.` : "",
  ].filter(Boolean);
  return { titel, text: teile.join(" "), link: "/markt/bietomat" };
}
