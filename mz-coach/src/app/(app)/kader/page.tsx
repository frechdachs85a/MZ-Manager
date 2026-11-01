import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { List, Row, Section } from "@/components/ui";
import { KaderAnsicht } from "@/components/kader-ansicht";
import { LeistungTabelle } from "@/components/leistung-tabelle";
import { leistungJeRolle } from "@/lib/spieler-leistung";
import type { KaderZeile } from "@/components/kader-tabelle";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { KADER_START, QUELLE_KADER } from "@/lib/wissen/startbasis";
import { datumZeit } from "@/lib/format";
import { ladeKombis, scoutEinstufung } from "@/lib/scout";
import { ScoutBestaetigen } from "./scout-bestaetigen";

// Seite Kader: Ansicht, Filter und Sortierung in components/kader-ansicht.tsx (gemeinsam mit der Jugend)
type Zeile = KaderZeile;

// Seite Kader
export default async function Kader(props: PageProps<"/kader">) {
  await connection();
  const db = getDb();
  const kombis = ladeKombis(db);
  const alleSpieler: Zeile[] = ladeKader(db).map((s) => ({ ...s, scout: scoutEinstufung(s, kombis) }));
  const params = await props.searchParams;
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
        <KaderAnsicht basis="/kader" alle={alleSpieler} params={params} kombis={kombis} />
        {(() => {
          const lj = leistungJeRolle(db);
          const zeilen = alleSpieler
            .flatMap((sp) => (lj.get(sp.pid) ?? []).map((l) => ({ name: sp.name, l })))
            .sort((a, b) => a.l.rolle.localeCompare(b.l.rolle) || b.l.minuten - a.l.minuten);
          return zeilen.length ? (
            <Section
              title="Leistung in Spielen je Rolle"
              footer="Aus deinen gespeicherten Ligaspielen (L) und Scoutspielen (S) mit Stats-XML, je 90 Minuten. Rolle = Startplatz; Eingewechselte zählen auf der Rolle des Spielers, den sie ersetzen. Grau: unter 90 Minuten, wenig Daten. Hilft bei Wechselzeit und Aufstellung: liefert der Ersatz in der Rolle ähnlich viel, kann früher gewechselt werden."
            >
              <LeistungTabelle name zeilen={zeilen} />
            </Section>
          ) : null;
        })()}
      </div>
    </>
  );
}
