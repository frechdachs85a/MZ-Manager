import Link from "next/link";
import { ScoutAbzeichen } from "@/components/scout-abzeichen";
import { StatusBadges } from "@/components/status";
import { Card } from "@/components/ui";
import { stufe } from "@/components/wert-stufe";
import type { KaderEintrag } from "@/lib/db/kader";
import { alleMzWerte, POSITIONEN, type Position } from "@/lib/mz/formel";
import type { ScoutEinstufung } from "@/lib/scout";

// Kadertabelle für Kader und Jugend (Marcus, 31.10.2026: Jugend soll gleich aussehen wie der Kader). MZ-Wert je Position,
// bester Wert umrandet, sortierbar über die Spaltenköpfe (?sort=…, andere Parameter bleiben erhalten).

export type Sortierung = "nr" | "alter" | "scout" | "bester" | Position;
export type KaderZeile = KaderEintrag & { scout: ScoutEinstufung };

export const besterWert = (s: KaderEintrag): { p: Position; wert: number } | undefined => {
  const w = alleMzWerte(s.skills);
  return POSITIONEN.flatMap((p) => {
    const x = w[p];
    return x.ok ? [{ p, wert: x.wert }] : [];
  }).sort((a, b) => b.wert - a.wert)[0];
};

export function sortiere(kader: KaderZeile[], sort: Sortierung, rangSortierung: (e: ScoutEinstufung) => number): KaderZeile[] {
  if (sort === "nr") return [...kader].sort((a, b) => (a.nr ?? 999) - (b.nr ?? 999));
  if (sort === "scout") return [...kader].sort((a, b) => rangSortierung(a.scout) - rangSortierung(b.scout) || (a.nr ?? 0) - (b.nr ?? 0));
  const wert = (s: KaderEintrag) => {
    if (sort === "alter") return s.alter ?? -1;
    if (sort === "bester") return besterWert(s)?.wert ?? -1;
    const w = alleMzWerte(s.skills)[sort];
    return w.ok ? w.wert : -1;
  };
  return [...kader].sort((a, b) => wert(b) - wert(a));
}

// Link mit geändertem Parameter, alle anderen bleiben
export function mitParam(basis: string, params: Record<string, string | undefined>, aenderung: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...aenderung })) if (v) q.set(k, v);
  return `${basis}${q.size ? `?${q}` : ""}`;
}

