const ZEIT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function datumZeit(iso: string): string {
  return ZEIT.format(new Date(iso));
}

export function euro(wert: number): string {
  return `${zahl(wert)} EUR`;
}

export function zahl(wert: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(wert);
}
