import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LinkZeile } from "@/components/link-zeile";
import { PageHeader } from "@/components/page-header";
import { Spielfeld } from "@/components/spielfeld";
import { Card, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeTeamSpiele, teamName } from "@/lib/db/gegner";
import { ladeSpiel } from "@/lib/db/spiele";
import { analysiereGegner, de } from "@/lib/mz/analyse/gegner";
import { ANALYSE_SPIELE, LIGA_MID_AB, letzteLigaspiele } from "@/lib/mz/parser/spielliste";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { HolKnopf } from "./hol-knopf";

const datumDe = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "n. v.");
const uhr = (clock: string) => {
  const m = clock.match(/^(\d+):(\d+)/);
  return m ? `${m[1]}:${m[2].padStart(2, "0")}` : clock;
};
const kurz = (name: string) => {
  const t = name.split(" ");
  return t.length > 1 ? `${t[0][0]} ${t.slice(1).join(" ")}` : name;
};

export default async function GegnerSeite(props: PageProps<"/gegner/[tid]">) {
  await connection();
  const { tid: tidText } = await props.params;
  const tid = Number(tidText);
  const db = getDb();
  const spiele = ladeTeamSpiele(db, tid);
  if (spiele.length === 0) notFound();
  const name = teamName(db, tid) ?? `tid ${tid}`;
  const alleLiga = spiele.filter((s) => s.art === "Ligaspiel" && s.mid > LIGA_MID_AB);
  const liga = letzteLigaspiele(spiele);
  const fehlen = liga.filter((s) => !s.xml);
  const stats = liga.filter((s) => s.xml).map((s) => ladeSpiel(db, s.mid)).filter((s): s is StatsSpiel & { abgerufen: string } => !!s);
  const a = stats.length ? analysiereGegner(tid, stats) : null;
  const begr = new Map(a?.begruendung.map((b) => [b.mid, b.text]));

  return (
    <>
      <PageHeader title={name} subtitle={`tid ${tid} · ${alleLiga.length} Ligaspiele dieser Saison, davon die letzten ${liga.length} (höchstens ${ANALYSE_SPIELE}) betrachtet, ${stats.length} ausgewertet`} />
      <div className="seite">
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
          <div>
            {a ? (
              <>
                <Section title="Spielt er immer gleich?" footer="Vergleich jedes Spiels mit dem neuesten: Formation, Einstellungen und Aufstellung (gleich = jeder Feldspieler höchstens 2 Punkte daneben).">
                  <Card className="p-4">
                    <div className="text-[17px] font-semibold">{a.urteilText}</div>
                    {a.konstant.length > 0 && <div className="mt-2 text-[15px] text-label-2">Immer: {a.konstant.join(" · ")}</div>}
                    <div className="mt-2 text-[15px] text-label-2">
                      Bilanz: {a.bilanz.siege} S, {a.bilanz.remis} U, {a.bilanz.niederlagen} N · Tore {a.bilanz.tore}:{a.bilanz.gegentore}
                    </div>
                  </Card>
                </Section>
                <Section title="Taktikvorschlag" footer="Nach den Faustregeln aus mz-wissen.md, Abschnitt 10. Vor dem Einsatz den XML-Code der Taktik unter „Taktik“ prüfen lassen.">
                  <Card className="p-4">
                    <div className="text-[13px] font-semibold uppercase tracking-wide text-tint">Empfehlung</div>
                    <div className="mt-1 text-[22px] font-bold">{a.empfehlung.taktik}</div>
                    <div className="mt-1 text-[15px]">{a.empfehlung.regel}</div>
                    <ul className="mt-2 list-disc pl-5 text-[15px]">
                      {a.empfehlung.gruende.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                    <div className="mt-3 text-[13px] font-semibold text-orange">Vorbehalte</div>
                    <ul className="list-disc pl-5 text-[15px] text-label-2">
                      {a.empfehlung.vorbehalte.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </Card>
                </Section>
              </>
            ) : (
              <Section title="Analyse">
                <Unavailable title="Spielt er immer gleich?" reason="Noch kein Ligaspiel mit Stats-XML gespeichert." />
              </Section>
            )}
          </div>
          <div>
            {fehlen.length > 0 && (
              <Section
                title="Fehlende Ligaspiele"
                footer="Holt die Stats-XML ohne Login, ein Spiel nach dem anderen mit Pausen (Ablauf in docs/mz-seiten.md). Gespeicherte Spiele werden nie erneut geholt."
              >
                <HolKnopf tid={tid} anzahl={fehlen.length} />
              </Section>
            )}
            <Section title="Ligaspiele dieser Saison" footer={`Saison erkannt an mid > ${LIGA_MID_AB} (mz-wissen.md, Stand Saison 100). ${spiele.length - liga.length} weitere Spiele (Pokal, Freundschaft, Scout) nicht gewertet.`}>
              <List>
                {liga.map((s) => {
                  const titel = `${datumDe(s.datum)} ${s.heim.name} ${s.tore ? `${s.tore.heim}:${s.tore.gast}` : "–"} ${s.gast.name}`;
                  return s.xml ? (
                    <LinkZeile key={s.mid} href={`/spiele/${s.mid}`} detail={`mid ${s.mid} · ${begr.get(s.mid) ?? (a?.spiele[0].mid === s.mid ? "neuestes Spiel, Vergleichsbasis" : "")}`}>
                      {titel}
                    </LinkZeile>
                  ) : (
                    <Row key={s.mid} title={titel} detail={`mid ${s.mid} · Stats-XML fehlt`} />
                  );
                })}
              </List>
            </Section>
          </div>
        </div>

        {a && (
          <Section title="Aufstellung je Ligaspiel" footer="Startelf aus der Stats-XML in Editor-Koordinaten (mz-wissen.md, Abschnitt 3), aus Sicht seines Tors.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {a.spiele.map((s) => (
                <Card key={s.mid} className="p-2">
                  <Spielfeld
                    spieler={[
                      ...s.feld.map((f) => ({ x: f.p.x, y: f.p.y, label: kurz(f.name) })),
                      ...(s.torwart ? [{ x: s.torwart.x, y: s.torwart.y, label: "TW", torwart: true }] : []),
                    ]}
                  />
                  <div className="mt-1.5 px-1 text-[13px]">
                    <div className="font-semibold">
                      {datumDe(s.datum)} · {s.heim ? "H" : "A"} {s.gegner} {s.tore.eigen}:{s.tore.gegner}
                    </div>
                    <div className="text-label-2">
                      {s.formation.text} · {de(s.tactic)} / {de(s.playstyle)} / {de(s.aggression)}
                    </div>
                    <div className="text-label-2">
                      {s.wechsel.length ? s.wechsel.map((w) => `${uhr(w.clock)} ${w.rein} für ${w.raus} (${w.stand})`).join(" · ") : "keine Wechsel"}
                      {s.taktikwechsel.length > 0 && ` · Taktikwechsel: ${s.taktikwechsel.map((t) => `${uhr(t.clock)} ${t.art} → ${t.neu}`).join(", ")}`}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}
