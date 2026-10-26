import { stufe } from "@/components/wert-stufe";
import { alleMzWerte, POSITIONEN } from "@/lib/mz/formel";
import { ALLE_SKILLS, SKILL_LABEL, type Skills } from "@/lib/mz/skills";

// Kompakte Spieleransicht für den Bietomat (Marcus, 26.10.2026): alle Skills und die MZ-Werte je Rolle, beste Rolle
// hervorgehoben, damit mehrere beobachtete Spieler auf einen Blick vergleichbar sind.
// Rot wie auf ManagerZone = Skill ausgereizt (gemaxt). MZ-Wert nur, wenn alle nötigen Skills bekannt sind.

const KURZ: Record<string, string> = {
  spieluebersicht: "Übersicht",
  erfahrung: "Erfahr.",
};
const komma = (n: number) => n.toFixed(2).replace(".", ",");

export function SpielerProfil({ skills }: { skills: Skills }) {
  const werte = alleMzWerte(skills);
  const bekannt = POSITIONEN.filter((p) => werte[p].ok).map((p) => ({
    p,
    w: (werte[p] as { wert: number }).wert,
  }));
  const beste = [...bekannt].sort((a, b) => b.w - a.w)[0];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {bekannt.length ? (
          bekannt.map(({ p, w }) => (
            <span
              key={p}
              className={`rounded-[6px] px-1.5 py-0.5 text-[11.5px] tabular-nums ${stufe(w).cls} ${beste?.p === p ? "ring-2 ring-tint" : ""}`}
              title={`${p}: ${stufe(w).name}`}
            >
              {p} {komma(w)}
            </span>
          ))
        ) : (
          <span className="text-[11.5px] text-label-3">MZ-Werte: Skills unvollständig</span>
        )}
      </div>
      {beste && (
        <div className="text-[11.5px] text-label-2">
          Beste Rolle: <b>{beste.p}</b> ({komma(beste.w)}, {stufe(beste.w).name})
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7.2rem,1fr))] gap-x-4 gap-y-0.5 text-[11.5px]">
        {ALLE_SKILLS.map((k) => {
          const s = skills[k];
          return (
            <span key={k} className="flex justify-between gap-1">
              <span className="whitespace-nowrap text-label-2">{KURZ[k] ?? SKILL_LABEL[k]}</span>
              <span className={`tabular-nums font-semibold ${s?.gemaxt ? "text-red" : ""}`}>{s ? s.wert : "–"}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
