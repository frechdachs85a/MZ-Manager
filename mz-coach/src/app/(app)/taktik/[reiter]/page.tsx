import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Spielfeld } from "@/components/spielfeld";
import { Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { datumZeit, spielDatum } from "@/lib/format";
import { de } from "@/lib/mz/analyse/gegner";
import { aufstellung } from "@/lib/mz/taktik/xml";
import { archivLaden, spieleJeTaktik } from "@/lib/taktik-archiv";
import { taktikEntfernen } from "../actions";

const NAMEN = ["Startaufstellung", "Alternative 1", "Alternative 2"];

export default async function TaktikDetail(props: PageProps<"/taktik/[reiter]">) {
  await connection();
  const reiter = decodeURIComponent((await props.params).reiter);
  const db = getDb();
  const archiv = archivLaden(db);
  const a = archiv.find((x) => x.reiter === reiter);
  if (!a) notFound();
  const kader = new Map(ladeKader(db).map((s) => [s.pid, s]));
  const kurz = (pid: number) => {
    const t = kader.get(pid)?.name.split(" ");
    return t ? (t.length > 1 ? `${t[0][0]} ${t.slice(1).join(" ")}` : t[0]) : String(pid);
  };
  const spiele = spieleJeTaktik(db, archiv).get(reiter) ?? [];
  const t = a.taktik;

  return (
    <>
      <PageHeader
        title={reiter}
        subtitle={t ? `${de(t.team.tactics ?? "")} / ${de(t.team.playstyle ?? "")} / ${de(t.team.aggression ?? "")} · gespeichert ${datumZeit(a.gespeichert)}` : "XML nicht lesbar"}
      />
      <div className="seite">
        {t && (
          <Section title="Aufstellungen" footer="Rot = laut Taktikseite nicht aufstellbar (Kegel) oder verletzt. Heatmap = Marktwert, feste Grenzen für alle Teams (Legende unter dem Feld).">
            <div className="grid gap-5 lg:grid-cols-3">
              {([0, 1, 2] as const).map((k) => {
                const st = aufstellung(t, k).filter((s) => s.p);
                if (k > 0 && st.length === 0) return null;
                return (
                  <Card key={k} className="p-4">
                    <Spielfeld
                      titel={NAMEN[k]}
                      spieler={st.map((s) => {
                        const sp = kader.get(s.pid);
                        const rot = sp?.status?.aufstellbar === false || sp?.status?.verletzt;
                        return { x: s.p!.x, y: s.p!.y, label: kurz(s.pid), wert: sp?.marktwert, torwart: s.pos === "goalie", ton: rot ? "rot" : "normal" };
                      })}
                      heatmap
                    />
                  </Card>
                );
              })}
            </div>
          </Section>
        )}
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-10">
          <Section title="Prüfung" footer="Prüfliste aus mz-wissen.md, Abschnitt 5, gegen den aktuellen Kader.">
            {a.pruefung ? (
              <List>
                {a.pruefung.fehler.map((f, i) => (
                  <Row key={`f${i}`} title={<span className="text-red">Fehler (Regel {f.regel})</span>} detail={f.text} />
                ))}
                {a.pruefung.hinweise.map((f, i) => (
                  <Row key={`h${i}`} title={<span className="text-orange">Hinweis (Regel {f.regel})</span>} detail={f.text} />
                ))}
                {a.pruefung.fehler.length + a.pruefung.hinweise.length === 0 && <Row title="Keine Fehler, keine Hinweise" />}
              </List>
            ) : (
              <Card className="p-5 text-[14px] text-red">{a.xmlFehler}</Card>
            )}
          </Section>
          <Section title="Gespielt mit dieser Taktik" footer="Eigene gespeicherte Spiele, deren Startaufstellung bis auf 2 Punkte passt.">
            {spiele.length ? (
              <List>
                {spiele.map((s) => (
                  <li key={s.mid} className="!px-0">
                    <Link href={`/spiele/${s.mid}`} className="zeile-hover flex items-center justify-between gap-3 px-5 py-3">
                      <span>
                        <span className="block text-[15px] font-medium">{s.gegner}</span>
                        <span className="block text-[13px] text-label-2">
                          {spielDatum(s.datum)} · Ballbesitz {s.ballbesitz ?? "n. v."} %
                        </span>
                      </span>
                      <span className="display text-[20px] font-semibold tabular-nums">
                        {s.eigen}:{s.gegnerTore}
                      </span>
                    </Link>
                  </li>
                ))}
              </List>
            ) : (
              <Card className="p-5 text-[14px] text-label-2">Noch kein gespeichertes eigenes Spiel passt zu dieser Aufstellung.</Card>
            )}
          </Section>
        </div>
        <form action={taktikEntfernen} className="mt-10">
          <input type="hidden" name="reiter" value={reiter} />
          <button className="pressable text-[14px] text-red">Aus dem Archiv entfernen</button>
        </form>
      </div>
    </>
  );
}
