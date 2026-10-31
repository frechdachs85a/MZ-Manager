import Link from "next/link";
import { ScoutAbzeichen } from "@/components/scout-abzeichen";
import { StatusBadges, statusHinweis } from "@/components/status";
import { List, Section } from "@/components/ui";
import { stufe, WertLegende } from "@/components/wert-stufe";
import { besterWert, KaderTabelle, mitParam, sortiere, TopJePosition, type KaderZeile, type Sortierung } from "@/components/kader-tabelle";
import type { KaderEintrag } from "@/lib/db/kader";
import { POSITIONEN, posDe } from "@/lib/mz/formel";
import { sperreGiltFuerLiga } from "@/lib/mz/taktik/erzeugen";
import { rangSortierung, type Kombi } from "@/lib/scout";

// Gemeinsame Ansicht für Kader und Jugend (Marcus, 31.10.2026: Jugend bis auf Behalten/Abgabe genau wie der Kader).
// Filter, Sortierung und Ansicht stehen in der Adresse (?scout=, ?gruppe=, ?alter=, ?nur=, ?sort=, ?ansicht=); ein
// aktiver Filter ist ein Schalter: noch einmal klicken hebt ihn auf.

const SORTIERUNGEN: Sortierung[] = ["nr", "alter", "scout", "bester", ...POSITIONEN];
export const aufstellbar = (s: KaderEintrag) => !s.status?.verletzt && !(s.status?.gesperrt && sperreGiltFuerLiga(s)) && s.status?.aufstellbar !== false;

export type Abschnitt = {
  titel: string;
  footer?: string;
  passt: (z: KaderZeile) => boolean;
  extra?: { titel: string; zelle: (z: KaderZeile) => React.ReactNode };
  leer?: string;
};

