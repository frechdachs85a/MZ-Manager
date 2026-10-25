import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Spielfeld } from "@/components/spielfeld";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeSpiel } from "@/lib/db/spiele";
import { datumZeit } from "@/lib/format";
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
const KARTE: Record<string, string> = { yellow: "Gelb", "second yellow": "Gelb-Rot" };

export default async function SpielSeite(props: PageProps<"/spiele/[mid]">) {
  await connection();
  const { mid } = await props.params;
  const s = ladeSpiel(getDb(), Number(mid));
  if (!s) notFound();
  const heim = s.teams.find((t) => t.heim) ?? s.teams[0];
  const gast = s.teams.find((t) => t !== heim)!;
  const name = (id?: number) => s.spieler.find((p) => p.id === id)?.name ?? (id ? `id ${id}` : "");
  const teamName = (id: number) => s.teams.find((t) => t.id === id)?.name ?? "";

  return (
    <>
      <PageHeader
        title={`${heim.statistik.goals ?? "?"}:${gast.statistik.goals ?? "?"}`}
        subtitle={`${heim.name} – ${gast.name} · ${s.datum ?? "Datum n. v."} · mid ${s.mid}`}
      />
      <div className="seite">
        {s.hinweise.length > 0 && (
          <Section title="Hinweise">
            <Card className="p-4 text-[15px] text-orange">{s.hinweise.join(" ")}</Card>
          </Section>
        )}
        <Section
          title="Startaufstellungen"
          footer="Aus origin der Stats-XML in Editor-Koordinaten umgerechnet (mz-wissen.md, Abschnitt 3), jedes Team aus Sicht seines eigenen Tors."
        >
          <div className="grid grid-cols-2 gap-3 lg:max-w-3xl">
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

        <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
          <div>
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
          <Section title="Statistik" footer={`Quelle: Stats-XML, gespeichert ${datumZeit(s.abgerufen)}.`}>
            <Card>
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b border-separator text-[13px] text-label-2">
                    <th className="py-2 pl-4 text-left font-normal" />
                    <th className="py-2 text-right font-normal">{heim.name}</th>
                    <th className="py-2 pr-4 text-right font-normal">{gast.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {STAT.map(([k, label]) => (
                    <tr key={k}>
                      <td className="py-2 pl-4">{label}</td>
                      <td className="py-2 text-right tabular-nums">{heim.statistik[k] ?? "n. v."}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{gast.statistik[k] ?? "n. v."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
        </div>
      </div>
    </>
  );
}
