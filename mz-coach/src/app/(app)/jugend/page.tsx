import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { ERSETZEN_AB, jugendAuswertung, TALENTE, type JugendSpieler, type Vorschlag } from "@/lib/jugend";
import { ScoutAbzeichen } from "@/components/scout-abzeichen";
import { ladeKombis } from "@/lib/scout";

const TON: Record<Vorschlag, "green" | "red" | "orange" | "neutral" | "tint"> = {
  behalten: "green",
  "behalten, Text fehlt": "green",
  prüfen: "red",
  Abgabekandidat: "orange",
  loyal: "tint",
  "kein Scoutbericht": "neutral",
};

function Tabelle({ liste, rang = false }: { liste: JugendSpieler[]; rang?: boolean }) {
  return (
    <Card className="!overflow-x-auto">
      <table className="w-full min-w-[760px] text-[14px]">
        <thead>
          <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
            {rang && <th className="py-2.5 pl-5 font-medium">#</th>}
            <th className={`py-2.5 font-medium ${rang ? "" : "pl-5"}`}>Nr</th>
            <th className="py-2.5 font-medium">Name</th>
            <th className="py-2.5 text-right font-medium">Alter</th>
            <th className="py-2.5 pl-4 font-medium">Scout</th>
            <th className="py-2.5 pl-4 font-medium">Vorschlag</th>
            <th className="py-2.5 text-right font-medium">Training</th>
            <th className="py-2.5 pr-5 text-right font-medium">Bester MZ-Wert</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {liste.map((j, i) => (
            <tr key={j.s.pid} className="zeile-hover">
              {rang && <td className="py-2.5 pl-5 tabular-nums text-label-3">{i + 1}</td>}
              <td className={`py-2.5 tabular-nums text-label-2 ${rang ? "" : "pl-5"}`}>{j.s.nr}</td>
              <td className="py-2.5 font-medium">
                <Link href={`/kader/${j.s.pid}`} className="hover:text-tint">{j.s.name}</Link>
              </td>
              <td className="py-2.5 text-right tabular-nums">{j.s.alter ?? "n. v."}</td>
              <td className="py-2.5 pl-4">
                <ScoutAbzeichen e={j.scout} mitSternen />
              </td>
              <td className="py-2.5 pl-4">
                <span title={j.vorschlag === "loyal" ? "Loyaler Spieler: kann entlassen, aber nie verkauft werden" : undefined}>
                  <Badge tone={TON[j.vorschlag]}>{j.vorschlag === "loyal" ? "loyal, nicht verkaufbar" : j.vorschlag}</Badge>
                </span>
              </td>
              <td className="py-2.5 text-right tabular-nums">{j.s.scoutTraining !== undefined ? `${j.s.scoutTraining} ★` : "n. v."}</td>
              <td className="py-2.5 pr-5 text-right tabular-nums">{j.besterWert ? `${j.besterWert.wert.toFixed(2)} ${j.besterWert.p}` : "n. v."}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default async function Jugend() {
  await connection();
  const db = getDb();
  const kader = ladeKader(db);
  const { talente, ersetzen, weitere } = jugendAuswertung(kader, ladeKombis(db));
  const behalten = ersetzen.filter((j) => j.regelOk).length;
  return (
    <>
      <PageHeader title="Jugend" subtitle={`${talente.length} Talente (Nr. ${TALENTE.von} bis ${TALENTE.bis}) · ${ersetzen.length} Spieler ab Nr. ${ERSETZEN_AB}`} />
      <div className="seite">
        {kader.length === 0 ? (
          <Section title="Talente">
            <Unavailable title="Jugend" reason="Noch kein Kaderabruf." />
          </Section>
        ) : (
          <>
            <Section title="Talente" footer="Scout = Einstufung aus Sternen Hoch/Niedrig und Schlüsselwort im Text des Scoutberichts (Rang 1 = beste). Training = Sterne „Tr. Geschwindigkeit“.">
              <Tabelle liste={talente} />
            </Section>
            <Section
              title="Ersetzen ab Nr. 195"
              footer={`Deine Regel: nur Rang 1 bis 3 (Spitzenklasse 4/2, Elite 4/1, Spitzenspieler 3/2) behalten, alle anderen sind Abgabekandidaten; neue Jugendspieler werden dienstags gezogen. Loyale Spieler können nicht verkauft werden. Reihenfolge: zuerst wer die Regel nicht erfüllt, schwächste Einstufung und wenig Trainingssterne zuerst. ${behalten} von ${ersetzen.length} erfüllen die Regel.`}
            >
              <Tabelle liste={ersetzen} rang />
            </Section>
            {weitere.length > 0 && (
              <Section title="Weitere junge Spieler" footer="Bis 21 Jahre, Nummern zwischen den Talenten und Nr. 195.">
                <Tabelle liste={weitere} />
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}
