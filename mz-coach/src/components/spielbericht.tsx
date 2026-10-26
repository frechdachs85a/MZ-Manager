import { Card, Section } from "@/components/ui";
import { quoteText, type SpielBericht, type SpielerWert, type TeamWerte } from "@/lib/mz/analyse/bericht";

// Ausführlicher Spielbericht: Fakten, Halbzeiten, Spielerwerte. Alles aus der Stats-XML (lib/mz/analyse/bericht.ts).

const ZEILEN: [string, (w: TeamWerte) => string][] = [
  ["Tore", (w) => String(w.tore ?? "n. v.")],
  ["Ballbesitz", (w) => (w.ballbesitz !== undefined ? `${w.ballbesitz} %` : "n. v.")],
  ["Schüsse aufs Tor", (w) => String(w.schuesseTor ?? "n. v.")],
  ["Schüsse daneben", (w) => String(w.schuesseDaneben ?? "n. v.")],
  ["Paraden", (w) => String(w.paraden ?? "n. v.")],
  ["Pässe angekommen", (w) => String(w.paesse ?? "n. v.")],
  ["Passquote", (w) => quoteText(w.passquote)],
  ["Zweikampfquote", (w) => quoteText(w.zweikaempfe)],
  ["Ecken", (w) => String(w.ecken ?? "n. v.")],
  ["Freistöße", (w) => String(w.freistoesse ?? "n. v.")],
];

const th = "px-3 py-2 font-semibold first:pl-4 last:pr-4";
const td = "px-3 py-1.5 tabular-nums first:pl-4 last:pr-4";

function Spielertabelle({ spieler }: { spieler: SpielerWert[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13.5px]">
        <thead>
          <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
            <th className={th}>Spieler</th>
            <th className={th}>Rolle</th>
            <th className={`${th} text-right`}>Tore</th>
            <th className={`${th} text-right`}>Vorl.</th>
            <th className={`${th} text-right`}>Schüsse (Tor)</th>
            <th className={`${th} text-right`}>Pässe</th>
            <th className={`${th} text-right`}>Passquote</th>
            <th className={`${th} text-right`}>Zweikämpfe</th>
            <th className={`${th} text-right`}>Ballgew.</th>
            <th className={`${th} text-right`}>Paraden</th>
            <th className={th}>Wechsel / Karten</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {spieler.map((p) => (
            <tr key={p.id} className={p.start ? "" : "text-label-2"}>
              <td className={`${td} font-medium`}>{p.name}</td>
              <td className={td}>{p.rolle ?? "eingewechselt"}</td>
              <td className={`${td} text-right font-semibold`}>{p.tore || ""}</td>
              <td className={`${td} text-right`}>{p.vorlagen || ""}</td>
              <td className={`${td} text-right`}>
                {p.schuesseTor + p.schuesseDaneben ? `${p.schuesseTor + p.schuesseDaneben} (${p.schuesseTor})` : ""}
              </td>
              <td className={`${td} text-right`}>{p.paesse || ""}</td>
              <td className={`${td} text-right`}>{p.passquote ? quoteText(p.passquote) : ""}</td>
              <td className={`${td} text-right`}>{p.zweikaempfe ? `${quoteText(p.zweikaempfe)} von ${p.zweikaempfe.von}` : ""}</td>
              <td className={`${td} text-right`}>{p.ballgewinne || ""}</td>
              <td className={`${td} text-right`}>{p.paraden || ""}</td>
              <td className={td}>
                {[p.rein !== undefined ? `rein ${p.rein}.` : "", p.raus !== undefined ? `raus ${p.raus}.` : "", ...p.karten].filter(Boolean).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// Abschnitte des Spielberichts
export function SpielberichtTeile({ b }: { b: SpielBericht }) {
  return (
    <>
      <Section title="Spielbericht" footer="Alle Aussagen aus der Stats-XML. Noten gibt die XML nicht her.">
        <Card className="p-4">
          <ul className="space-y-1.5 text-[14.5px] leading-relaxed">
            {b.fakten.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-tint" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      {b.halbzeiten && (
        <Section
          title="Halbzeiten"
          footer="1. Halbzeit aus HalfStatistics, 2. Halbzeit = Endwert minus 1. Halbzeit, Ballbesitz der 2. Halbzeit aus possessionTicks. Passquote = angekommene Pässe ÷ (angekommen + abgefangen + ins Aus)."
        >
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                  <th className={th}>Wert</th>
                  <th className={`${th} text-right`}>1. HZ {b.eigen.name}</th>
                  <th className={`${th} text-right`}>1. HZ {b.gegner.name}</th>
                  <th className={`${th} text-right`}>2. HZ {b.eigen.name}</th>
                  <th className={`${th} text-right`}>2. HZ {b.gegner.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {ZEILEN.map(([label, f]) => (
                  <tr key={label}>
                    <td className={`${td} text-label-2`}>{label}</td>
                    <td className={`${td} text-right font-semibold`}>{f(b.halbzeiten![0].eigen)}</td>
                    <td className={`${td} text-right`}>{f(b.halbzeiten![0].gegner)}</td>
                    <td className={`${td} text-right font-semibold`}>{f(b.halbzeiten![1].eigen)}</td>
                    <td className={`${td} text-right`}>{f(b.halbzeiten![1].gegner)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      )}

      <Section title={`Spielerwerte ${b.eigen.name}`} footer="Startelf zuerst, Rolle aus der Startposition. Grau: eingewechselt. Zweikämpfe = gewonnene Anteile.">
        <Spielertabelle spieler={b.spieler} />
      </Section>
      <Section title={`Spielerwerte ${b.gegner.name}`}>
        <Spielertabelle spieler={b.gegnerSpieler} />
      </Section>
    </>
  );
}
