"use client";

// Fortschritt einer Editor-Aktion (Marcus, 31.10.2026): solange `aktiv`, jede Sekunde den Stand abfragen und als Balken
// mit dem aktuellen Schritt zeigen. Ist die Aktion fertig, lädt die Seite den neuen Stand (refresh in der Server-Aktion).

import { useEffect, useState } from "react";

type Stand = { aufgabe: string; schritt: number; von: number; text: string; beginn: string; fertig: boolean; ok?: boolean };

export function FortschrittBalken({ aktiv }: { aktiv: boolean }) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [sekunden, setSekunden] = useState(0);
  useEffect(() => {
    if (!aktiv) return;
    const start = Date.now();
    let weiter = true;
    const holen = async () => {
      try {
        const r = await fetch("/api/taktik/fortschritt", { cache: "no-store" });
        const s = (await r.json()) as Stand | null;
        // Nur den Stand dieser Aktion zeigen (nach dem Klick begonnen)
        if (weiter && s && Date.parse(s.beginn) >= start - 5_000) setStand(s);
      } catch {
        // Netz kurz weg: beim nächsten Takt erneut
      }
      if (weiter) setSekunden(Math.round((Date.now() - start) / 1000));
    };
    void holen();
    const t = setInterval(holen, 1000);
    return () => {
      weiter = false;
      clearInterval(t);
    };
  }, [aktiv]);
  if (!aktiv) return null;
  const anteil = stand ? Math.max(0.05, stand.schritt / stand.von) : 0.03;
  return (
    <div className="mt-2 w-full" role="status" aria-live="polite">
      <div className="h-2 w-full overflow-hidden rounded-full bg-fill">
        <div className="h-full rounded-full bg-tint transition-[width] duration-500" style={{ width: `${Math.round(anteil * 100)}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[12px] text-label-2">
        <span>{stand ? `Schritt ${stand.schritt} von ${stand.von}: ${stand.text}` : "Wird gestartet …"}</span>
        <span className="tabular-nums text-label-3">{sekunden} s</span>
      </div>
    </div>
  );
}
