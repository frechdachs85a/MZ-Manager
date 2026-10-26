import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadges, statusHinweis } from "@/components/status";
import { stufe, WertLegende } from "@/components/wert-stufe";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader, type KaderEintrag } from "@/lib/db/kader";
import { alleMzWerte, POSITIONEN, type Position } from "@/lib/mz/formel";
import { KADER_START, QUELLE_KADER } from "@/lib/wissen/startbasis";
import { datumZeit } from "@/lib/format";
import { ScoutAbzeichen } from "@/components/scout-abzeichen";
import { ladeKombis, rangSortierung, scoutEinstufung, type ScoutEinstufung } from "@/lib/scout";
import { ScoutBestaetigen } from "./scout-bestaetigen";

// Sortierung der Desktop-Tabelle über ?sort=<Spalte> (Nr, Alter oder eine Position absteigend, Scout nach Rang)
type Sortierung = "nr" | "alter" | "scout" | Position;
type Zeile = KaderEintrag & { scout: ScoutEinstufung };
function sortiere(kader: Zeile[], sort: Sortierung): Zeile[] {
  if (sort === "nr") return kader;
  if (sort === "scout") return [...kader].sort((a, b) => rangSortierung(a.scout) - rangSortierung(b.scout) || (a.nr ?? 0) - (b.nr ?? 0));
  const wert = (s: KaderEintrag) => {
    if (sort === "alter") return s.alter ?? -1;
    const w = alleMzWerte(s.skills)[sort];
    return w.ok ? w.wert : -1;
  };
  return [...kader].sort((a, b) => wert(b) - wert(a));
}

