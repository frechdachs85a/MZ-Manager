// Formatierung für die Anzeige (Datum, Euro, Zahlen) in deutscher Zeit.

const ZEIT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Datum und Uhrzeit (deutsche Zeit)
export function datumZeit(iso: string): string {
  return ZEIT.format(new Date(iso));
}

// Betrag mit Tausenderpunkten und „EUR“
export function euro(wert: number): string {
  return `${zahl(wert)} EUR`;
}

// Zahl mit Tausenderpunkten
export function zahl(wert: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(wert);
}

// Heutiger Kalendertag in Europe/Berlin (Date auf lokale Mitternacht)
export function heuteInBerlin(): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" })
    .format(new Date())
    .split("-")
    .map(Number);
  return new Date(y, m - 1, d);
}

// Spieldatum aus der Stats-XML "2026-10-21 14:45:00" -> "21.10.2026, 14:45" (nur umformatiert, keine Zeitzonen-Umrechnung)
export function spielDatum(d?: string): string | undefined {
  const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  return m ? `${m[3]}.${m[2]}.${m[1]}${m[4] ? `, ${m[4]}:${m[5]}` : ""}` : d;
}

// Stunde in Berlin (0 bis 23). Über formatToParts, weil „de-DE“ bei Stunde allein „05 Uhr“ liefert und Number("05 Uhr")
// NaN ist; damit liefen die Abrufe ab Mitternacht statt ab 4, 5 und 6 Uhr (gefunden 01.11.2026).
export function berlinStunde(d: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).formatToParts(d).find((p) => p.type === "hour")?.value;
  return Number(h);
}
