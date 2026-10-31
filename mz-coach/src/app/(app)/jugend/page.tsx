// Jugend (Marcus, 31.10.2026): dieselbe Tabelle wie der Kader, aufgeteilt in „Behalten“ und „Abgabekandidaten“. Vorschlag
// nach der Jugendregel (Scout-Rang 1 bis 3 behalten); per Klick eigene Entscheidung, dann rutscht der Spieler in die andere
// Tabelle. Talente (Nr. 100 bis 110), Nr. ab 195 und weitere junge Spieler bis 21.

import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Section, Unavailable } from "@/components/ui";
import { WertLegende } from "@/components/wert-stufe";
import { KaderTabelle, mitParam, sortiere, type KaderZeile, type Sortierung } from "@/components/kader-tabelle";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { ladeJugendEntscheidungen } from "@/lib/db/watch";
import { POSITIONEN } from "@/lib/mz/formel";
import { ERSETZEN_AB, jugendAuswertung, TALENTE, type JugendSpieler, type Vorschlag } from "@/lib/jugend";
import { ladeKombis, rangSortierung } from "@/lib/scout";
import { jugendEntscheiden } from "./actions";

const TON: Record<Vorschlag, "green" | "red" | "orange" | "neutral" | "tint"> = {
  behalten: "green",
  "behalten, Text fehlt": "green",
  prüfen: "red",
  Abgabekandidat: "orange",
  loyal: "tint",
  "kein Scoutbericht": "neutral",
};
// Ohne eigene Entscheidung: nur der Regel-Vorschlag "Abgabekandidat" landet bei den Abgabekandidaten
const nachRegel = (v: Vorschlag) => (v === "Abgabekandidat" ? "abgeben" : "behalten");
const SORTIERUNGEN: Sortierung[] = ["nr", "alter", "scout", "bester", ...POSITIONEN];

export default async function Jugend(props: PageProps<"/jugend">) {
  await connection();
  const db = getDb();
  const kader = ladeKader(db);
  const kombis = ladeKombis(db);
  const { talente, ersetzen, weitere } = jugendAuswertung(kader, kombis);
  const entscheidung = ladeJugendEntscheidungen(db);
  const params = await props.searchParams;
  const roh = typeof params.sort === "string" ? params.sort : undefined;
  const sort: Sortierung = roh && (SORTIERUNGEN as string[]).includes(roh) ? (roh as Sortierung) : "nr";
  const link = (x: Sortierung) => mitParam("/jugend", {}, { sort: x === "nr" ? undefined : x });

  const alle = [...talente, ...weitere, ...ersetzen];
  const je = new Map<number, JugendSpieler>(alle.map((j) => [j.s.pid, j]));
  const wohin = (j: JugendSpieler) => entscheidung.get(j.s.pid) ?? nachRegel(j.vorschlag);
  const zeilen = (liste: JugendSpieler[]): KaderZeile[] =>
    sortiere(
      liste.map((j) => ({ ...j.s, scout: j.scout })),
      sort,
      rangSortierung,
    );
  const behalten = zeilen(alle.filter((j) => wohin(j) === "behalten"));
  const abgeben = zeilen(alle.filter((j) => wohin(j) === "abgeben"));

  const zelle = (ziel: "behalten" | "abgeben") =>
    function EntscheidungZelle(z: KaderZeile) {
      const j = je.get(z.pid)!;
      const eigen = entscheidung.has(z.pid);
      return (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span title={eigen ? "Deine Entscheidung (Regel-Vorschlag in Klammern)" : "Vorschlag nach deiner Jugendregel"}>
            <Badge tone={TON[j.vorschlag]}>{eigen ? `du (${j.vorschlag})` : j.vorschlag}</Badge>
          </span>
          <form action={jugendEntscheiden}>
            <input type="hidden" name="pid" value={z.pid} />
            <input type="hidden" name="entscheidung" value={ziel} />
            <button
              className={`pressable rounded-md border px-2 py-0.5 text-[12px] font-semibold ${ziel === "abgeben" ? "border-orange/50 text-orange" : "border-green/50 text-green"}`}
            >
              {ziel === "abgeben" ? "→ Abgabe" : "→ Behalten"}
            </button>
          </form>
        </span>
      );
    };

  return (
    <>
      <PageHeader title="Jugend" subtitle={`${alle.length} junge Spieler · ${behalten.length} behalten · ${abgeben.length} Abgabekandidaten`} />
      <div className="seite">
        {kader.length === 0 ? (
          <Section title="Jugend">
            <Unavailable title="Jugend" reason="Noch kein Kaderabruf." />
          </Section>
        ) : (
          <>
            <div className="mt-4">
              <WertLegende />
            </div>
            <Section
              title="Behalten"
              footer={`Talente (Nr. ${TALENTE.von} bis ${TALENTE.bis}), Spieler ab Nr. ${ERSETZEN_AB} und weitere junge Spieler bis 21. Vorschlag nach deiner Regel: Scout-Rang 1 bis 3 behalten. „→ Abgabe“ verschiebt den Spieler; deine Entscheidung gilt, bis du sie wieder änderst.`}
            >
              <KaderTabelle kader={behalten} sort={sort} link={link} extra={{ titel: "Entscheidung", zelle: zelle("abgeben") }} />
            </Section>
            <Section title="Abgabekandidaten" footer="Loyale Spieler können nicht verkauft, nur entlassen werden. „→ Behalten“ verschiebt den Spieler zurück.">
              {abgeben.length ? (
                <KaderTabelle kader={abgeben} sort={sort} link={link} extra={{ titel: "Entscheidung", zelle: zelle("behalten") }} />
              ) : (
                <p className="text-[14px] text-label-2">Keine Abgabekandidaten.</p>
              )}
            </Section>
          </>
        )}
      </div>
    </>
  );
}
