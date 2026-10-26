import { SkillKugeln } from "@/components/skill-kugeln";
import { stufe } from "@/components/wert-stufe";
import { alleMzWerte, POSITIONEN } from "@/lib/mz/formel";
import { ALLE_SKILLS, SKILL_LABEL, type Skills } from "@/lib/mz/skills";

// Spieleransicht für den Bietomat (Marcus, 26.10.2026): MZ-Werte je Rolle (beste Rolle hervorgehoben), Scout-Sterne
// und alle Skills mit denselben Balken wie im Kader (rot = ausgemaxt, ¹ Stärke, ² Schwäche laut Scoutbericht).
// MZ-Wert nur, wenn alle nötigen Skills bekannt sind.

const komma = (n: number) => n.toFixed(2).replace(".", ",");
const sterne = (n?: number) => (n === undefined ? "–" : "★".repeat(n) || "0");

export function SpielerProfil({ skills, scout }: { skills: Skills; scout?: { hoch?: number; niedrig?: number; training?: number } }) {
  const werte = alleMzWerte(skills);
  const bekannt = POSITIONEN.filter((p) => werte[p].ok).map((p) => ({ p, w: (werte[p] as { wert: number }).wert }));
  const beste = [...bekannt].sort((a, b) => b.w - a.w)[0];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {bekannt.length ? (
          bekannt.map(({ p, w }) => (
            <span key={p} className={`rounded-[6px] px-1.5 py-0.5 text-[11.5px] tabular-nums ${stufe(w).cls} ${beste?.p === p ? "ring-2 ring-tint" : ""}`} title={`${p}: ${stufe(w).name}`}>
              {p} {komma(w)}
            </span>
          ))
        ) : (
          <span className="text-[11.5px] text-label-3">MZ-Werte: Skills unvollständig</span>
        )}
      </div>
      {beste && (
        <div className="text-[12px] text-label-2">
          Beste Rolle: <b>{beste.p}</b> ({komma(beste.w)}, {stufe(beste.w).name})
        </div>
      )}
      {scout && (
        <div className="flex flex-wrap gap-x-4 text-[12px] text-label-2">
          <span>
            Hoch<sup className="text-green">1</sup> <span className="text-[#d4a017]">{sterne(scout.hoch)}</span>
          </span>
          <span>
            Niedrig<sup className="text-orange">2</sup> <span className="text-[#d4a017]">{sterne(scout.niedrig)}</span>
          </span>
          <span>
            Tr. Geschwindigkeit <span className="text-[#d4a017]">{sterne(scout.training)}</span>
          </span>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-6">
        {ALLE_SKILLS.map((k) => (
          <SkillKugeln key={k} label={SKILL_LABEL[k]} skill={skills[k]} kompakt />
        ))}
      </div>
    </div>
  );
}
