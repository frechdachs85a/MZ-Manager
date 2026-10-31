import type Database from "better-sqlite3";
import { Card, Section, Unavailable } from "@/components/ui";
import { ladeRohseite, letzteRohseite } from "@/lib/db/abruf";
import { datumZeit } from "@/lib/format";
import { tabelleAus } from "@/lib/mz/parser/tabelle";
import { TEAM } from "@/lib/wissen/startbasis";

// Ligatabelle wie ManagerZone sie zeigt, eigenes Team hervorgehoben (Zentrale und Saison; Marcus 31.10.2026: in der
// Saison sehen, wo ich stehe und wo die anderen)
export function LigaTabelle({ db, titel = "Tabelle" }: { db: Database.Database; titel?: string }) {
  const tabRoh = letzteRohseite(db, "tabelle");
  const tabHtml = tabRoh ? (ladeRohseite(db, tabRoh.id, "dom") ?? ladeRohseite(db, tabRoh.id, "roh")) : null;
  const tabelle = tabHtml ? tabelleAus(tabHtml.html, TEAM.name) : null;
  return (
    <Section title={titel} footer={tabRoh ? `Stand ${datumZeit(tabRoh.abgerufen)}, so wie ManagerZone sie zeigt.` : undefined}>
      {tabelle ? (
        <Card className="!overflow-x-auto">
          <table className="w-full text-[13.5px]">
            {tabelle.kopf.length > 0 && (
              <thead>
                <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                  {tabelle.kopf.map((k, i) => (
                    <th key={i} className="px-3 py-2 font-semibold first:pl-4 last:pr-4">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-separator">
              {tabelle.zeilen.map((z, i) => (
                <tr key={i} className={z.eigen ? "bg-tint/[0.12] font-semibold text-label" : "text-label-2"}>
                  {z.zellen.map((c, j) => (
                    <td key={j} className="px-3 py-1.5 tabular-nums first:pl-4 last:pr-4">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Unavailable
          title={TEAM.liga}
          reason={
            tabRoh
              ? `Tabellenseite vom ${datumZeit(tabRoh.abgerufen)} gespeichert, aber keine Tabelle mit ${TEAM.name} darin erkannt.`
              : "Wird beim täglichen Abruf (ab 4 Uhr, mit Login) geholt."
          }
        />
      )}
    </Section>
  );
}
