import type { SkillWert } from "@/lib/mz/skills";

// 10 Kugeln wie auf ManagerZone. Ausgemaxte Skills rot, trainierbare in Akzentfarbe.
export function SkillKugeln({ label, skill }: { label: string; skill?: SkillWert }) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <span className="w-[118px] shrink-0 text-[15px]">
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
                className={`h-[11px] flex-1 rounded-full ${
                  i < skill.wert ? (skill.gemaxt ? "bg-red" : "bg-tint") : "bg-fill"
                }`}
              />
            ))}
          </span>
          <span className={`w-6 text-right text-[15px] font-semibold tabular-nums ${skill.gemaxt ? "text-red" : ""}`}>
            {skill.wert}
          </span>
          <span className="sr-only">{skill.gemaxt ? "ausgemaxt" : "trainierbar"}</span>
        </>
      ) : (
        <span className="flex-1 text-[13px] text-label-2">nicht verfügbar</span>
      )}
    </div>
  );
}
