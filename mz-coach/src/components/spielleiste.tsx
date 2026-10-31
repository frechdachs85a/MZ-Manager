import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { spieltagLage } from "@/lib/spieltag";
import { TEAM } from "@/lib/wissen/startbasis";

// Leiste oben wie der Spielbalken in Manager-Spielen: nächstes Ligaspiel laut Spielplan und der Taktikvorschlag.
export async function Spielleiste() {
  await connection();
  let l: ReturnType<typeof spieltagLage> | null = null;
  try {
    l = spieltagLage(getDb());
  } catch {
    l = null;
  }
  const lauf = l?.lauf;
  const zeit = lauf?.anstoss
    ? new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(lauf.anstoss))
    : null;
  return (
    <div className="sticky top-0 z-20 hidden border-b border-separator bg-bar backdrop-blur-xl lg:block">
      <div className="flex h-12 items-center gap-6 px-10 text-[13px]">
        {lauf?.gegnerName && zeit ? (
          <Link href="/spieltag" className="flex items-center gap-3 hover:text-label">
            <span className="kapitaelchen !text-[10px] !text-label-3">Nächstes Ligaspiel</span>
            <span className="display text-[17px] font-bold uppercase text-label">{zeit}</span>
            <span className="font-semibold text-label">
              {lauf.heim ? "gegen" : "bei"} {lauf.gegnerName}
            </span>
            {l?.vorschlag && (
              <span className="rounded-[4px] bg-tint px-2 py-[2px] text-[12px] font-bold uppercase tracking-wider text-auf-akzent">
                Vorschlag {l.vorschlag.taktik}
              </span>
            )}
          </Link>
        ) : (
          <Link href="/spieltag" className="text-label-3 hover:text-label">
            Nächstes Ligaspiel: Spielplan noch nicht abgerufen
          </Link>
        )}
        <span className="ml-auto text-label-3">
          {TEAM.name} · {TEAM.liga}
        </span>
      </div>
    </div>
  );
}
