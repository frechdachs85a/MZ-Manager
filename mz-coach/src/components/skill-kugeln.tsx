import type { SkillWert } from "@/lib/mz/skills";

// 10 Kugeln wie auf ManagerZone. Ausgemaxte Skills rot, trainierbare in Akzentfarbe,
// Skills ohne Rot/Schwarz-Angabe (Erfahrung, Form: nicht trainierbar) grau.
// kompakt: niedrigere Zeilen für Listen mit mehreren Spielern (Bietomat)
export function SkillKugeln({ label, skill, kompakt }: { label: string; skill?: SkillWert; kompakt?: boolean }) {
  return (
    <div className={`flex items-center ${kompakt ? "min-h-6 gap-2" : "min-h-9 gap-3"}`}>
      <span className={`shrink-0 ${kompakt ? "w-[104px] text-[13px]" : "w-[118px] text-[15px]"}`}>
        {label}
        {skill?.markierung === 1 && <sup className="ml-0.5 text-[11px] font-semibold text-green">1</sup>}
        {skill?.markierung === 2 && <sup className="ml-0.5 text-[11px] font-semibold text-orange">2</sup>}
      </span>
      {skill ? (
        <>
          <span className="flex flex-1 gap-[3px]" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`h-[10px] flex-1 rounded-[3px] ${
                  i < skill.wert
                    ? skill.gemaxt === undefined
                      ? "bg-skill-fix"
                      : skill.gemaxt
                        ? "bg-skill-max"
                        : "bg-skill-train"
                    : "bg-fill"
                }`}
              />
            ))}
          </span>
          <span className={`w-6 text-right font-semibold tabular-nums ${kompakt ? "text-[13px]" : "text-[15px]"} ${skill.gemaxt ? "text-skill-max" : ""}`}>
            {skill.wert}
          </span>
          {skill.gemaxt !== undefined && <span className="sr-only">{skill.gemaxt ? "ausgemaxt" : "trainierbar"}</span>}
        </>
      ) : (
        <span className="flex-1 text-[13px] text-label-2">nicht verfügbar</span>
      )}
    </div>
  );
}
