import { Badge } from "@/components/ui";
import { datumZeit } from "@/lib/format";
import type { SpielerDaten } from "@/lib/mz/spieler";

// Status-Markierungen eines Spielers. Nur, was eine gespeicherte Seite belegt.
export function StatusBadges({ s }: { s: SpielerDaten }) {
  const st = s.status ?? {};
  const sperrArten = [...new Set((s.sperren ?? []).map((x) => x.art))];
  return (
    <>
      {st.aufstellbar === false && <Badge tone="red">nicht aufstellbar</Badge>}
      {st.verletzt && <Badge tone="red">verletzt</Badge>}
      {st.gesperrt && <Badge tone="red">gesperrt{sperrArten.length ? `: ${sperrArten.join(", ")}` : ""}</Badge>}
      {st.trainingslager && <Badge tone="orange">Trainingslager</Badge>}
      {st.transfermarkt && <Badge tone="tint">Markt</Badge>}
    </>
  );
}

const QUELLEN = [
  ["verletzt", "Verletzt"],
  ["gesperrt", "Gesperrt"],
  ["trainingslager", "Trainingslager"],
  ["aufstellbar", "Aufstellbar (Taktikseite)"],
] as const;

// Wie aktuell jeder Status ist (neuester Stand über alle Spieler), fehlende Quellen mit Grund.
export function statusHinweis(kader: SpielerDaten[]): string {
  const teile = QUELLEN.map(([feld, label]) => {
    const stand = kader
      .map((s) => s.statusStand?.[feld])
      .filter((z): z is string => !!z)
      .sort()
      .at(-1);
    return stand ? `${label}: Stand ${datumZeit(stand)}` : `${label}: nicht verfügbar, Seite noch nicht eingelesen`;
  });
  return `${teile.join(". ")}. Transfermarkt: nicht verfügbar, Quelle noch nicht eingebunden.`;
}
