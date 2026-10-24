import { PageHeader } from "@/components/page-header";
import { List, Row, Section } from "@/components/ui";
import { KADER_START, QUELLE_KADER } from "@/lib/wissen/startbasis";

export default function Kader() {
  return (
    <>
      <PageHeader title="Kader" subtitle={`${KADER_START.length} Spieler`} />
      <div className="px-safe mx-auto max-w-2xl">
        <Section
          title="Startbasis"
          footer={`Quelle: ${QUELLE_KADER}. Nur die dort notierten Skills. Alle Skills, Rot/Schwarz, Scout-Sterne, Status und MZ-Werte kommen mit dem Live-Abruf in Etappe 2.`}
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
                detail={<span className="pl-8 block">{s.info || "keine Skills notiert"}</span>}
                value={<span className="tabular-nums">{s.alter} J.</span>}
              />
            ))}
          </List>
        </Section>
      </div>
    </>
  );
}
