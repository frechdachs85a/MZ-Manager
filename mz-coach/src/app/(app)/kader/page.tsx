import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, List, Row, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader, type KaderEintrag } from "@/lib/db/kader";
import { alleMzWerte, POSITIONEN } from "@/lib/mz/formel";
import { KADER_START, QUELLE_KADER } from "@/lib/wissen/startbasis";
import { datumZeit } from "@/lib/format";

export default async function Kader() {
  await connection();
  const kader = ladeKader(getDb());

  if (kader.length === 0) {
    return (
      <>
        <PageHeader title="Kader" subtitle={`${KADER_START.length} Spieler, noch kein Live-Abruf`} />
        <div className="seite">
          <Section
            title="Startbasis"
            footer={`Quelle: ${QUELLE_KADER}. Nur die dort notierten Skills, daher noch keine MZ-Werte. Alle Skills, Rot/Schwarz, Scout-Sterne und Status kommen mit dem ersten Abruf von ManagerZone.`}
          >
            <List>
              {KADER_START.map((s) => (
                <Row
                  key={s.pid}
                  title={
                    <span className="flex items-baseline gap-2">
                      <span className="w-6 shrink-0 text-right text-[15px] tabular-nums text-label-2">{s.nr}</span>
                      <span className="font-medium">{s.name}</span>
                    </span>
                  }
                  detail={<span className="block pl-8">{s.info || "keine Skills notiert"}</span>}
                  value={<span className="tabular-nums">{s.alter} J.</span>}
                />
              ))}
            </List>
          </Section>
        </div>
      </>
    );
  }

  const stand = kader.reduce((m, s) => (s.abgerufen > m ? s.abgerufen : m), "");
  return (
    <>
      <PageHeader title="Kader" subtitle={`${kader.length} Spieler · Stand ${datumZeit(stand)}`} />
      <div className="seite">
        {/* Desktop: Tabelle mit dem MZ-Wert jeder Position, bester Wert hervorgehoben */}
        <div className="hidden lg:block">
          <Section footer="MZ-Wert je Position nach der Formel aus mz-wissen.md, Abschnitt 6. Fett = bester Wert des Spielers. n. v. = nicht alle gewichteten Skills bekannt.">
            <KaderTabelle kader={kader} />
          </Section>
        </div>
        <div className="lg:hidden">
        <Section footer="Wert = höchster MZ-Wert über alle Positionen (Formel aus mz-wissen.md, Abschnitt 6).">
          <List>
            {kader.map((s) => {
              const werte = alleMzWerte(s.skills);
              const beste = POSITIONEN.flatMap((p) => {
                const w = werte[p];
                return w.ok ? [{ p, wert: w.wert }] : [];
              }).sort((a, b) => b.wert - a.wert)[0];
              const st = s.status ?? {};
              return (
                <li key={s.pid} className="!ml-0 !pr-0">
                  <Link href={`/kader/${s.pid}`} className="pressable flex min-h-11 items-center gap-3 py-2.5 pl-4 pr-3">
                    <span className="w-6 shrink-0 text-right text-[15px] tabular-nums text-label-2">{s.nr ?? ""}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-[17px] font-medium">
                        {s.name}
                        {st.verletzt && <Badge tone="red">verletzt</Badge>}
                        {st.gesperrt && <Badge tone="red">gesperrt</Badge>}
                        {st.trainingslager && <Badge tone="orange">Trainingslager</Badge>}
                        {st.transfermarkt && <Badge tone="tint">Markt</Badge>}
                      </span>
                      <span className="block text-[13px] text-label-2">
                        {s.alter !== undefined ? `${s.alter} J.` : "Alter nicht verfügbar"}
                      </span>
                    </span>
                    <span className="text-right">
                      {beste ? (
                        <>
                          <span className="block text-[17px] font-semibold tabular-nums">{beste.wert.toFixed(2)}</span>
                          <span className="block text-[12px] text-label-2">{beste.p}</span>
                        </>
                      ) : (
                        <span className="text-[13px] text-label-2">MZ-Wert n. v.</span>
                      )}
                    </span>
                    <svg viewBox="0 0 8 14" className="h-3.5 w-2 text-label-3" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m1 1 6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </List>
        </Section>
        </div>
      </div>
    </>
  );
}

function KaderTabelle({ kader }: { kader: KaderEintrag[] }) {
  return (
    <Card>
      <table className="w-full text-left text-[15px]">
        <thead>
          <tr className="border-b border-separator text-[13px] text-label-2">
            <th className="w-12 py-2.5 pl-4 text-right font-normal">Nr</th>
            <th className="py-2.5 pl-4 font-normal">Name</th>
            <th className="py-2.5 pl-4 text-right font-normal">Alter</th>
            {POSITIONEN.map((p) => (
              <th key={p} className="py-2.5 pl-4 text-right font-normal">{p}</th>
            ))}
            <th className="py-2.5 pr-4 pl-4 font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {kader.map((s) => {
            const werte = alleMzWerte(s.skills);
            const max = Math.max(...POSITIONEN.map((p) => { const w = werte[p]; return w.ok ? w.wert : -1; }));
            const st = s.status ?? {};
            return (
              <tr key={s.pid} className="transition-colors hover:bg-fill">
                <td className="py-2.5 pl-4 text-right tabular-nums text-label-2">{s.nr ?? ""}</td>
                <td className="py-2.5 pl-4 font-medium">
                  <Link href={`/kader/${s.pid}`} className="hover:text-tint">{s.name}</Link>
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums">{s.alter ?? "n. v."}</td>
                {POSITIONEN.map((p) => {
                  const w = werte[p];
                  return (
                    <td key={p} className={`py-2.5 pl-4 text-right tabular-nums ${w.ok && w.wert === max ? "font-semibold" : "text-label-2"}`}>
                      {w.ok ? w.wert.toFixed(2) : "n. v."}
                    </td>
                  );
                })}
                <td className="py-2.5 pr-4 pl-4">
                  <span className="flex flex-wrap gap-1">
                    {st.verletzt && <Badge tone="red">verletzt</Badge>}
                    {st.gesperrt && <Badge tone="red">gesperrt</Badge>}
                    {st.trainingslager && <Badge tone="orange">Trainingslager</Badge>}
                    {st.transfermarkt && <Badge tone="tint">Markt</Badge>}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
