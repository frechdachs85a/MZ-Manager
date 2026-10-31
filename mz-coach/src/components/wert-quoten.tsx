// Tabelle der Wertbereich-Statistik: Sieg/Unentschieden/Niederlage je Verhältnis der Startelf-Werte.

import { Card } from "@/components/ui";
import type { Quote } from "@/lib/db/wertspiel";

const pz = (n: number, von: number) => (von ? `${Math.round((n / von) * 100)} %` : "–");

// Sieg/Remis/Niederlage je Wertbereich (Verhältnis Kaderwert eigenes Team ÷ Gegner)
export function WertQuoten({ elf, feld, spiele }: { elf: Quote[]; feld: Quote[]; spiele: number }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13.5px]">
        <thead>
          <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
            <th className="px-3 py-2 pl-4 font-semibold">Verhältnis</th>
            <th className="px-3 py-2 text-right font-semibold">Startelf: Sichten</th>
            <th className="px-3 py-2 text-right font-semibold">Sieg / Remis / Niederlage</th>
            <th className="px-3 py-2 text-right font-semibold">Feld-Wert gewichtet: Sichten</th>
            <th className="px-3 py-2 pr-4 text-right font-semibold">Sieg / Remis / Niederlage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {elf.map((q, i) => {
            const f = feld[i];
            return (
              <tr key={q.bereich}>
                <td className="px-3 py-1.5 pl-4 font-semibold">{q.bereich}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{q.spiele}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  <span className="text-green">{pz(q.S, q.spiele)}</span> / {pz(q.U, q.spiele)} / <span className="text-red">{pz(q.N, q.spiele)}</span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.spiele}</td>
                <td className="px-3 py-1.5 pr-4 text-right tabular-nums">
                  <span className="text-green">{pz(f.S, f.spiele)}</span> / {pz(f.U, f.spiele)} / <span className="text-red">{pz(f.N, f.spiele)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-separator px-4 py-2 text-[12px] text-label-3">
        {spiele} Spiele, jedes aus Sicht beider Teams gezählt (Sichten). Nur Spiele, in denen alle Spieler einen Marktwert hatten. Marktwerte vom Abrufdatum,
        nicht vom Spieltag.
      </p>
    </Card>
  );
}
