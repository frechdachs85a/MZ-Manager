// Aufstellungen eines Spiels je Phase (zwischen den Wechseln) als Spielfelder.

import { Spielfeld } from "@/components/spielfeld";
import { Badge, Card } from "@/components/ui";
import type { Phase } from "@/lib/mz/analyse/verlauf";

const kurz = (name: string) => {
  const t = name.split(" ");
  return t.length > 1 ? `${t[0][0]} ${t.slice(1).join(" ")}` : name;
};
const QUELLE = { xml: "aus der XML", export: "aus dem Export", abgeleitet: "abgeleitet" } as const;

// Zeitleiste der Aufstellung: jede Phase mit Spielfeld; abgeleitete Plätze grau

export function VerlaufAnsicht({ phasen, hinweise, werte }: { phasen: Phase[]; hinweise: string[]; werte?: Record<number, number> }) {
  return (
    <div className="space-y-4">
      {hinweise.map((h, i) => (
        <p key={i} className="text-[13px] text-orange">{h}</p>
      ))}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {phasen.map((p, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="font-semibold tabular-nums">{p.minute === 0 ? "Anpfiff" : `${p.minute}.`} · {p.stand}</span>
              <Badge tone={p.quelle === "abgeleitet" ? "orange" : "neutral"}>{QUELLE[p.quelle]}</Badge>
            </div>
            <p className="mt-1 min-h-[2.5em] text-[12px] leading-snug text-label-2">{p.text}</p>
            <div className="mt-2">
              <Spielfeld spieler={p.aufstellung.map((s) => ({ x: s.x, y: s.y, label: kurz(s.name), wert: werte?.[s.pid], torwart: s.torwart, ton: s.quelle === "abgeleitet" ? "grau" : "normal" }))} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
