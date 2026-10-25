// Gegenüberstellung zweier Teamwerte als Balken. Zahlen stehen immer als Text daneben,
// die Farbe trägt nur die Zuordnung (eigenes Team Akzent, anderes Team grau).
const zahl = (v?: string) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

export function StatVergleich({
  zeilen,
  links,
  rechts,
  akzent,
}: {
  zeilen: { label: string; links?: string; rechts?: string }[];
  links: string;
  rechts: string;
  akzent: "links" | "rechts";
}) {
  const farbe = (seite: "links" | "rechts") => (seite === akzent ? "bg-tint" : "bg-label-3");
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[13px] font-semibold">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${farbe("links")}`} />
          <span className="truncate">{links}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{rechts}</span>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${farbe("rechts")}`} />
        </span>
      </div>
      <ul className="divide-y divide-separator">
        {zeilen.map((z) => {
          const l = zahl(z.links);
          const r = zahl(z.rechts);
          const summe = (l ?? 0) + (r ?? 0);
          const anteil = l !== undefined && r !== undefined && summe > 0 ? l / summe : undefined;
          return (
            <li key={z.label} className="py-2">
              <div className="flex items-baseline justify-between text-[15px]">
                <span className={`w-12 tabular-nums ${l !== undefined && r !== undefined && l > r ? "font-semibold" : "text-label-2"}`}>
                  {z.links ?? "n. v."}
                </span>
                <span className="text-[13px] text-label-2">{z.label}</span>
                <span className={`w-12 text-right tabular-nums ${l !== undefined && r !== undefined && r > l ? "font-semibold" : "text-label-2"}`}>
                  {z.rechts ?? "n. v."}
                </span>
              </div>
              {anteil !== undefined && (
                <div className="mt-1.5 flex h-[6px] gap-[2px]" aria-hidden>
                  <span className={`rounded-l-full ${farbe("links")}`} style={{ width: `${anteil * 100}%` }} />
                  <span className={`flex-1 rounded-r-full ${farbe("rechts")}`} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
