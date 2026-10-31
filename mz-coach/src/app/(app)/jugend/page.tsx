// Jugend (Marcus, 31.10.2026): dieselbe Tabelle wie der Kader, aufgeteilt in „Behalten“ und „Abgabekandidaten“. Vorschlag
// nach der Jugendregel (Scout-Rang 1 bis 3 behalten); per Klick eigene Entscheidung, dann rutscht der Spieler in die andere
// Tabelle. Talente (Nr. 100 bis 110), Nr. ab 195 und weitere junge Spieler bis 21.

import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Section, Unavailable } from "@/components/ui";
import type { KaderZeile } from "@/components/kader-tabelle";
import { KaderAnsicht } from "@/components/kader-ansicht";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { ladeJugendEntscheidungen } from "@/lib/db/watch";
import { BEHALTEN_UNTER_NR, ERSETZEN_AB, jugendAuswertung, nachNummer, TALENTE, type JugendSpieler } from "@/lib/jugend";
import { ladeKombis } from "@/lib/scout";
import { jugendEntscheiden } from "./actions";

// Ohne eigene Entscheidung: nur der Regel-Vorschlag "Abgabekandidat" landet bei den Abgabekandidaten

export default async function Jugend(props: PageProps<"/jugend">) {
  await connection();
  const db = getDb();
  const kader = ladeKader(db);
  const kombis = ladeKombis(db);
  const { talente, ersetzen, weitere } = jugendAuswertung(kader, kombis);
  const entscheidung = ladeJugendEntscheidungen(db);
  const params = await props.searchParams;
  const alle = [...talente, ...weitere, ...ersetzen];
  const je = new Map<number, JugendSpieler>(alle.map((j) => [j.s.pid, j]));
  const wohin = (pid: number) => entscheidung.get(pid) ?? nachNummer(je.get(pid)!.s.nr);
  const zeilen: KaderZeile[] = alle.map((j) => ({ ...j.s, scout: j.scout }));
  const behalten = zeilen.filter((z) => wohin(z.pid) === "behalten").length;

  const zelle = (ziel: "behalten" | "abgeben") =>
    function EntscheidungZelle(z: KaderZeile) {
      const j = je.get(z.pid)!;
      const eigen = entscheidung.has(z.pid);
      return (
        <span className="flex flex-col items-start gap-0.5">
          <form action={jugendEntscheiden}>
            <input type="hidden" name="pid" value={z.pid} />
            <input type="hidden" name="entscheidung" value={ziel} />
            <button
              className={`pressable whitespace-nowrap rounded-md border px-2 py-0.5 text-[12px] font-semibold ${ziel === "abgeben" ? "border-orange/50 text-orange" : "border-green/50 text-green"}`}
            >
              {ziel === "abgeben" ? "→ Abgabe" : "→ Behalten"}
            </button>
          </form>
          <span className="text-[10.5px] leading-tight text-label-3" title="Vorschlag nach deiner Jugendregel">
            {eigen ? `deine Wahl · Scout: ${j.vorschlag}` : `Nr. ${(z.nr ?? 0) < BEHALTEN_UNTER_NR ? "unter" : "ab"} ${BEHALTEN_UNTER_NR} · Scout: ${j.vorschlag}`}
          </span>
        </span>
      );
    };

  return (
    <>
      <PageHeader title="Jugend" subtitle={`${alle.length} junge Spieler · ${behalten} behalten · ${alle.length - behalten} Abgabekandidaten`} />
      <div className="seite">
        {kader.length === 0 ? (
          <Section title="Jugend">
            <Unavailable title="Jugend" reason="Noch kein Kaderabruf." />
          </Section>
        ) : (
          <>
            <KaderAnsicht
              basis="/jugend"
              alle={zeilen}
              params={params}
              kombis={kombis}
              ohneGruppe
              abschnitte={[
                {
                  titel: "Behalten",
                  passt: (z) => wohin(z.pid) === "behalten",
                  extra: { titel: "Entscheidung", zelle: zelle("abgeben") },
                  footer: `Talente (Nr. ${TALENTE.von} bis ${TALENTE.bis}), Spieler ab Nr. ${ERSETZEN_AB} und weitere junge Spieler bis 21. Einteilung nach deiner Nummerierung: unter Nr. ${BEHALTEN_UNTER_NR} behalten, ab ${BEHALTEN_UNTER_NR} abgeben; der Scout-Vorschlag steht als Info dabei. „→ Abgabe“ verschiebt den Spieler; deine Entscheidung gilt, bis du sie änderst (auch auf der Spielerseite).`,
                },
                {
                  titel: "Abgabekandidaten",
                  passt: (z) => wohin(z.pid) === "abgeben",
                  extra: { titel: "Entscheidung", zelle: zelle("behalten") },
                  footer: "Loyale Spieler können nicht verkauft, nur entlassen werden. „→ Behalten“ verschiebt den Spieler zurück.",
                  leer: "Keine Abgabekandidaten.",
                },
              ]}
            />
          </>
        )}
      </div>
    </>
  );
}
