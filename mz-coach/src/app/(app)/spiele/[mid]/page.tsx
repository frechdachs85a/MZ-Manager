import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { ElfWertZeile, WertDiff } from "@/components/elf-wert";
import { SpielberichtTeile } from "@/components/spielbericht";
import { startelfWerte } from "@/lib/kaderwert";
import { Spielfeld } from "@/components/spielfeld";
import { StatVergleich } from "@/components/stat-vergleich";
import { VerlaufAnsicht } from "@/components/verlauf-ansicht";
import { eigenerVerlauf, gegnerVerlauf } from "@/lib/mz/analyse/verlauf";
import { archivLaden, taktikZuordnen } from "@/lib/taktik-archiv";
import { Card, Hero, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeSpiel } from "@/lib/db/spiele";
import { spielBericht } from "@/lib/mz/analyse/bericht";
import { datumZeit, spielDatum } from "@/lib/format";
import { TEAM } from "@/lib/wissen/startbasis";

// Bezeichnungen der Team-Statistik (Attributnamen der Stats-XML)
const STAT: [string, string][] = [
  ["goals", "Tore"],
  ["possession", "Ballbesitz %"],
  ["shotsOnGoal", "Schüsse aufs Tor"],
  ["shotsWide", "Schüsse daneben"],
  ["corners", "Ecken"],
  ["freekicks", "Freistöße"],
  ["penaltyshots", "Elfmeter"],
  ["offsides", "Abseits"],
  ["saves", "Paraden"],
  ["goodPasses", "Pässe angekommen"],
  ["interceptedPasses", "Pässe abgefangen"],
  ["tacklesWon", "Zweikämpfe gewonnen"],
  ["tacklesLost", "Zweikämpfe verloren"],
  ["yellowCards", "Gelbe Karten"],
  ["redCards", "Rote Karten"],
  ["substitutions", "Wechsel"],
];

const kurz = (name: string) => {
  const t = name.split(" ");
  return t.length > 1 ? `${t[0][0]} ${t.slice(1).join(" ")}` : name;
};
// Spieluhr "58:2.333" -> "58:02"
const uhr = (clock: string) => {
  const m = clock.match(/^(\d+):(\d+)/);
  return m ? `${m[1]}:${m[2].padStart(2, "0")}` : clock;
};
// Kartenarten laut mz-wissen.md: yellow, second yellow. Unbekannte Werte unverändert.
const KARTE: Record<string, string> = { yellow: "Gelb", "second yellow": "Gelb-Rot", red: "Rot" };

