import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { SkillKugeln } from "@/components/skill-kugeln";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { datumZeit, zahl } from "@/lib/format";
import { GEWICHTE, mzWert, POSITIONEN } from "@/lib/mz/formel";
import { ALLE_SKILLS, SKILL_LABEL } from "@/lib/mz/skills";

export default async function SpielerSeite(props: PageProps<"/kader/[pid]">) {
  await connection();
  const { pid } = await props.params;
  const s = ladeKader(getDb()).find((x) => x.pid === Number(pid));
  if (!s) notFound();

  return (
    <>
      <PageHeader title={s.name} subtitle={[s.nr && `Nr. ${s.nr}`, s.alter !== undefined && `${s.alter} Jahre`].filter(Boolean).join(" · ")} />
      <div className="px-safe mx-auto max-w-2xl">
        <Section title="Skills" footer="Rot = ausgemaxt, blau = trainierbar. 1 = stärkste Skills, 2 = Schwächen.">
          <Card className="px-4 py-2">
            {ALLE_SKILLS.map((k) => (
              <SkillKugeln key={k} label={SKILL_LABEL[k]} skill={s.skills[k]} />
            ))}
          </Card>
        </Section>

        <Section title="MZ-Wert je Position" footer="Formel aus mz-wissen.md, Abschnitt 6. Ohne alle gewichteten Skills kein Wert.">
          <List>
            {POSITIONEN.map((p) => {
              const w = mzWert(s.skills, p);
              return (
                <Row
                  key={p}
                  title={p}
                  value={
                    w.ok ? (
                      <span className="font-semibold tabular-nums text-label">{w.wert.toFixed(2)}</span>
                    ) : (
                      <span className="text-[13px]">fehlt: {w.fehlend.map((f) => SKILL_LABEL[f]).join(", ")}</span>
                    )
                  }
                  detail={Object.entries(GEWICHTE[p])
                    .filter(([, g]) => g >= 0.15)
                    .map(([k, g]) => `${SKILL_LABEL[k as keyof typeof SKILL_LABEL]} ${g}`)
                    .join(" · ")}
                />
              );
            })}
          </List>
        </Section>

        <Section title="Details" footer={`Quelle: ${s.quelle}, abgerufen ${datumZeit(s.abgerufen)}`}>
          <List>
            <Row title="Marktwert" value={s.marktwert !== undefined ? zahl(s.marktwert) : "nicht verfügbar"} />
            <Row
              title="Scout"
              value={
                s.scoutSterne?.hoch !== undefined || s.scoutSterne?.niedrig !== undefined
                  ? `${s.scoutSterne?.hoch ?? "?"}/${s.scoutSterne?.niedrig ?? "?"}`
                  : "nicht verfügbar"
              }
            />
            <Row title="pid" value={<span className="tabular-nums">{s.pid}</span>} />
          </List>
        </Section>
      </div>
    </>
  );
}
