import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadges, statusHinweis } from "@/components/status";
import { stufe, WertLegende } from "@/components/wert-stufe";
import { List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader, type KaderEintrag } from "@/lib/db/kader";
import { alleMzWerte, POSITIONEN } from "@/lib/mz/formel";
import { KADER_START, QUELLE_KADER } from "@/lib/wissen/startbasis";
import { datumZeit } from "@/lib/format";
import { ScoutAbzeichen } from "@/components/scout-abzeichen";
import { ladeKombis, rangSortierung, scoutEinstufung } from "@/lib/scout";
import { ScoutBestaetigen } from "./scout-bestaetigen";
import { KaderTabelle, mitParam, sortiere, TopJePosition, type KaderZeile, type Sortierung } from "@/components/kader-tabelle";
import { sperreGiltFuerLiga } from "@/lib/mz/taktik/erzeugen";

// Sortierung über ?sort=, Filter über ?scout=, ?gruppe=, ?alter=, ?nur=, Ansicht über ?ansicht= (Marcus, 31.10.2026:
// sortieren z. B. nach höchstem MZ-Wert, Top 5 je Position, weitere passende Filter)
type Zeile = KaderZeile;
const SORTIERUNGEN: Sortierung[] = ["nr", "alter", "scout", "bester", ...POSITIONEN];
const aufstellbar = (s: KaderEintrag) => !s.status?.verletzt && !(s.status?.gesperrt && sperreGiltFuerLiga(s)) && s.status?.aufstellbar !== false;

