import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { List, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { listeSpiele } from "@/lib/db/spiele";
import { EinfuegenForm } from "./einfuegen-form";

export default async function Spiele() {
  await connection();
  const spiele = listeSpiele(getDb());
  return (
    <>
      <PageHeader title="Spiele" subtitle={`${spiele.length} gespeichert`} />
      <div className="seite lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <Section title="Gespeicherte Spiele" footer="Jedes Spiel wird einmal gespeichert (Roh-XML und Auswertung) und nie erneut abgerufen.">
          {spiele.length === 0 ? (
            <p className="karte rounded-[18px] bg-card p-4 text-[15px] text-label-2">Noch keine Spiele gespeichert.</p>
          ) : (
            <List>
              {spiele.map((s) => (
                <li key={s.mid} className="!px-0">
                  <Link href={`/spiele/${s.mid}`} className="pressable zeile-hover flex min-h-12 items-center gap-3 py-3 pl-5 pr-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px]">
                        {s.heim} <span className="font-semibold tabular-nums">{s.tore}</span> {s.gast}
                      </span>
                      <span className="block text-[13px] text-label-2">
                        {s.datum ?? "Datum n. v."} · mid {s.mid}
                        {!s.final && " · nicht final"}
                      </span>
                    </span>
                    <svg viewBox="0 0 8 14" className="h-3.5 w-2 text-label-3" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m1 1 6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              ))}
            </List>
          )}
        </Section>
        <Section
          title="Spiel hinzufügen"
          footer="Auf ManagerZone erst die Prüfadresse check-match öffnen, bis „ok“ kommt, dann getMatchFiles.php?type=stats&mid=…&sport=soccer mit view-source: davor öffnen, alles kopieren und hier einfügen. Gespeicherte Dateien gehen auch über Einstellungen → Seiten übernehmen."
        >
          <EinfuegenForm />
        </Section>
      </div>
    </>
  );
}
