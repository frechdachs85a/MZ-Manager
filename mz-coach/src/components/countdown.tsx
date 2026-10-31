"use client";

import { useEffect, useState } from "react";

// Restzeit bis zum Auktionsende (Marcus, 31.10.2026: überall sehen, wie lange ein Spieler noch auf dem Markt ist).
// Tage, Stunden, Minuten; jede Minute neu. Unter einer Stunde rot.
export function Countdown({ ende }: { ende?: string }) {
  const [jetzt, setJetzt] = useState<number | null>(null);
  useEffect(() => {
    // Erst nach dem Einbinden die Uhrzeit setzen (gleiches HTML auf Server und Browser)
    const start = setTimeout(() => setJetzt(Date.now()), 0);
    const t = setInterval(() => setJetzt(Date.now()), 30_000);
    return () => {
      clearTimeout(start);
      clearInterval(t);
    };
  }, []);
  if (!ende) return <span className="text-label-3">Ende unbekannt</span>;
  const ziel = Date.parse(ende);
  if (jetzt === null) return <span className="tabular-nums text-label-3">…</span>;
  const rest = ziel - jetzt;
  if (rest <= 0) return <span className="font-semibold text-label-3">Auktion beendet</span>;
  const min = Math.floor(rest / 60_000);
  const t = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const text = `${t > 0 ? `${t} T ` : ""}${t > 0 || h > 0 ? `${h} Std ` : ""}${m} Min`;
  return (
    <span className={`tabular-nums font-semibold ${rest < 3_600_000 ? "text-red" : "text-label"}`} title={new Date(ziel).toLocaleString("de-DE")}>
      ⏱ noch {text}
    </span>
  );
}