// Seite Kader
export default async function Kader(props: PageProps<"/kader">) {
  await connection();
  const db = getDb();
  const kombis = ladeKombis(db);
  const alleSpieler: Zeile[] = ladeKader(db).map((s) => ({ ...s, scout: scoutEinstufung(s, kombis) }));
  const params = await props.searchParams;
  const p1 = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const roh = p1("sort");
  const sort: Sortierung = roh && (SORTIERUNGEN as string[]).includes(roh) ? (roh as Sortierung) : "nr";
  const ansicht = p1("ansicht") === "top5" ? "top5" : "tabelle";
  const gruppe = p1("gruppe"); // profis | jugend
  const alterF = p1("alter"); // u22 | 22-29 | 30
  const nur = p1("nur"); // aufstellbar | ausfall | ausdauer
  const aktuell = { sort: sort === "nr" ? undefined : sort, scout: p1("scout"), ansicht: ansicht === "top5" ? "top5" : undefined, gruppe, alter: alterF, nur };
  const link = (aenderung: Record<string, string | undefined>) => mitParam("/kader", aktuell, aenderung);
  // Filter ?scout=1…6 | unbekannt | loyal | keiner
  const filter = typeof params.scout === "string" ? params.scout : undefined;
  const passt = (z: Zeile) =>
    !filter ? true : /^[1-9]$/.test(filter) ? z.scout.rang === Number(filter) && z.scout.status !== "unbekannt" : z.scout.status === filter;
  const passtWeitere = (z: Zeile) =>
    (gruppe !== "profis" || (z.nr ?? 0) < 100) &&
    (gruppe !== "jugend" || (z.nr ?? 0) >= 100) &&
    (alterF !== "u22" || (z.alter ?? 99) < 22) &&
    (alterF !== "22-29" || ((z.alter ?? 0) >= 22 && (z.alter ?? 0) <= 29)) &&
    (alterF !== "30" || (z.alter ?? 0) >= 30) &&
    (nur !== "aufstellbar" || aufstellbar(z)) &&
    (nur !== "ausfall" || !aufstellbar(z)) &&
    (nur !== "ausdauer" || (z.skills.ausdauer?.wert ?? 10) < 8);
  const kader = alleSpieler.filter((z) => passt(z) && passtWeitere(z));
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
  const chip = (href: string, aktiv: boolean, label: string, n?: number) => (
    <Link
      key={label}
      href={href}
      scroll={false}
      className={`rounded-full border px-2.5 py-0.5 ${aktiv ? "border-tint bg-tint/10 text-tint" : "border-separator text-label-2 hover:text-label"}`}
    >
      {label}
      {n !== undefined && <span className="ml-1 tabular-nums text-label-3">{n}</span>}
    </Link>
  );
  const filterLink = (wert: string | undefined, label: string, n: number) => chip(link({ scout: wert }), filter === wert, label, n);
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
              <span className="font-semibold">
                {unbekannt.length} Scoutbericht{unbekannt.length === 1 ? "" : "e"} unbekannt
              </span>
              <span className="hidden text-label-2 sm:inline">Sterne und Text passen nicht zusammen. Nicht geraten: bitte prüfen.</span>
              <span className="ml-auto text-[12px] font-semibold uppercase tracking-wider text-red group-open:hidden">Prüfen</span>
              <span className="ml-auto hidden text-[12px] font-semibold uppercase tracking-wider text-label-2 group-open:inline">Zuklappen</span>
            </summary>
            <div className="border-t border-red/20 p-3">
              <ScoutBestaetigen
                faelle={unbekannt.map((z) => ({
                  pid: z.pid,
                  name: z.name,
                  sterne: z.scout.sterne,
                  grund: z.scout.grund ?? "",
                  text: z.scoutText,
                  hoch: z.scoutSterne?.hoch,
                  niedrig: z.scoutSterne?.niedrig,
                }))}
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
            .map((k) =>
              filterLink(
                String(k.rang),
                `${k.rang} ${k.abzeichen}`,
                anzahl((z) => z.scout.rang === k.rang && z.scout.status !== "unbekannt"),
              ),
            )}
          {filterLink("unbekannt", "Unbekannt", unbekannt.length)}
          {filterLink(
            "loyal",
            "Loyal",
            anzahl((z) => z.scout.status === "loyal"),
          )}
          {filterLink(
            "keiner",
            "Ohne Bericht",
            anzahl((z) => z.scout.status === "keiner"),
          )}
        </div>
        <div className="-mx-4 mb-2 flex items-center gap-1.5 overflow-x-auto px-4 text-[13px] whitespace-nowrap sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <span className="mr-1 text-label-2">Ansicht:</span>
          {chip(link({ ansicht: undefined }), ansicht === "tabelle", "Tabelle")}
          {chip(link({ ansicht: "top5" }), ansicht === "top5", "Top 5 je Position")}
          <span className="mx-2 text-label-3">|</span>
          <span className="mr-1 text-label-2">Sortieren:</span>
          {chip(link({ sort: undefined }), sort === "nr", "Nummer")}
          {chip(link({ sort: "bester" }), sort === "bester", "Höchster MZ-Wert")}
          {chip(link({ sort: "alter" }), sort === "alter", "Alter")}
          {chip(link({ sort: "scout" }), sort === "scout", "Scout-Rang")}
        </div>
        <div className="-mx-4 mb-4 flex items-center gap-1.5 overflow-x-auto px-4 text-[13px] whitespace-nowrap sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <span className="mr-1 text-label-2">Filter:</span>
          {chip(link({ gruppe: undefined }), !gruppe, "Alle")}
          {chip(
            link({ gruppe: "profis" }),
            gruppe === "profis",
            "Profis (Nr. < 100)",
            anzahl((z) => (z.nr ?? 0) < 100),
          )}
          {chip(
            link({ gruppe: "jugend" }),
            gruppe === "jugend",
            "Jugend (Nr. ≥ 100)",
            anzahl((z) => (z.nr ?? 0) >= 100),
          )}
          <span className="mx-2 text-label-3">|</span>
          {chip(link({ alter: undefined }), !alterF, "Jedes Alter")}
          {chip(
            link({ alter: "u22" }),
            alterF === "u22",
            "unter 22",
            anzahl((z) => (z.alter ?? 99) < 22),
          )}
          {chip(
            link({ alter: "22-29" }),
            alterF === "22-29",
            "22 bis 29",
            anzahl((z) => (z.alter ?? 0) >= 22 && (z.alter ?? 0) <= 29),
          )}
          {chip(
            link({ alter: "30" }),
            alterF === "30",
            "ab 30",
            anzahl((z) => (z.alter ?? 0) >= 30),
          )}
          <span className="mx-2 text-label-3">|</span>
          {chip(link({ nur: undefined }), !nur, "Jeder Status")}
          {chip(link({ nur: "aufstellbar" }), nur === "aufstellbar", "nur aufstellbar", anzahl(aufstellbar))}
          {chip(
            link({ nur: "ausfall" }),
            nur === "ausfall",
            "Ausfälle",
            anzahl((z) => !aufstellbar(z)),
          )}
          {chip(
            link({ nur: "ausdauer" }),
            nur === "ausdauer",
            "Ausdauer unter 8",
            anzahl((z) => (z.skills.ausdauer?.wert ?? 10) < 8),
          )}
        </div>
        {ansicht === "top5" && (
          <Section
            footer={`Je Position die 5 Spieler mit dem höchsten MZ-Wert (Formel aus mz-wissen.md, Abschnitt 6), mit den gewählten Filtern. ${kader.length} Spieler berücksichtigt.`}
          >
            <TopJePosition kader={kader} />
          </Section>
        )}
        {/* Desktop: Tabelle mit dem MZ-Wert jeder Position, bester Wert hervorgehoben */}
        <div className={ansicht === "top5" ? "hidden" : "hidden lg:block"}>
          <Section
            footer={`MZ-Wert je Position nach der Formel aus mz-wissen.md, Abschnitt 6. Umrandet = bester Wert des Spielers. Farbe = feste Stufe (Legende über der Tabelle), eine Lesehilfe dieser Seite, keine Einstufung von ManagerZone. ${statusHinweis(kader)}`}
          >
            <WertLegende />
            <div className="mt-3">
              <KaderTabelle kader={sortiere(kader, sort, rangSortierung)} sort={sort} link={(x) => link({ sort: x === "nr" ? undefined : x })} />
            </div>
          </Section>
        </div>
        <div className={ansicht === "top5" ? "hidden" : "lg:hidden"}>
          <Section
            footer={`Wert = höchster MZ-Wert über alle Positionen (Formel aus mz-wissen.md, Abschnitt 6). Farbe = feste Stufe, eine Lesehilfe dieser Seite. ${statusHinweis(kader)}`}
          >
            <WertLegende />
            <div className="mt-3" />
            <List>
              {sortiere(kader, sort, rangSortierung).map((s) => {
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
                        <span className="block text-[13px] text-label-2">{s.alter !== undefined ? `${s.alter} J.` : "Alter nicht verfügbar"}</span>
                      </span>
                      <span className="text-right">
                        {beste ? (
                          <>
                            <span className={`block rounded-[8px] px-2 py-0.5 text-[17px] font-semibold tabular-nums ${stufe(beste.wert).cls}`}>
                              {beste.wert.toFixed(2)}
                            </span>
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
