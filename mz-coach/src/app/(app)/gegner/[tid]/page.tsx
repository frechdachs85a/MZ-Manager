// Gegnerseite: Startelf-Wert, Steckbrief, Formationen, Spiele und Belege zu einem Team.

import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LinkZeile } from "@/components/link-zeile";
import { PageHeader } from "@/components/page-header";
import { Spielfeld } from "@/components/spielfeld";
import { alleMarktwerte } from "@/lib/marktwerte";
import { Card, List, Row, Section, Unavailable } from "@/components/ui";
import { RegelSaetze } from "@/components/regel-saetze";
import { getDb } from "@/lib/db";
import { de } from "@/lib/mz/analyse/gegner";
import { ANALYSE_SPIELE, LIGA_MID_AB } from "@/lib/mz/parser/spielliste";
import { gegnerAnalyseLaden } from "@/lib/gegner-analyse";
import { HolKnopf } from "./hol-knopf";
import { KaderKnopf } from "./kader-knopf";
import { kaderwertVergleich, type ElfWert } from "@/lib/kaderwert";
import { topGegenKlasse } from "@/lib/portfolio";
import { gegnerKlasse } from "@/lib/mz/analyse/muster";
import { datumZeit as dz } from "@/lib/format";

const mio = (n: number) => `${(n / 1_000_000).toFixed(1).replace(".", ",")} Mio`;
function ElfZeile({ titel, w }: { titel: string; w: ElfWert | null }) {
  if (!w) return <Row title={titel} detail="nicht verfügbar" />;
  return (
    <Row
      title={titel}
      detail={`Startelf aus Spiel ${w.spiel?.mid ?? "?"} · ${w.mitWert} von ${w.spieler} mit Marktwert${w.fehlt.length ? ` · fehlt: ${w.fehlt.join(", ")}` : ""}`}
      value={
        <span className="text-right">
          <span className="display block text-[18px] font-semibold text-label tabular-nums">{mio(w.summe)}</span>
          <span className="block text-[12px]">{w.alterSchnitt !== undefined ? `Ø ${w.alterSchnitt.toFixed(1).replace(".", ",")} Jahre` : "Alter n. v."}</span>
        </span>
      }
    />
  );
}

const datumDe = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "n. v.");
const uhr = (clock: string) => {
  const m = clock.match(/^(\d+):(\d+)/);
  return m ? `${m[1]}:${m[2].padStart(2, "0")}` : clock;
};
const kurz = (name: string) => {
  const t = name.split(" ");
  return t.length > 1 ? `${t[0][0]} ${t.slice(1).join(" ")}` : name;
};

// Seite eines Gegners
export default async function GegnerSeite(props: PageProps<"/gegner/[tid]">) {
  await connection();
  const { tid: tidText } = await props.params;
  const tid = Number(tidText);
  const { spiele, name, liga, stats, analyse: a, regeln } = gegnerAnalyseLaden(getDb(), tid);
  const werte = alleMarktwerte(getDb());
  if (spiele.length === 0) notFound();
  const alleLiga = spiele.filter((s) => s.art === "Ligaspiel" && s.mid > LIGA_MID_AB);
  const fehlen = liga.filter((s) => !s.xml);
  const kw = kaderwertVergleich(getDb(), tid);
  const neuestes = a?.spiele[0];
  const klasse = neuestes ? gegnerKlasse({ engeMitte: neuestes.engeMitte, fuenferkette: neuestes.formation.abwehr >= 5 } as Parameters<typeof gegnerKlasse>[0]) : undefined;
  const topStile = klasse ? topGegenKlasse(getDb(), klasse).slice(0, 4) : [];
  const begr = new Map(a?.begruendung.map((b) => [b.mid, b.text]));

  return (
    <>
      <PageHeader title={name} subtitle={`tid ${tid} · ${alleLiga.length} Ligaspiele dieser Saison, davon die letzten ${liga.length} (höchstens ${ANALYSE_SPIELE}) betrachtet, ${stats.length} ausgewertet`} />
      <div className="seite">
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
          <div>
            {a ? (
              <>
                <Section title="Spielt er immer gleich?" footer="Vergleich jedes Spiels mit dem neuesten: Formation, Einstellungen und Aufstellung zu Spielbeginn (gleich = jeder Feldspieler höchstens 2 Punkte daneben). Wechsel und Taktikwechsel im Verlauf stehen im Spielbericht; ob er im Spiel die Formation umstellt, ist aus der XML nicht erkennbar.">
                  <Card className="p-4">
                    <div className="text-[17px] font-semibold">{a.urteilText}</div>
                    {a.konstant.length > 0 && <div className="mt-2 text-[15px] text-label-2">Immer: {a.konstant.join(" · ")}</div>}
                    <div className="mt-2 text-[15px] text-label-2">
                      Bilanz: {a.bilanz.siege} S, {a.bilanz.remis} U, {a.bilanz.niederlagen} N · Tore {a.bilanz.tore}:{a.bilanz.gegentore}
                    </div>
                  </Card>
                </Section>
                <Section title="Wechsel- und Taktikregeln" footer={`Aus allen ${stats.length} ausgewerteten Ligaspielen: jeder Substitution- und Tactic-Eintrag der Stats-XML mit Minute und Spielstand.`}>
                  <Card className="p-4 text-[14px]">
                    <RegelSaetze regeln={regeln} />
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

        {klasse && (
          <Section
            title={`Was die Top 10 gegen ${klasse} spielen`}
            footer="Gegnerklasse aus seinem neuesten Ligaspiel. Stile aus den gespeicherten Spielen der Top 10, mit Bilanz und ob du den Stil im Taktik-Archiv hast. Alle Stile unter „Portfolio“."
          >
            {topStile.length ? (
              <List>
                {topStile.map((t) => (
                  <Row
                    key={t.schluessel}
                    title={`${t.schluessel}${t.bewaehrt ? " · bewährt" : ""}`}
                    detail={`${t.spiele} Spiele (${t.S} S, ${t.U} U, ${t.N} N) · ${t.teams.join(", ")} · ${t.imArchiv.length ? `hast du: ${t.imArchiv.join(", ")}` : "nicht in deinem Archiv"}`}
                  />
                ))}
              </List>
            ) : (
              <Card className="p-5 text-[14px] text-label-2">Noch keine Spiele der Top 10 gegen diese Gegnerklasse gespeichert.</Card>
            )}
          </Section>
        )}
        <Section
          title="Kaderwert-Vergleich"
          aktion={<KaderKnopf tid={tid} />}
          footer={`Summe der Marktwerte der Startelf (mz-wissen.md, Abschnitt 10). Marktwert ist kein Preismaßstab, aber ein Maß für die Stärke. Gegnerkader ${kw.gegnerKaderStand ? `Stand ${dz(kw.gegnerKaderStand)}` : "noch nicht geholt"}.`}
        >
          <List>
            <ElfZeile titel="FC Toho" w={kw.eigen} />
            <ElfZeile titel={name} w={kw.gegner} />
          </List>
        </Section>
        {a && (
          <Section title="Aufstellung je Ligaspiel" footer="Startelf aus der Stats-XML in Editor-Koordinaten (mz-wissen.md, Abschnitt 3), aus Sicht seines Tors.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {a.spiele.map((s) => (
                <Card key={s.mid} className="p-2">
                  <Spielfeld
                    spieler={[
                      ...s.feld.map((f) => ({ x: f.p.x, y: f.p.y, label: kurz(f.name), wert: werte[f.pid] })),
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
