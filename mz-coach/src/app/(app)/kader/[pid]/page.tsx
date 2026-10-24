import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { SkillKugeln } from "@/components/skill-kugeln";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { datumZeit, euro } from "@/lib/format";
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
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-8">
        <Section title="Skills" footer="Rot = ausgemaxt, blau = trainierbar, grau = nicht trainierbar (Erfahrung, Form). Markierung 1/2 (stärkste Skills/Schwächen): nicht verfügbar, steht nicht auf der Kaderübersicht.">
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
            <Row title="Marktwert" value={s.marktwert !== undefined ? euro(s.marktwert) : "nicht verfügbar"} />
            <Row
              title="Scout-Sterne"
              value={
                s.scoutSterne?.hoch !== undefined || s.scoutSterne?.niedrig !== undefined
                  ? `${s.scoutSterne?.hoch ?? "?"}/${s.scoutSterne?.niedrig ?? "?"}`
                  : "nicht verfügbar"
              }
              detail={s.scoutSterne ? undefined : "steht nicht auf der Kaderübersicht"}
            />
            <Row
              title="Status"
              value={s.status ? "siehe Kader" : "nicht verfügbar"}
              detail={s.status ? undefined : "verletzt, gesperrt, Trainingslager, Transfermarkt: steht nicht auf der Kaderübersicht"}
            />
            <Row title="pid" value={<span className="tabular-nums">{s.pid}</span>} />
          </List>
        </Section>
      </div>
    </>
  );
}
