import { SkillKugeln } from "@/components/skill-kugeln";
import { MarktInfo } from "@/components/markt-info";
import { ablehnen, annehmen } from "@/app/(app)/markt/actions";
import { potenzial } from "@/lib/mz/analyse/potenzial";
import type { Bewertung } from "@/lib/mz/analyse/markt";
import type { Verkauf } from "@/lib/mz/parser/verkauf";
import { ALLE_SKILLS, SKILL_LABEL } from "@/lib/mz/skills";
import { mzMarktLink, posDe } from "@/lib/mz/formel";

// Transfervorschlag als Karte (Marcus, 31.10.2026): wer, für wen, wie viel besser, Potenzial, alle Skills, Preis und Ende;
// Annehmen setzt ihn auf die Watchlist, Ablehnen nimmt ihn aus den Vorschlägen.

const komma = (n: number) => n.toFixed(2).replace(".", ",");

function Balken({ label, wert, max = 10, ton }: { label: string; wert: number; max?: number; ton: "alt" | "neu" | "pot" }) {
  const farbe = ton === "neu" ? "bg-tint" : ton === "pot" ? "bg-tint/35" : "bg-label-3";
  return (
    <div className="grid grid-cols-[minmax(0,13rem)_1fr_2.8rem] items-center gap-2 text-[12.5px]">
      <span className="truncate text-label-2">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-fill">
        <span className={`block h-full rounded-full ${farbe}`} style={{ width: `${(wert / max) * 100}%` }} />
      </span>
      <span className="text-right font-semibold tabular-nums">{komma(wert)}</span>
    </div>
  );
}

export function VorschlagKarte({ b, verkauf, imBietomat, rang }: { b: Bewertung; verkauf?: Verkauf; imBietomat?: number; rang: number }) {
  const k = b.kandidat;
  const p = potenzial(k.skills, b.ziel.rolle);
  return (
    <article className="karte flex flex-col overflow-hidden rounded-[14px] bg-card">
      <header className="flex items-start justify-between gap-3 bg-gradient-to-br from-tint/15 to-transparent px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-label-3">
            #{rang} · als {posDe(b.ziel.rolle)} statt {b.ziel.spieler.name.split(" ").at(-1)}
          </div>
          <a
            href={mzMarktLink(k.pid)} title="Auf dem Transfermarkt von ManagerZone öffnen"
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block text-[19px] font-bold leading-tight hover:underline"
          >
            {k.name}
          </a>
          <div className="text-[12.5px] text-label-2">
            {k.alter ?? "?"} J. · {k.nationalitaet ?? "Nationalität ?"}
            {imBietomat && <span className="ml-2 rounded-full bg-green/15 px-2 py-0.5 text-[11px] font-semibold text-green">im Bietomat</span>}
          </div>
        </div>
        <div className="shrink-0 rounded-[12px] bg-tint px-3 py-2 text-center text-auf-akzent">
          <div className="text-[22px] font-bold leading-none tabular-nums">+{komma(b.gewinn)}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">MZ-Wert</div>
          <div className="mt-1 text-[10.5px] tabular-nums opacity-90" title="MZ-Gewinn je Million Mindestpreis">
            {komma(b.gewinn / Math.max(1, b.preis / 1_000_000))} je Mio €
          </div>
        </div>
      </header>

      <div className="space-y-1.5 px-4 pt-1">
        <div className="text-[11px] text-label-3">MZ-Wert als {posDe(b.ziel.rolle)} (0 bis 10)</div>
        <Balken label={`Dein Spieler: ${b.ziel.spieler.name.split(" ").at(-1)}`} wert={b.ziel.wert} ton="alt" />
        <Balken label={`Vorschlag: ${k.name.split(" ").at(-1)}`} wert={b.neu} ton="neu" />
        {p.plusEins !== undefined && p.plusEins > b.neu && <Balken label="Vorschlag nach Training" wert={p.plusEins} ton="pot" />}
        <div className="text-[12px] text-label-2">
          {p.trainierbar.length ? (
            <>„Nach Training“ = je ein Ball mehr in diesen noch trainierbaren Skills: {p.trainierbar.join(", ")}</>
          ) : (
            "Alle Skills dieser Rolle sind ausgemaxt, keine Steigerung durch Training"
          )}
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-label-3">Skills</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5">
          {ALLE_SKILLS.map((s) => (
            <SkillKugeln key={s} label={SKILL_LABEL[s]} skill={k.skills[s]} kompakt />
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        <MarktInfo s={k} verkauf={verkauf} />
        {b.vorbehalte.slice(1).some((v) => !v.startsWith("Auktionsende") && !v.startsWith("Rahmen nicht eingetragen")) && (
          <ul className="mt-2 space-y-0.5 text-[12px] text-orange">
            {b.vorbehalte
              .slice(1)
              .filter((v) => !v.startsWith("Auktionsende") && !v.startsWith("Rahmen nicht eingetragen"))
              .map((v) => (
                <li key={v}>• {v}</li>
              ))}
          </ul>
        )}
      </div>

      <footer className="mt-auto grid grid-cols-2 gap-2 border-t border-separator p-3">
        <form action={ablehnen}>
          <input type="hidden" name="pid" value={k.pid} />
          <input type="hidden" name="name" value={k.name} />
          <button className="pressable min-h-[42px] w-full rounded-[10px] border border-red/40 text-[14px] font-semibold text-red">Ablehnen</button>
        </form>
        <form action={annehmen}>
          <input type="hidden" name="pid" value={k.pid} />
          <button className="pressable min-h-[42px] w-full rounded-[10px] bg-green text-[14px] font-semibold text-white">Annehmen</button>
        </form>
      </footer>
    </article>
  );
}