function SpaltenKopf({ label, wert, sort, href, rechts = true }: { label: string; wert: Sortierung; sort: Sortierung; href: string; rechts?: boolean }) {
  const aktiv = sort === wert;
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex items-center gap-1 ${rechts ? "justify-end" : ""} ${aktiv ? "text-tint" : "hover:text-label"}`}
      title={wert === "nr" ? "Nach Nummer" : wert === "scout" ? "Nach Scout-Rang (1 = beste)" : `Nach ${label} sortieren (absteigend)`}
    >
      {label}
      {aktiv && wert !== "nr" && <span aria-hidden>↓</span>}
    </Link>
  );
}

const KURZ: Record<string, string> = { Anchorman: "Anch." };

export function KaderTabelle({
  kader,
  sort,
  link,
  extra,
}: {
  kader: KaderZeile[];
  sort: Sortierung;
  link: (sort: Sortierung) => string;
  extra?: { titel: string; zelle: (z: KaderZeile) => React.ReactNode };
}) {
  return (
    <Card className="!overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-separator bg-card-2 text-[10.5px] uppercase tracking-wider text-label-3">
            <th className="w-8 py-2 pl-3 text-right font-semibold">
              <SpaltenKopf label="Nr" wert="nr" sort={sort} href={link("nr")} />
            </th>
            <th className="py-2 pl-3 font-semibold">Name</th>
            <th className="py-2 pl-2 text-right font-semibold">
              <SpaltenKopf label="Alter" wert="alter" sort={sort} href={link("alter")} />
            </th>
            <th className="py-2 pl-3 font-semibold">
              <SpaltenKopf label="Scout" wert="scout" sort={sort} href={link("scout")} rechts={false} />
            </th>
            {extra && <th className="py-2 pl-3 font-semibold">{extra.titel}</th>}
            <th className="py-2 pl-2 text-center font-semibold">
              <SpaltenKopf label="Bester" wert="bester" sort={sort} href={link("bester")} />
            </th>
            {POSITIONEN.map((p) => (
              <th key={p} className="py-2 pl-1.5 text-center font-semibold" title={p}>
                <SpaltenKopf label={KURZ[p] ?? p} wert={p} sort={sort} href={link(p)} />
              </th>
            ))}
            <th className="py-2 pr-3 pl-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {kader.map((s) => {
            const werte = alleMzWerte(s.skills);
            const b = besterWert(s);
            return (
              <tr key={s.pid} className="zeile-hover transition-colors">
                <td className="py-1 pl-3 text-right tabular-nums text-label-3">{s.nr ?? ""}</td>
                <td className="whitespace-nowrap py-1 pl-3 font-semibold">
                  <Link href={`/kader/${s.pid}`} className="hover:text-tint">
                    {s.name}
                  </Link>
                </td>
                <td className="py-1 pl-2 text-right tabular-nums text-label-2">{s.alter ?? "n. v."}</td>
                <td className="whitespace-nowrap py-1 pl-3 [&_span]:!text-[9.5px]">
                  <ScoutAbzeichen e={s.scout} mitSternen />
                </td>
                {extra && <td className="py-1 pl-3">{extra.zelle(s)}</td>}
                <td className="whitespace-nowrap py-1 pl-2 text-center text-[12px] text-label-2">{b ? `${KURZ[b.p] ?? b.p}` : "–"}</td>
                {POSITIONEN.map((p) => {
                  const w = werte[p];
                  return (
                    <td key={p} className="py-[3px] pl-1.5 text-center">
                      <span
                        className={`inline-block w-[3.1rem] rounded-[6px] py-[3px] text-[13px] tabular-nums ${w.ok ? stufe(w.wert).cls : "text-label-3"} ${
                          w.ok && b && w.wert === b.wert ? "font-bold ring-2 ring-label/70 ring-inset" : ""
                        }`}
                        title={w.ok ? `${p}: ${stufe(w.wert).name}${b && w.wert === b.wert ? ", bester Wert dieses Spielers" : ""}` : undefined}
                      >
                        {w.ok ? w.wert.toFixed(2) : "n. v."}
                      </span>
                    </td>
                  );
                })}
                <td className="py-1 pr-3 pl-3">
                  <span className="flex flex-wrap gap-1 [&_span]:!text-[9.5px]">
                    <StatusBadges s={s} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// Top N je Position: die Spieler mit dem höchsten MZ-Wert in dieser Rolle
export function TopJePosition({ kader, n = 5 }: { kader: KaderZeile[]; n?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {POSITIONEN.map((p) => {
        const liste = kader
          .flatMap((s) => {
            const w = alleMzWerte(s.skills)[p];
            return w.ok ? [{ s, wert: w.wert }] : [];
          })
          .sort((a, b) => b.wert - a.wert)
          .slice(0, n);
        return (
          <Card key={p} className="p-3">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-label-2">{p}</div>
            <ol className="space-y-1">
              {liste.map(({ s, wert }, i) => (
                <li key={s.pid} className="flex items-center gap-2 text-[13.5px]">
                  <span className="w-4 text-right tabular-nums text-label-3">{i + 1}</span>
                  <Link href={`/kader/${s.pid}`} className="min-w-0 flex-1 truncate font-medium hover:text-tint">
                    {s.name}
                  </Link>
                  <span className="flex gap-1 [&_span]:!text-[9px]">
                    <StatusBadges s={s} />
                  </span>
                  <span className={`w-[3.1rem] rounded-[6px] py-[2px] text-center tabular-nums ${stufe(wert).cls}`}>{wert.toFixed(2)}</span>
                </li>
              ))}
              {liste.length === 0 && <li className="text-[13px] text-label-3">Keine Werte</li>}
            </ol>
          </Card>
        );
      })}
    </div>
  );
}
