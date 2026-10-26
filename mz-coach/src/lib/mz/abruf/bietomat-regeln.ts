// Regeln des Bietomats (Marcus, 26.10.2026; mz-wissen.md, Abschnitt 15), ohne Browser, damit testbar.
// - Erst in der heißen Phase bieten: ab HEISS_MS vor Auktionsende.
// - Nur bieten, wenn ein anderer Verein Höchstbietender ist (oder noch niemand geboten hat).
// - Immer nur eine Stufe: der Betrag, den ManagerZone im Gebotsfenster vorausfüllt (kleinstes zulässiges Gebot).
// - Harte Grenze: das Gebot in Euro (aufgerundet) darf den Endpreis nie überschreiten, auch nicht um 1 Euro.
// - Jedes Gebot in den letzten 3 Minuten verlängert um 3 Minuten (Text im Gebotsfenster): das Ende wird jedes Mal
//   neu gelesen, bis die Auktion vorbei ist.

export const HEISS_MS = 3 * 60_000;
export const PRUEF_MS = 15_000; // Abstand der Prüfungen in der heißen Phase

export type Zustand = {
  gefunden: boolean; // Spieler noch auf dem Markt (Suche nach Spielernummer)
  endeMs?: number;
  bieterTid?: number;
  hoechstgebotEur?: number;
};

export type Schritt =
  | { art: "warten"; ms: number; grund: string }
  | { art: "bieten" }
  | { art: "fertig"; status: "beendet" | "abgebrochen"; text: string };

// Nächster Schritt: warten, bieten oder fertig
// Kein "bieten bis" (Marcus, 26.10.2026): geboten wird bis zum Endpreis, egal wie oft sich die Auktion verlängert.
export function naechsterSchritt(z: Zustand, opt: { eigeneTid: number; letztesEndeMs?: number; letzterBieter?: number }, jetzt: number): Schritt {
  const ende = z.endeMs ?? opt.letztesEndeMs;
  if (!z.gefunden || (ende !== undefined && jetzt > ende + 60_000)) {
    const bieter = z.gefunden ? z.bieterTid : opt.letzterBieter;
    return bieter === opt.eigeneTid
      ? { art: "fertig", status: "beendet", text: "Auktion vorbei: du warst zuletzt Höchstbietender (Kauf in ManagerZone prüfen)." }
      : { art: "fertig", status: "beendet", text: "Auktion vorbei: ein anderer Verein war zuletzt Höchstbietender." };
  }
  if (ende === undefined) return { art: "fertig", status: "abgebrochen", text: "Auktionsende nicht lesbar: nicht geboten." };
  const rest = ende - jetzt;
  if (z.bieterTid === opt.eigeneTid) return { art: "warten", ms: Math.min(PRUEF_MS, Math.max(5_000, rest + 5_000)), grund: "du bist Höchstbietender" };
  if (rest > HEISS_MS) return { art: "warten", ms: Math.min(60_000, rest - HEISS_MS), grund: "noch nicht in den letzten 3 Minuten" };
  return { art: "bieten" };
}

// Betrag in der Währung des Verkäufers (so verlangt es das Gebotsfenster) in Euro umrechnen, aufgerundet
export function inEuro(betrag: number, kurs: number): number {
  return Math.ceil(betrag * kurs);
}

// Darf diese Stufe geboten werden? (harte Grenze Endpreis in Euro)
export function gebotErlaubt(betrag: number, kurs: number | undefined, maximumEur: number): { ok: true; eur: number } | { ok: false; grund: string } {
  if (!Number.isFinite(betrag) || betrag <= 0) return { ok: false, grund: "Kein Mindestgebot im Gebotsfenster lesbar." };
  if (kurs === undefined || !Number.isFinite(kurs) || kurs <= 0) return { ok: false, grund: "Wechselkurs zur Verkäuferwährung nicht lesbar." };
  const eur = inEuro(betrag, kurs);
  if (eur > maximumEur) return { ok: false, grund: `Endpreis erreicht: nächste Stufe ${eur} EUR liegt über deinem Endpreis ${maximumEur} EUR.` };
  return { ok: true, eur };
}

// Endpreis prüfen (Marcus, 26.10.2026): nicht unter dem Startgebot und, wenn schon geboten wurde, über dem aktuellen
// Gebot, sonst kann der Bietomat nie bieten. Beides in Euro wie in der Marktliste. null = in Ordnung.
export function endpreisFehler(maximumEur: number, markt?: { gefordert?: number; hoechstgebot?: number }): string | null {
  const f = (n: number) => `${new Intl.NumberFormat("de-DE").format(n)} €`;
  if (markt?.gefordert !== undefined && maximumEur < markt.gefordert) return `Endpreis ${f(maximumEur)} liegt unter dem Startgebot ${f(markt.gefordert)}.`;
  if (markt?.hoechstgebot && maximumEur <= markt.hoechstgebot) return `Endpreis ${f(maximumEur)} liegt nicht über dem aktuellen Gebot ${f(markt.hoechstgebot)}.`;
  return null;
}