export function KaderAnsicht({
  basis,
  alle,
  params,
  kombis,
  ohneGruppe = false,
  abschnitte,
}: {
  basis: string;
  alle: KaderZeile[];
  params: Record<string, string | string[] | undefined>;
  kombis: Kombi[];
  ohneGruppe?: boolean;
  abschnitte?: Abschnitt[];
}) {
  const p1 = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const roh = p1("sort");
  const sort: Sortierung = roh && (SORTIERUNGEN as string[]).includes(roh) ? (roh as Sortierung) : "nr";
  const ansicht = p1("ansicht") === "top5" ? "top5" : "tabelle";
  const scout = p1("scout");
  const gruppe = ohneGruppe ? undefined : p1("gruppe");
  const alterF = p1("alter");
  const nur = p1("nur");
  const aktuell: Record<string, string | undefined> = {
    sort: sort === "nr" ? undefined : sort,
    scout,
    ansicht: ansicht === "top5" ? "top5" : undefined,
    gruppe,
    alter: alterF,
    nur,
  };
  const link = (aenderung: Record<string, string | undefined>) => mitParam(basis, aktuell, aenderung);

  const passt = (z: KaderZeile) =>
    (!scout || (/^[1-9]$/.test(scout) ? z.scout.rang === Number(scout) && z.scout.status !== "unbekannt" : z.scout.status === scout)) &&
    (gruppe !== "profis" || (z.nr ?? 0) < 100) &&
    (gruppe !== "jugend" || (z.nr ?? 0) >= 100) &&
    (alterF !== "u22" || (z.alter ?? 99) < 22) &&
    (alterF !== "22-29" || ((z.alter ?? 0) >= 22 && (z.alter ?? 0) <= 29)) &&
    (alterF !== "30" || (z.alter ?? 0) >= 30) &&
    (nur !== "aufstellbar" || aufstellbar(z)) &&
    (nur !== "ausfall" || !aufstellbar(z)) &&
    (nur !== "ausdauer" || (z.skills.ausdauer?.wert ?? 10) < 8);
  const kader = alle.filter(passt);
  const anzahl = (f: (z: KaderZeile) => boolean) => alle.filter(f).length;

  // Schalter: aktiv -> noch einmal klicken hebt den Parameter auf
  const chip = (param: string, wert: string | undefined, label: string, n?: number) => {
    const aktiv = wert === undefined ? aktuell[param] === undefined : aktuell[param] === wert;
    const href = link({ [param]: aktiv && wert !== undefined ? undefined : wert });
    return (
      <Link
        key={`${param}-${label}`}
        href={href}
        scroll={false}
        className={`rounded-full border px-2.5 py-0.5 ${aktiv ? "border-tint bg-tint/10 text-tint" : "border-separator text-label-2 hover:text-label"}`}
      >
        {label}
        {n !== undefined && <span className="ml-1 tabular-nums text-label-3">{n}</span>}
      </Link>
    );
  };
  const zeile = "-mx-4 mb-2 flex items-center gap-1.5 overflow-x-auto px-4 text-[13px] whitespace-nowrap sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0";
  const teile: Abschnitt[] = abschnitte ?? [{ titel: "", passt: () => true }];

  return (
    <>
      <div className={`${zeile} mt-4`}>
        <span className="mr-1 text-label-2">Scout:</span>
        {chip("scout", undefined, "Alle", alle.length)}
        {kombis
          .filter((k, i, a) => a.findIndex((x) => x.rang === k.rang) === i)
          .sort((a, b) => a.rang - b.rang)
          .map((k) =>
            chip(
              "scout",
              String(k.rang),
              `${k.rang} ${k.abzeichen}`,
              anzahl((z) => z.scout.rang === k.rang && z.scout.status !== "unbekannt"),
            ),
          )}
        {chip(
          "scout",
          "unbekannt",
          "Unbekannt",
          anzahl((z) => z.scout.status === "unbekannt"),
        )}
        {chip(
          "scout",
          "loyal",
          "Loyal",
          anzahl((z) => z.scout.status === "loyal"),
        )}
        {chip(
          "scout",
          "keiner",
          "Ohne Bericht",
          anzahl((z) => z.scout.status === "keiner"),
        )}
      </div>
      <div className={zeile}>
        <span className="mr-1 text-label-2">Ansicht:</span>
        {chip("ansicht", undefined, "Tabelle")}
        {chip("ansicht", "top5", "Top 5 je Position")}
        <span className="mx-2 text-label-3">|</span>
        <span className="mr-1 text-label-2">Sortieren:</span>
        {chip("sort", undefined, "Nummer")}
        {chip("sort", "bester", "Höchster MZ-Wert")}
        {chip("sort", "alter", "Alter")}
        {chip("sort", "scout", "Scout-Rang")}
      </div>
      <div className={`${zeile} mb-4`}>
        <span className="mr-1 text-label-2">Filter:</span>
        {!ohneGruppe && (
          <>
            {chip(
              "gruppe",
              "profis",
              "Profis (Nr. < 100)",
              anzahl((z) => (z.nr ?? 0) < 100),
            )}
            {chip(
              "gruppe",
              "jugend",
              "Jugend (Nr. ≥ 100)",
              anzahl((z) => (z.nr ?? 0) >= 100),
            )}
            <span className="mx-2 text-label-3">|</span>
          </>
        )}
        {chip(
          "alter",
          "u22",
          "unter 22",
          anzahl((z) => (z.alter ?? 99) < 22),
        )}
        {chip(
          "alter",
          "22-29",
          "22 bis 29",
          anzahl((z) => (z.alter ?? 0) >= 22 && (z.alter ?? 0) <= 29),
        )}
        {chip(
          "alter",
          "30",
          "ab 30",
          anzahl((z) => (z.alter ?? 0) >= 30),
        )}
        <span className="mx-2 text-label-3">|</span>
        {chip("nur", "aufstellbar", "nur aufstellbar", anzahl(aufstellbar))}
        {chip(
          "nur",
          "ausfall",
          "Ausfälle",
          anzahl((z) => !aufstellbar(z)),
        )}
        {chip(
          "nur",
          "ausdauer",
          "Ausdauer unter 8",
          anzahl((z) => (z.skills.ausdauer?.wert ?? 10) < 8),
        )}
      </div>

      {ansicht === "top5" ? (
        <Section
          footer={`Je Position die 5 Spieler mit dem höchsten MZ-Wert (Formel aus mz-wissen.md, Abschnitt 6), mit den gewählten Filtern. ${kader.length} Spieler berücksichtigt.`}
        >
          <TopJePosition kader={kader} />
        </Section>
      ) : (
        <>
          <WertLegende />
          {teile.map((t) => {
            const liste = sortiere(kader.filter(t.passt), sort, rangSortierung);
            return (
              <Section
                key={t.titel || "alle"}
                title={t.titel || undefined}
                footer={
                  t.footer ??
                  `MZ-Wert je Position nach der Formel aus mz-wissen.md, Abschnitt 6. Umrandet = bester Wert des Spielers. Farbe = feste Stufe, eine Lesehilfe dieser Seite. ${statusHinweis(liste)}`
                }
              >
                {liste.length === 0 ? (
                  <p className="text-[14px] text-label-2">{t.leer ?? "Keine Spieler mit diesen Filtern."}</p>
                ) : (
                  <>
                    <div className="hidden lg:block">
                      <KaderTabelle kader={liste} sort={sort} link={(x) => link({ sort: x === "nr" ? undefined : x })} extra={t.extra} />
                    </div>
                    <div className="lg:hidden">
                      <List>
                        {liste.map((s) => {
                          const beste = besterWert(s);
                          return (
                            <li key={s.pid} className="!px-0">
                              <div className="flex min-h-12 items-center gap-3 py-3 pl-5 pr-4">
                                <span className="w-7 shrink-0 text-right text-[15px] tabular-nums text-label-2">{s.nr ?? ""}</span>
                                <Link href={`/kader/${s.pid}`} className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-center gap-1.5 text-[17px] font-medium">
                                    {s.name}
                                    <ScoutAbzeichen e={s.scout} />
                                    <StatusBadges s={s} />
                                  </span>
                                  <span className="block text-[13px] text-label-2">{s.alter !== undefined ? `${s.alter} J.` : "Alter nicht verfügbar"}</span>
                                </Link>
                                {t.extra && <span>{t.extra.zelle(s)}</span>}
                                <span className="text-right">
                                  {beste ? (
                                    <>
                                      <span className={`block rounded-[8px] px-2 py-0.5 text-[17px] font-semibold tabular-nums ${stufe(beste.wert).cls}`}>
                                        {beste.wert.toFixed(2)}
                                      </span>
                                      <span className="block text-[12px] text-label-2">{posDe(beste.p)}</span>
                                    </>
                                  ) : (
                                    <span className="text-[13px] text-label-2">MZ-Wert n. v.</span>
                                  )}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </List>
                    </div>
                  </>
                )}
              </Section>
            );
          })}
        </>
      )}
    </>
  );
}