// Seite Kader
export default async function Kader(props: PageProps<"/kader">) {
  await connection();
  const db = getDb();
  const kombis = ladeKombis(db);
  const alleSpieler: Zeile[] = ladeKader(db).map((s) => ({ ...s, scout: scoutEinstufung(s, kombis) }));
  const params = await props.searchParams;
  const roh = params.sort;
  const sort: Sortierung = typeof roh === "string" && (roh === "alter" || roh === "scout" || (POSITIONEN as readonly string[]).includes(roh)) ? (roh as Sortierung) : "nr";
  // Filter ?scout=1…6 | unbekannt | loyal | keiner
  const filter = typeof params.scout === "string" ? params.scout : undefined;
  const passt = (z: Zeile) =>
    !filter ? true : /^[1-9]$/.test(filter) ? z.scout.rang === Number(filter) && z.scout.status !== "unbekannt" : z.scout.status === filter;
  const kader = alleSpieler.filter(passt);
  const unbekannt = alleSpieler.filter((z) => z.scout.status === "unbekannt");

  if (alleSpieler.length === 0) {
    return (
      <>
        <PageHeader title="Kader" subtitle={`${KADER_START.length} Spieler, noch kein Live-Abruf`} />
        <div className="seite">
          <Section
            title="Startbasis"
            footer={`Quelle: ${QUELLE_KADER}. Nur die dort notierten Skills, daher noch keine MZ-Werte. Alle Skills, Rot/Schwarz, Scout-Sterne und Status kommen mit dem ersten Abruf von ManagerZone.`}
          >
            <List>
              {KADER_START.map((s) => (
                <Row
                  key={s.pid}
                  title={
                    <span className="flex items-baseline gap-2">
                      <span className="w-6 shrink-0 text-right text-[15px] tabular-nums text-label-2">{s.nr}</span>
                      <span className="font-medium">{s.name}</span>
                    </span>
                  }
                  detail={<span className="block pl-8">{s.info || "keine Skills notiert"}</span>}
                  value={<span className="tabular-nums">{s.alter} J.</span>}
                />
              ))}
            </List>
          </Section>
        </div>
      </>
    );
  }

  const stand = alleSpieler.reduce((m, s) => (s.abgerufen > m ? s.abgerufen : m), "");
  const filterLink = (wert: string | undefined, label: string, n: number) => {
    const q = new URLSearchParams();
    if (sort !== "nr") q.set("sort", sort);
    if (wert) q.set("scout", wert);
    const aktiv = filter === wert;
    return (
      <Link key={label} href={`/kader${q.size ? `?${q}` : ""}`} scroll={false} className={`rounded-full border px-2.5 py-0.5 ${aktiv ? "border-tint text-tint" : "border-separator text-label-2 hover:text-label"}`}>
        {label} <span className="tabular-nums text-label-3">{n}</span>
      </Link>
    );
  };
  const anzahl = (f: (z: Zeile) => boolean) => alleSpieler.filter(f).length;
  return (
    <>
      <PageHeader title="Kader" subtitle={`${alleSpieler.length} Spieler · Stand ${datumZeit(stand)}`} />
      <div className="seite">
        {unbekannt.length > 0 && (
          // Hinweisbalken statt großer Liste: aufklappen nur bei Bedarf
          <details className="group mt-6 rounded-[10px] border border-red/30 bg-red/[0.07]">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-[14px]">
              <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-red text-[11px] font-bold text-auf-akzent">!</span>
              <span className="font-semibold">{unbekannt.length} Scoutbericht{unbekannt.length === 1 ? "" : "e"} unbekannt</span>
              <span className="hidden text-label-2 sm:inline">Sterne und Text passen nicht zusammen. Nicht geraten: bitte prüfen.</span>
              <span className="ml-auto text-[12px] font-semibold uppercase tracking-wider text-red group-open:hidden">Prüfen</span>
              <span className="ml-auto hidden text-[12px] font-semibold uppercase tracking-wider text-label-2 group-open:inline">Zuklappen</span>
            </summary>
            <div className="border-t border-red/20 p-3">
              <ScoutBestaetigen
              faelle={unbekannt.map((z) => ({ pid: z.pid, name: z.name, sterne: z.scout.sterne, grund: z.scout.grund ?? "", text: z.scoutText, hoch: z.scoutSterne?.hoch, niedrig: z.scoutSterne?.niedrig }))}
            />
            </div>
          </details>
        )}
        <div className="-mx-4 mt-4 mb-4 flex items-center gap-1.5 overflow-x-auto px-4 text-[13px] whitespace-nowrap sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <span className="mr-1 text-label-2">Scout:</span>
          {filterLink(undefined, "Alle", alleSpieler.length)}
          {kombis
            .filter((k, i, a) => a.findIndex((x) => x.rang === k.rang) === i)
            .sort((a, b) => a.rang - b.rang)
            .map((k) => filterLink(String(k.rang), `${k.rang} ${k.abzeichen}`, anzahl((z) => z.scout.rang === k.rang && z.scout.status !== "unbekannt")))}
          {filterLink("unbekannt", "Unbekannt", unbekannt.length)}
          {filterLink("loyal", "Loyal", anzahl((z) => z.scout.status === "loyal"))}
          {filterLink("keiner", "Ohne Bericht", anzahl((z) => z.scout.status === "keiner"))}
        </div>
        {/* Desktop: Tabelle mit dem MZ-Wert jeder Position, bester Wert hervorgehoben */}
        <div className="hidden lg:block">
          <Section footer={`MZ-Wert je Position nach der Formel aus mz-wissen.md, Abschnitt 6. Umrandet = bester Wert des Spielers. Farbe = feste Stufe (Legende über der Tabelle), eine Lesehilfe dieser Seite, keine Einstufung von ManagerZone. ${statusHinweis(kader)}`}>
            <WertLegende />
            <div className="mt-3">
              <KaderTabelle kader={sortiere(kader, sort)} sort={sort} />
            </div>
          </Section>
        </div>
        <div className="lg:hidden">
        <Section footer={`Wert = höchster MZ-Wert über alle Positionen (Formel aus mz-wissen.md, Abschnitt 6). Farbe = feste Stufe, eine Lesehilfe dieser Seite. ${statusHinweis(kader)}`}>
          <WertLegende />
          <div className="mt-3" />
          <List>
            {sortiere(kader, sort).map((s) => {
              const werte = alleMzWerte(s.skills);
              const beste = POSITIONEN.flatMap((p) => {
                const w = werte[p];
                return w.ok ? [{ p, wert: w.wert }] : [];
              }).sort((a, b) => b.wert - a.wert)[0];
              return (
                <li key={s.pid} className="!px-0">
                  <Link href={`/kader/${s.pid}`} className="pressable zeile-hover flex min-h-12 items-center gap-3 py-3 pl-5 pr-4">
                    <span className="w-6 shrink-0 text-right text-[15px] tabular-nums text-label-2">{s.nr ?? ""}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-[17px] font-medium">
                        {s.name}
                        <ScoutAbzeichen e={s.scout} />
                        <StatusBadges s={s} />
                      </span>
                      <span className="block text-[13px] text-label-2">
                        {s.alter !== undefined ? `${s.alter} J.` : "Alter nicht verfügbar"}
                      </span>
                    </span>
                    <span className="text-right">
                      {beste ? (
                        <>
                          <span className={`block rounded-[8px] px-2 py-0.5 text-[17px] font-semibold tabular-nums ${stufe(beste.wert).cls}`}>{beste.wert.toFixed(2)}</span>
                          <span className="block text-[12px] text-label-2">{beste.p}</span>
                        </>
                      ) : (
                        <span className="text-[13px] text-label-2">MZ-Wert n. v.</span>
                      )}
                    </span>
                    <svg viewBox="0 0 8 14" className="h-3.5 w-2 text-label-3" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m1 1 6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </List>
        </Section>
        </div>
      </div>
    </>
  );
}

function SpaltenKopf({ label, wert, sort, rechts = true }: { label: string; wert: Sortierung; sort: Sortierung; rechts?: boolean }) {
  const aktiv = sort === wert;
  return (
    <Link
      href={wert === "nr" ? "/kader" : `/kader?sort=${encodeURIComponent(wert)}`}
      scroll={false}
      className={`inline-flex items-center gap-1 ${rechts ? "justify-end" : ""} ${aktiv ? "text-tint" : "hover:text-label"}`}
      title={wert === "nr" ? "Nach Nummer" : wert === "scout" ? "Nach Scout-Rang (1 = beste)" : `Nach ${label} sortieren (absteigend)`}
    >
      {label}
      {aktiv && wert !== "nr" && <span aria-hidden>↓</span>}
    </Link>
  );
}

// Kompakt (Marcus, 26.10.2026): passt ohne Querscrollen ab etwa 1200 px Fensterbreite (auch mit Browser-Zoom);
// darunter scrollt die Tabelle quer. Kein fester Tabellenkopf: der verträgt sich nicht mit dem Querscrollen.
const KURZ: Record<string, string> = { Anchorman: "Anch." };

function KaderTabelle({ kader, sort }: { kader: Zeile[]; sort: Sortierung }) {
  return (
    <Card className="!overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-separator bg-card-2 text-[10.5px] uppercase tracking-wider text-label-3">
            <th className="w-8 py-2 pl-3 text-right font-semibold"><SpaltenKopf label="Nr" wert="nr" sort={sort} /></th>
            <th className="py-2 pl-3 font-semibold">Name</th>
            <th className="py-2 pl-2 text-right font-semibold"><SpaltenKopf label="Alter" wert="alter" sort={sort} /></th>
            <th className="py-2 pl-3 font-semibold"><SpaltenKopf label="Scout" wert="scout" sort={sort} rechts={false} /></th>
            {POSITIONEN.map((p) => (
              <th key={p} className="py-2 pl-1.5 text-center font-semibold" title={p}><SpaltenKopf label={KURZ[p] ?? p} wert={p} sort={sort} /></th>
            ))}
            <th className="py-2 pr-3 pl-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {kader.map((s) => {
            const werte = alleMzWerte(s.skills);
            const max = Math.max(...POSITIONEN.map((p) => { const w = werte[p]; return w.ok ? w.wert : -1; }));
            return (
              <tr key={s.pid} className="zeile-hover transition-colors">
                <td className="py-1 pl-3 text-right tabular-nums text-label-3">{s.nr ?? ""}</td>
                <td className="whitespace-nowrap py-1 pl-3 font-semibold">
                  <Link href={`/kader/${s.pid}`} className="hover:text-tint">{s.name}</Link>
                </td>
                <td className="py-1 pl-2 text-right tabular-nums text-label-2">{s.alter ?? "n. v."}</td>
                <td className="whitespace-nowrap py-1 pl-3 [&_span]:!text-[9.5px]"><ScoutAbzeichen e={s.scout} mitSternen /></td>
                {POSITIONEN.map((p) => {
                  const w = werte[p];
                  return (
                    <td key={p} className="py-[3px] pl-1.5 text-center">
                      <span
                        className={`inline-block w-[3.1rem] rounded-[6px] py-[3px] text-[13px] tabular-nums ${w.ok ? stufe(w.wert).cls : "text-label-3"} ${
                          w.ok && w.wert === max ? "font-bold ring-2 ring-label/70 ring-inset" : ""
                        }`}
                        title={w.ok ? `${p}: ${stufe(w.wert).name}${w.wert === max ? ", bester Wert dieses Spielers" : ""}` : undefined}
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
