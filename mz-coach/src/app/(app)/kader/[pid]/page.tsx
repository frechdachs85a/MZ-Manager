import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { SkillKugeln } from "@/components/skill-kugeln";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { datumZeit, euro, heuteInBerlin } from "@/lib/format";
import { datumKurz, einsatzImLigaspiel, tag } from "@/lib/mz/einsatz";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";
import { GEWICHTE, mzWert, POSITIONEN } from "@/lib/mz/formel";
import { ALLE_SKILLS, SKILL_LABEL } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";

export default async function SpielerSeite(props: PageProps<"/kader/[pid]">) {
  await connection();
  const { pid } = await props.params;
  const s = ladeKader(getDb()).find((x) => x.pid === Number(pid));
  if (!s) notFound();

  return (
    <>
      <PageHeader title={s.name} subtitle={[s.nr && `Nr. ${s.nr}`, s.alter !== undefined && `${s.alter} Jahre`].filter(Boolean).join(" · ")} />
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-8">
        <Section
          title="Skills"
          footer={`Rot = ausgemaxt, blau = trainierbar, grau = nicht trainierbar (Erfahrung, Form). ${
            s.scoutMarkierung
              ? "Hochgestellt 1 = Hoch, 2 = Niedrig laut Scoutbericht."
              : s.statusStand?.scout
                ? "Kein Scoutbericht für diesen Spieler."
                : "Markierung 1/2: Spieleransicht (?p=players) noch nicht eingelesen."
          }`}
        >
          <Card className="px-4 py-2">
            {ALLE_SKILLS.map((k) => (
              <SkillKugeln
                key={k}
                label={SKILL_LABEL[k]}
                skill={s.skills[k] && { ...s.skills[k], markierung: s.scoutMarkierung?.[k] }}
              />
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

        <Section title="Status">
          <StatusListe s={s} />
        </Section>

        <Section title="Details" footer={`Quelle: ${s.quelle}, abgerufen ${datumZeit(s.abgerufen)}`}>
          <List>
            <Row title="Marktwert" value={s.marktwert !== undefined ? euro(s.marktwert) : "nicht verfügbar"} />
            <Row
              title="Scoutbericht"
              value={s.scoutSterne ? `Hoch ${s.scoutSterne.hoch ?? "?"} · Niedrig ${s.scoutSterne.niedrig ?? "?"}` : "nicht verfügbar"}
              detail={
                s.scoutSterne
                  ? `Sterne${s.scoutTraining !== undefined ? `, Tr. Geschwindigkeit ${s.scoutTraining}` : ""} · Stand ${datumZeit(s.statusStand!.scout!)}`
                  : s.statusStand?.scout
                    ? "kein Scoutbericht für diesen Spieler"
                    : "Spieleransicht (?p=players) noch nicht eingelesen"
              }
            />

            <Row title="pid" value={<span className="tabular-nums">{s.pid}</span>} />
          </List>
        </Section>
      </div>
    </>
  );
}

const stand = (iso?: string) => (iso ? `Stand ${datumZeit(iso)}` : "Seite noch nicht eingelesen");

function StatusListe({ s }: { s: SpielerDaten }) {
  const st = s.status ?? {};
  const ss = s.statusStand ?? {};
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const einsatz = einsatzImLigaspiel(s, spieltag);
  const tl = s.trainingslagerInfo;
  const jaNein = (v?: boolean) => (v === undefined ? "nicht verfügbar" : v ? "ja" : "nein");
  return (
    <List>
      <Row title={`Nächstes Ligaspiel (${datumKurz(tag(spieltag))})`} detail={einsatz.text} />
      <Row title="Aufstellbar" value={jaNein(st.aufstellbar)} detail={`Taktikseite, ${stand(ss.aufstellbar)}`} />
      <Row
        title="Trainingslager"
        value={jaNein(st.trainingslager)}
        detail={
          tl
            ? `${tl.paket}${tl.eigenschaft ? `, trainiert ${tl.eigenschaft}` : ""}, ${tl.start ? datumKurz(tl.start) : "?"} bis ${tl.ende ? datumKurz(tl.ende) : "?"}${tl.verbleibendeTage !== undefined ? `, noch ${tl.verbleibendeTage} Tage` : ""} · ${stand(ss.trainingslager)}`
            : stand(ss.trainingslager)
        }
      />
      <Row title="Verletzt" value={jaNein(st.verletzt)} detail={stand(ss.verletzt)} />
      <Row
        title="Gesperrt"
        value={jaNein(st.gesperrt)}
        detail={[
          ...(s.sperren ?? []).map((x) => `${x.karte}, ${x.spiele} Spiel(e), ${x.art}: ${x.wettbewerb} (${x.datum})`),
          stand(ss.gesperrt),
        ].join(" · ")}
      />
      <Row title="Transfermarkt" value="nicht verfügbar" detail="Quelle noch nicht eingebunden" />
    </List>
  );
}
