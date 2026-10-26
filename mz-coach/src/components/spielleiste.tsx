import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { heuteInBerlin } from "@/lib/format";
import { letzterGegner } from "@/lib/gegner-analyse";
import { naechsterLigaspieltag, TEAM } from "@/lib/wissen/startbasis";

// Leiste oben wie der Spielbalken in Manager-Spielen: nächstes Ligaspiel und die zuletzt analysierte Taktik.
// Ob der zuletzt eingelesene Gegner wirklich der nächste ist, ist ohne Spielplan-Abruf nicht belegt, deshalb
// steht er als "zuletzt analysiert" da, nicht als Gegner des nächsten Spiels.
export async function Spielleiste() {
  await connection();
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const tag = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(spieltag);
  let gegner: { tid: number; name: string; taktik?: string } | null = null;
  try {
    const g = letzterGegner(getDb());
    if (g) gegner = { tid: g.tid, name: g.name, taktik: g.analyse?.empfehlung.taktik };
  } catch {
    gegner = null;
  }
  return (
    <div className="sticky top-0 z-20 hidden border-b border-separator bg-bar backdrop-blur-xl lg:block">
      <div className="flex h-12 items-center gap-6 px-10 text-[13px]">
        <span className="flex items-center gap-2">
          <span className="kapitaelchen !text-[10px] !text-label-3">Nächstes Ligaspiel</span>
          <span className="display text-[17px] font-bold uppercase text-label">{tag}</span>
        </span>
        <span className="h-5 w-px bg-separator" />
        {gegner ? (
          <Link href={`/gegner/${gegner.tid}`} className="flex items-center gap-2 hover:text-label">
            <span className="kapitaelchen !text-[10px] !text-label-3">Zuletzt analysiert</span>
            <span className="font-semibold text-label">{gegner.name}</span>
            {gegner.taktik && <span className="rounded-[4px] bg-tint/15 px-1.5 py-[1px] text-[11px] font-bold uppercase tracking-wider text-tint-hell">{gegner.taktik}</span>}
          </Link>
        ) : (
          <span className="text-label-3">Noch kein Gegner analysiert</span>
        )}
        <span className="ml-auto text-label-3">{TEAM.name} · {TEAM.liga}</span>
      </div>
    </div>
  );
}
