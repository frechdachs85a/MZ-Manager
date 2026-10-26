import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { ElfWertZeile } from "@/components/elf-wert";
import { SpielberichtTeile } from "@/components/spielbericht";
import { Hero, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { spielDatum } from "@/lib/format";
import { spieltagLage } from "@/lib/spieltag";
import { SpieltagReiter } from "../reiter";

const ERG = { S: "Sieg", U: "Unentschieden", N: "Niederlage" } as const;

export default async function LetztesLigaspiel() {
  await connection();
  const { bericht: b, lauf, elfWerte } = spieltagLage(getDb());
  return (
    <>
      <PageHeader title="Spieltag" subtitle="Ausführlicher Bericht deines letzten Ligaspiels" />
      <div className="seite">
        <SpieltagReiter aktiv="letztes" />
        {b ? (
          <>
            <Hero className="mt-5">
              <div className="kapitaelchen !text-tint-hell">
                Dein letztes Ligaspiel · {spielDatum(b.datum) ?? "Datum n. v."} · {ERG[b.ergebnis]} · {b.eigen.heim ? "Heimspiel" : "Auswärtsspiel"}
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="display min-w-0 text-[20px] font-bold uppercase leading-tight lg:text-[28px]">
                  {b.eigen.name}
                  <ElfWertZeile w={elfWerte?.[b.eigen.id]} />
                </div>
                <div className="display text-[56px] font-bold leading-none tabular-nums lg:text-[72px]">
                  {b.endstand.eigen}
                  <span className="px-1 text-label-3">:</span>
                  {b.endstand.gegner}
                </div>
                <div className="display min-w-0 text-right text-[20px] font-bold uppercase leading-tight lg:text-[28px]">
                  {b.gegner.name}
                  <ElfWertZeile w={elfWerte?.[b.gegner.id]} rechts />
                </div>
              </div>
              <p className="mt-3 text-[12px] text-label-3">Startelf-Wert = Marktwerte der 11 Startspieler laut Kaderseite (heutiger Stand, nicht der Wert am Spieltag).</p>
              <Link href={`/spiele/${b.mid}`} className="mt-4 inline-block text-[12.5px] font-semibold uppercase tracking-wider text-tint-hell">
                Aufstellungen und Spielverlauf →
              </Link>
            </Hero>
            <SpielberichtTeile b={b} />
          </>
        ) : (
          <Section title="Dein letztes Ligaspiel">
            <Unavailable title="Spielbericht" reason={lauf?.letztesMid ? `Stats-XML von Spiel ${lauf.letztesMid} noch nicht gespeichert.` : "Noch kein Spieltag-Abruf gelaufen."} />
          </Section>
        )}
      </div>
    </>
  );
}
