import { SkillKugeln } from "@/components/skill-kugeln";
import { MarktInfo } from "@/components/markt-info";
import { Countdown } from "@/components/countdown";
import { ablehnen, annehmen } from "@/app/(app)/markt/actions";
import { potenzial } from "@/lib/mz/analyse/potenzial";
import type { Bewertung } from "@/lib/mz/analyse/markt";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";
import type { Verkauf } from "@/lib/mz/parser/verkauf";
import { ALLE_SKILLS, SKILL_LABEL } from "@/lib/mz/skills";
import { mzMarktLink, posDe, type Position } from "@/lib/mz/formel";
import { endeIso } from "@/lib/markt-ende";

// Spielerkarte des Transfermarkts (Marcus, 31.10.2026): dasselbe Design in Vorschläge, Watchlist und Gebote. Wer, für
// wen, wie viel besser, Potenzial, alle Skills, Preis, Restzeit bis Auktionsende; unten die Knöpfe des jeweiligen Reiters.

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

// Alter groß und farbig (Marcus, 01.11.2026: beim Kauf entscheidend, 1 Mio für einen 20-Jährigen ist mehr wert als für
// einen 33-Jährigen). Farbe nur als Lesehilfe: bis 23 grün, 24 bis 29 neutral, ab 30 orange.
function AlterChip({ alter }: { alter?: number }) {
  const farbe = alter === undefined ? "bg-fill text-label-2" : alter <= 23 ? "bg-green/15 text-green" : alter >= 30 ? "bg-orange/15 text-orange" : "bg-fill text-label";
  return (
    <span className={`inline-flex items-baseline gap-1 rounded-[8px] px-2 py-0.5 ${farbe}`} title="Alter">
      <span className="display text-[20px] font-bold leading-none tabular-nums">{alter ?? "?"}</span>
      <span className="text-[11px] font-semibold">Jahre</span>
    </span>
  );
}

export type Verbesserung = { rolle: string; statt: string; alt: number; neu: number; gewinn: number; preis?: number; fuer?: string };

export function SpielerKarte({
  k,
  v,
  verkauf,
  rang,
  ende,
  hinweise = [],
  zusatz,
  fuss,
  badge,
}: {
  k: MarktSpieler;
  v: Verbesserung | null;
  verkauf?: Verkauf;
  rang?: number;
  ende?: string; // ISO; ohne: aus der Momentaufnahme des Spielers
  hinweise?: string[];
  zusatz?: React.ReactNode; // z. B. dein Gebot
  fuss: React.ReactNode;
  badge?: string;
}) {
  const p = v ? potenzial(k.skills, v.rolle as Position) : { trainierbar: [] as string[], plusEins: undefined };
  const endeZeit = ende ?? endeIso(k.markt.ende);
  return (
    <article className="karte flex flex-col overflow-hidden rounded-[14px] bg-card">
      <header className="flex items-start justify-between gap-3 bg-gradient-to-br from-tint/15 to-transparent px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-label-3">
            {rang !== undefined ? `#${rang} · ` : ""}
            {v ? `als ${posDe(v.rolle)}${v.fuer ? ` für ${v.fuer}` : ""} statt ${v.statt.split(" ").at(-1)}` : "Rolle nicht bewertbar"}
          </div>
          <a
            href={mzMarktLink(k.pid)}
            title="Auf dem Transfermarkt von ManagerZone öffnen"
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block text-[19px] font-bold leading-tight hover:underline"
          >
            {k.name}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-label-2">
            <AlterChip alter={k.alter} />
            {k.nationalitaet ?? "Nationalität ?"}
            {badge && <span className="ml-2 rounded-full bg-green/15 px-2 py-0.5 text-[11px] font-semibold text-green">{badge}</span>}
          </div>
          <div className="mt-1 text-[13px]">
            <Countdown ende={endeZeit} />
          </div>
        </div>
        {v && (
          <div className={`shrink-0 rounded-[12px] px-3 py-2 text-center ${v.gewinn > 0 ? "bg-tint text-auf-akzent" : "bg-fill text-label-2"}`}>
            <div className="text-[22px] font-bold leading-none tabular-nums">
              {v.gewinn > 0 ? "+" : ""}
              {komma(v.gewinn)}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">MZ-Wert</div>
            {v.preis !== undefined && v.gewinn > 0 && (
              <div className="mt-1 text-[10.5px] tabular-nums opacity-90" title="MZ-Gewinn je Million Mindestpreis">
                {komma(v.gewinn / Math.max(1, v.preis / 1_000_000))} je Mio €
              </div>
            )}
          </div>
        )}
      </header>

      {zusatz && <div className="px-4 pt-2">{zusatz}</div>}

      {v && (
        <div className="space-y-1.5 px-4 pt-2">
          <div className="text-[11px] text-label-3">MZ-Wert als {posDe(v.rolle)} (0 bis 10)</div>
          <Balken label={`${v.fuer ? "Dein bester dort" : "Dein Spieler"}: ${v.statt.split(" ").at(-1)}`} wert={v.alt} ton="alt" />
          <Balken label={`Vorschlag: ${k.name.split(" ").at(-1)}`} wert={v.neu} ton="neu" />
          {p.plusEins !== undefined && p.plusEins > v.neu && <Balken label="Vorschlag nach Training" wert={p.plusEins} ton="pot" />}
          <div className="text-[12px] text-label-2">
            {p.trainierbar.length ? (
              <>„Nach Training“ = je ein Ball mehr in diesen noch trainierbaren Skills: {p.trainierbar.join(", ")}</>
            ) : (
              "Alle Skills dieser Rolle sind ausgemaxt, keine Steigerung durch Training"
            )}
          </div>
        </div>
      )}

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
        {hinweise.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[12px] text-orange">
            {hinweise.map((h) => (
              <li key={h}>• {h}</li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-auto border-t border-separator p-3">{fuss}</footer>
    </article>
  );
}

// Reiter Vorschläge: Annehmen (Watchlist) oder Ablehnen
export function VorschlagKarte({ b, verkauf, imBietomat, rang }: { b: Bewertung; verkauf?: Verkauf; imBietomat?: number; rang: number }) {
  const k = b.kandidat;
  return (
    <SpielerKarte
      k={k}
      v={{ rolle: b.ziel.rolle, statt: b.ziel.spieler.name, alt: b.ziel.wert, neu: b.neu, gewinn: b.gewinn, preis: b.preis, fuer: b.ziel.fuer }}
      verkauf={verkauf}
      rang={rang}
      badge={imBietomat ? "im Bietomat" : undefined}
      hinweise={b.vorbehalte.slice(1).filter((v) => !v.startsWith("Auktionsende") && !v.startsWith("Rahmen nicht eingetragen"))}
      fuss={
        <div className="grid grid-cols-2 gap-2">
          <form action={ablehnen}>
            <input type="hidden" name="pid" value={k.pid} />
            <input type="hidden" name="name" value={k.name} />
            <button className="pressable min-h-[42px] w-full rounded-[10px] border border-red/40 text-[14px] font-semibold text-red">Ablehnen</button>
          </form>
          <form action={annehmen}>
            <input type="hidden" name="pid" value={k.pid} />
            <button className="pressable min-h-[42px] w-full rounded-[10px] bg-green text-[14px] font-semibold text-white">Annehmen</button>
          </form>
        </div>
      }
    />
  );
}
