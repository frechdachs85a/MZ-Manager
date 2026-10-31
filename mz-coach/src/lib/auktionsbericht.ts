import type Database from "better-sqlite3";
import { ladeAuftraege, type GebotAuftrag } from "@/lib/db/gebot";
import { euro } from "@/lib/format";
import { TEAM } from "@/lib/wissen/startbasis";

// Auktionsbericht (Marcus, 31.10.2026): am Ende jeder Auktion des Bietomats ein Bericht, ob der Spieler kam oder nicht,
// als Push und Pop-up, und dieselbe Auswertung im Reiter Gebote unter „Beendete Auktionen“. Grundlage ist nur, was der
// Bietomat gesehen hat: wer zuletzt Höchstbietender war, die eigenen Gebote aus dem Protokoll und das eingestellte
// Maximum. Ob der Kauf in ManagerZone abgeschlossen ist, prüft er nicht.

export type Bericht = { titel: string; text: string; link: string };
export type AuktionsErgebnis = {
  art: "bekommen" | "nicht-bekommen" | "beendet";
  preis?: number; // Endpreis: aus der Gebotsübersicht, sonst bei „bekommen“ dein letztes, höchstes Gebot
  kaeufer?: string; // Mannschaft mit dem letzten Gebot laut Gebotsübersicht
  arbeitsbewilligung?: number;
  quelle: "gebotsuebersicht" | "bietomat";
  gebote: number;
  hoechstes?: number;
  maximum: number;
  grund: string; // Schlusssatz des Bietomats
};

const BEKOMMEN = "du warst zuletzt Höchstbietender";
const VERLOREN = "ein anderer Verein war zuletzt Höchstbietender";

// Auswertung eines Auftrags aus seinem Protokoll (ab Anlage des Auftrags); `ergebnis` = Schlusssatz, sonst aus dem Protokoll
export function auktionsErgebnis(db: Database.Database, a: GebotAuftrag, ergebnis?: string): AuktionsErgebnis {
  const log = db.prepare("SELECT betrag, text FROM gebot_log WHERE pid = ? AND zeit >= ? ORDER BY id").all(a.pid, a.erstellt) as {
    betrag: number | null;
    text: string;
  }[];
  const gebote = log.filter((l) => l.betrag !== null && l.text.startsWith("Geboten")).map((l) => l.betrag!);
  const hoechstes = gebote.length ? Math.max(...gebote) : undefined;
  const grund = ergebnis ?? [...log].reverse().find((l) => /Auktion vorbei|Abgebrochen|nicht lesbar|Bietomat /.test(l.text))?.text ?? "Kein Schlusssatz im Protokoll.";
  // Endstand aus der Gebotsübersicht von ManagerZone hat Vorrang (dort steht, wer das letzte Gebot hält und wie hoch)
  const e = a.ende;
  if (e?.tid) {
    const art = e.tid === TEAM.tid ? "bekommen" : "nicht-bekommen";
    return { art, preis: e.preis, kaeufer: e.team, arbeitsbewilligung: e.arbeitsbewilligung, quelle: "gebotsuebersicht", gebote: gebote.length, hoechstes, maximum: a.maximum, grund };
  }
  const art = grund.includes(BEKOMMEN) ? "bekommen" : grund.includes(VERLOREN) ? "nicht-bekommen" : "beendet";
  return { art, preis: art === "bekommen" ? hoechstes : undefined, quelle: "bietomat", gebote: gebote.length, hoechstes, maximum: a.maximum, grund };
}

export function auktionsBericht(db: Database.Database, pid: number, ergebnis: string): Bericht | null {
  if (ergebnis.startsWith("Auftrag gelöscht")) return null; // von dir beendet: kein Bericht
  const a = ladeAuftraege(db).find((x) => x.pid === pid);
  const name = a?.name ?? `Spieler ${pid}`;
  const e: AuktionsErgebnis = a ? auktionsErgebnis(db, a, ergebnis) : { art: "beendet", gebote: 0, maximum: 0, grund: ergebnis, quelle: "bietomat" };
  const titel =
    e.art === "bekommen"
      ? `✅ ${name} bekommen${e.preis !== undefined ? ` für ${euro(e.preis)}` : ""}`
      : e.art === "nicht-bekommen"
        ? `❌ ${name}: nicht bekommen`
        : `⚠️ ${name}: Bietomat beendet`;
  const teile = [
    e.art === "bekommen"
      ? e.quelle === "gebotsuebersicht"
        ? `Laut Gebotsübersicht von ManagerZone geht er für ${e.preis !== undefined ? euro(e.preis) : "?"} an FC Toho.`
        : `Du warst am Ende Höchstbietender${e.preis !== undefined ? `, Preis ${euro(e.preis)}` : ""}. Bitte den Kauf in ManagerZone prüfen.`
      : e.art === "nicht-bekommen"
        ? e.kaeufer
          ? `Er geht für ${e.preis !== undefined ? euro(e.preis) : "?"} an ${e.kaeufer}.`
          : "Ein anderer Verein hat zuletzt höher geboten."
        : ergebnis,
    e.arbeitsbewilligung !== undefined && e.art === "bekommen" ? `Kosten für die Arbeitsbewilligung: ${euro(e.arbeitsbewilligung)}.` : "",
    e.gebote ? `${e.gebote} Gebot(e) abgegeben, dein höchstes: ${euro(e.hoechstes!)}.` : "Kein eigenes Gebot abgegeben.",
    a ? `Dein Maximum: ${euro(a.maximum)}.` : "",
  ].filter(Boolean);
  return { titel, text: teile.join(" "), link: "/markt/bietomat#beendet" };
}
