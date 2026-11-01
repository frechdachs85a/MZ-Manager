import type Database from "better-sqlite3";
import Link from "next/link";
import { Card, Section, Unavailable } from "@/components/ui";
import { datumZeit } from "@/lib/format";
import { gespeicherteTabelle, ligaTeamZusatz, sortiereTabelle, type TabellenSortierung, type TeamZusatz } from "@/lib/liga-teams";
import { TEAM } from "@/lib/wissen/startbasis";

const mio = (n: number) => `${(n / 1_000_000).toFixed(1).replace(".", ",")} Mio`;

// Zelle Startelf-Wert: Summe der Marktwerte der Elf aus dem letzten Ligaspiel; fehlende Werte genannt
function WertZelle({ x }: { x?: TeamZusatz }) {
  const w = x?.wert;
  if (!w || w.mitWert === 0) return <span className="text-label-3">n. v.</span>;
  return (
    <span
      title={`Elf aus mid ${w.mid}${w.datum ? ` (${w.datum})` : ""}; ${w.mitWert} von ${w.spieler} Spielern mit Marktwert${w.kaderStand ? `, Kaderseite vom ${datumZeit(w.kaderStand)}` : ""}`}
    >
      {mio(w.summe)}
      {w.mitWert < w.spieler && <span className="text-orange"> ({w.mitWert}/{w.spieler})</span>}
    </span>
  );
}

// Spaltennamen von ManagerZone ausgeschrieben (G = gewonnen, V = verloren, + Tore, - Gegentore, = Tordifferenz)
const KOPF: Record<string, { kurz: string; lang: string }> = {
  "": { kurz: "Pl.", lang: "Platz" },
  Sp: { kurz: "Sp", lang: "Spiele" },
  G: { kurz: "S", lang: "Siege" },
  U: { kurz: "U", lang: "Unentschieden" },
  V: { kurz: "N", lang: "Niederlagen" },
  "+": { kurz: "Tore", lang: "Erzielte Tore" },
  "-": { kurz: "Gegent.", lang: "Gegentore" },
  "=": { kurz: "Diff.", lang: "Tordifferenz" },
  Pkt: { kurz: "Pkt", lang: "Punkte" },
};

// Ligatabelle wie ManagerZone sie zeigt, eigenes Team hervorgehoben (Zentrale und Saison; Marcus 31.10.2026: in der
// Saison sehen, wo ich stehe und wo die anderen)
// Sortierung über ?tabelle=wert|rang (Marcus, 31.10.2026: nach Punkten, Marktwert der Startelf und Rangliste)
export function LigaTabelle({
  db,
  titel = "Tabelle",
  sort = "punkte",
  basis,
}: {
  db: Database.Database;
  titel?: string;
  sort?: TabellenSortierung;
  basis?: string;
}) {
  const { tabelle, stand, gespeichert } = gespeicherteTabelle(db);
  const zusatz = tabelle ? ligaTeamZusatz(db, tabelle) : new Map<number, TeamZusatz>();
  const mitRang = [...zusatz.values()].some((x) => x.rang !== null);
  const zeilen = tabelle ? sortiereTabelle(tabelle.zeilen, sort, zusatz) : [];
  const chip = (s: TabellenSortierung, label: string) => (
    <Link
      key={s}
      href={`${basis ?? ""}${s === "punkte" ? "?" : `?tabelle=${s}`}`}
      scroll={false}
      className={`rounded-full border px-2.5 py-0.5 ${sort === s ? "border-tint bg-tint/10 text-tint" : "border-separator text-label-2 hover:text-label"}`}
    >
      {label}
    </Link>
  );
  return (
    <Section
      title={titel}
      footer={
        stand
          ? `Stand ${datumZeit(stand)}, so wie ManagerZone sie zeigt. Startelf-Wert = Marktwerte der Elf aus dem letzten Ligaspiel des Teams (laut „Letzte 6 Spiele“), Werte von der gespeicherten Kaderseite des Teams. ${mitRang ? "" : "Weltrang: Quelle wird noch geprüft, bis dahin n. v."}`
          : undefined
      }
    >
      {tabelle &&
        (() => {
          const eigen = tabelle.zeilen.find((z) => z.eigen);
          return eigen ? (
            <p className="mb-2 text-[14px]">
              <b>{TEAM.name}</b> steht auf Platz <b>{eigen.zellen[0]}</b>
              {tabelle.kopf.includes("Pkt") ? ` mit ${eigen.zellen[tabelle.kopf.indexOf("Pkt")]} Punkten` : ""} ({tabelle.zeilen.length} Teams).
            </p>
          ) : null;
        })()}
      {tabelle && basis !== undefined && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="mr-1 text-label-2">Sortieren:</span>
          {chip("punkte", "Punkte")}
          {chip("wert", "Startelf-Wert")}
          {chip("rang", "Weltrang")}
        </div>
      )}
      {tabelle ? (
        <Card className="!overflow-x-auto">
          <table className="w-full text-[13.5px]">
            {tabelle.kopf.length > 0 && (
              <thead>
                <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                  {tabelle.kopf.map((k, i) => (
                    <th key={i} className="px-3 py-2 font-semibold first:pl-4 last:pr-4" title={KOPF[k]?.lang ?? k}>
                      {KOPF[k]?.kurz ?? k}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold" title="Marktwert der Startelf im letzten Ligaspiel">
                    Startelf-Wert
                  </th>
                  <th className="px-3 py-2 pr-4 font-semibold" title="Platz in der Weltrangliste">
                    Weltrang
                  </th>
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-separator">
              {zeilen.map((z, i) => (
                <tr key={i} className={z.eigen ? "bg-tint/[0.12] font-semibold text-label" : "text-label-2"}>
                  {z.zellen.map((c, j) =>
                    tabelle.kopf[j] === "Letzte 6 Spiele" && z.letzte ? (
                      <td key={j} className="px-3 py-1.5 last:pr-4">
                        <span className="flex gap-1">
                          {z.letzte.map((l, k) => (
                            <span
                              key={k}
                              title={l.titel}
                              className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white ${
                                l.ergebnis === "S" ? "bg-green" : l.ergebnis === "N" ? "bg-red" : "bg-label-3"
                              }`}
                            >
                              {l.ergebnis}
                            </span>
                          ))}
                        </span>
                      </td>
                    ) : (
                      <td key={j} className="px-3 py-1.5 tabular-nums first:pl-4 last:pr-4">
                        {c}
                      </td>
                    ),
                  )}
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                    <WertZelle x={z.tid ? zusatz.get(z.tid) : undefined} />
                  </td>
                  <td className="px-3 py-1.5 pr-4 tabular-nums">
                    {(z.tid && zusatz.get(z.tid)?.rang) ?? <span className="text-label-3">n. v.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Unavailable
          title={TEAM.liga}
          reason={
            gespeichert && stand
              ? `Tabellenseite vom ${datumZeit(stand)} gespeichert, aber keine Tabelle mit ${TEAM.name} darin erkannt.`
              : "Wird mit der Spieltag-Analyse 3 Stunden nach jedem Anstoß geholt."
          }
        />
      )}
    </Section>
  );
}