export default async function SpielSeite(props: PageProps<"/spiele/[mid]">) {
  await connection();
  const { mid } = await props.params;
  const s = ladeSpiel(getDb(), Number(mid));
  if (!s) notFound();
  const archiv = archivLaden(getDb());
  const eigen = s.teams.find((t) => t.id === TEAM.tid);
  const zuordnung = eigen ? taktikZuordnen(s, archiv) : null;
  const eigeneTaktik = zuordnung ? archiv.find((a) => a.reiter === zuordnung.reiter)?.taktik : null;
  const verlaeufe = s.teams.map((t) => ({
    team: t,
    titel: t.id === TEAM.tid ? (eigeneTaktik ? `${t.name} (du, Taktik ${zuordnung!.reiter})` : `${t.name} (du)`) : t.name,
    v:
      t.id === TEAM.tid && eigeneTaktik
        ? eigenerVerlauf(s, eigeneTaktik, t.id)
        : (() => {
            const g = gegnerVerlauf(s, t.id);
            if (t.id === TEAM.tid) g.hinweise.unshift("Keine passende Taktik im Archiv: Alternativ-Aufstellungen und Regeln nicht verknüpft. Taktik unter „Taktik“ speichern.");
            return g;
          })(),
  }));
  const heim = s.teams.find((t) => t.heim) ?? s.teams[0];
  const elfWerte = startelfWerte(getDb(), s);
  const gast = s.teams.find((t) => t !== heim)!;
  const name = (id?: number) => s.spieler.find((p) => p.id === id)?.name ?? (id ? `id ${id}` : "");
  const teamName = (id: number) => s.teams.find((t) => t.id === id)?.name ?? "";

  return (
    <>
      <PageHeader
        title="Spielbericht"
        subtitle={`${heim.name} – ${gast.name} · mid ${s.mid}`}
      />
      <div className="seite">
        <Hero className="mt-5">
          <div className="kapitaelchen !text-gold-hell">
            {spielDatum(s.datum) ?? "Datum n. v."} · Endstand
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="display min-w-0 text-[18px] font-semibold leading-tight lg:text-[26px]">
              {heim.name}
              {heim.id === TEAM.tid && <span className="block text-[12px] font-medium text-white/70">du · Heim</span>}
              {heim.id !== TEAM.tid && <span className="block text-[12px] font-medium text-white/70">Heim</span>}
              <ElfWertZeile w={elfWerte[heim.id]} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="display text-[56px] font-semibold leading-none tracking-tight tabular-nums lg:text-[76px]">
                {heim.statistik.goals ?? "?"}
                <span className="px-1 text-white/50">:</span>
                {gast.statistik.goals ?? "?"}
              </div>
              {eigen && (() => {
                const geg = s.teams.find((t) => t.id !== eigen.id)!;
                return <WertDiff eigen={elfWerte[eigen.id]?.summe} gegner={elfWerte[geg.id]?.summe} />;
              })()}
            </div>
            <div className="display min-w-0 text-right text-[18px] font-semibold leading-tight lg:text-[26px]">
              {gast.name}
              <span className="block text-[12px] font-medium text-white/70">{gast.id === TEAM.tid ? "du · Gast" : "Gast"}</span>
              <ElfWertZeile w={elfWerte[gast.id]} rechts />
            </div>
          </div>
        </Hero>
        {s.hinweise.length > 0 && (
          <Section title="Hinweise">
            <Card className="p-4 text-[15px] text-orange">{s.hinweise.join(" ")}</Card>
          </Section>
        )}
        <div className="lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10">
        <Section
          title="Startaufstellungen"
          footer="Aus origin der Stats-XML in Editor-Koordinaten umgerechnet (mz-wissen.md, Abschnitt 3), jedes Team aus Sicht seines eigenen Tors."
        >
          <div className="grid grid-cols-2 gap-4">
            {[heim, gast].map((t) => (
              <Card key={t.id} className="p-3">
                <div className="mb-2 text-[15px] font-semibold">{t.name}{t.id === TEAM.tid && " (du)"}</div>
                <Spielfeld
                  spieler={s.spieler
                    .filter((p) => p.teamId === t.id && p.editor)
                    .map((p) => ({ x: p.editor!.x, y: p.editor!.y, label: kurz(p.name), torwart: p.torwart }))}
                />
                <div className="mt-2 text-[13px] text-label-2">
                  {t.tactic} / {t.playstyle} / {t.aggression}
                  {t.manager && ` · Manager ${t.manager}`}
                </div>
              </Card>
            ))}
          </div>
        </Section>
        <Section title="Statistik" footer={`Quelle: Stats-XML, gespeichert ${datumZeit(s.abgerufen)}.`}>
          <Card>
            <StatVergleich
              links={heim.name}
              rechts={gast.name}
              akzent={gast.id === TEAM.tid ? "rechts" : "links"}
              zeilen={STAT.map(([k, label]) => ({ label, links: heim.statistik[k], rechts: gast.statistik[k] }))}
            />
          </Card>
        </Section>
        </div>

        {/* Ausführlicher Bericht aus Sicht des eigenen Teams (bei fremden Spielen aus Sicht des Heimteams) */}
        <SpielberichtTeile b={spielBericht(s, eigen?.id ?? heim.id)} />

        {verlaeufe.map(({ team, titel, v }) => (
          <Section
            key={team.id}
            title={`Aufstellung im Spielverlauf: ${titel}`}
            footer={
              team.id === TEAM.tid && eigeneTaktik
                ? "Plätze, Alternativ-Aufstellungen und Regeln exakt aus deinem Taktik-Export, verknüpft mit Wechseln, Taktikwechseln, Toren und Karten aus der XML. Grau = Eingewechselter auf dem Platz des Ausgewechselten (abgeleitet)."
                : "Start aus der XML. Grau = Eingewechselter auf dem Platz des Ausgewechselten (abgeleitet, nicht gemessen)."
            }
          >
            <VerlaufAnsicht phasen={v.phasen} hinweise={v.hinweise} />
          </Section>
        ))}

        <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-10">
          <div className="contents">
            <Section title={`Tore (${s.tore.length})`}>
              {s.tore.length ? (
                <List>
                  {s.tore.map((t, i) => (
                    <Row
                      key={i}
                      title={`${name(t.schuetze)}`}
                      detail={`${teamName(t.teamId)}${t.vorlage ? ` · Vorlage ${name(t.vorlage)}` : ""}`}
                      value={<span className="tabular-nums">{uhr(t.clock)} · {t.stand}</span>}
                    />
                  ))}
                </List>
              ) : (
                <Card className="p-4 text-[15px] text-label-2">Keine Tore.</Card>
              )}
            </Section>
            <Section title={`Wechsel (${s.wechsel.length})`} footer="preset = Regel, injury = Verletzung (mz-wissen.md). Regelminute = eingestellte Minute, Spieluhr = tatsächlicher Wechsel.">
              {s.wechsel.length ? (
                <List>
                  {s.wechsel.map((w, i) => (
                    <Row
                      key={i}
                      title={`${name(w.rein)} für ${name(w.raus)}`}
                      detail={`${teamName(w.teamId)} · ${w.grund}${w.regelMinute !== undefined ? ` · Regel ab ${w.regelMinute}.` : ""}`}
                      value={<span className="tabular-nums">{uhr(w.clock)} · {w.stand}</span>}
                    />
                  ))}
                </List>
              ) : (
                <Card className="p-4 text-[15px] text-label-2">Keine Wechsel.</Card>
              )}
            </Section>
            <Section title={`Taktikwechsel und Karten`} footer="Taktikwechsel nur, wenn eine Regel ausgelöst hat (in der XML stehen nur ausgelöste Regeln).">
              <List>
                {s.taktikwechsel.map((t, i) => (
                  <Row key={`t${i}`} title={`${teamName(t.teamId)}: ${t.art} → ${t.neu}`} value={<span className="tabular-nums">{uhr(t.clock)} · {t.stand}</span>} />
                ))}
                {s.karten.map((k, i) => (
                  <Row key={`k${i}`} title={`${name(k.spieler)}: ${KARTE[k.art] ?? k.art}`} detail={teamName(k.teamId)} value={<span className="tabular-nums">{uhr(k.clock)} · {k.stand}</span>} />
                ))}
                {s.taktikwechsel.length + s.karten.length === 0 && <Row title="Keine" />}
              </List>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
