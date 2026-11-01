import { Card } from "@/components/ui";
import { posDe } from "@/lib/mz/formel";
import { je90, MIN_MINUTEN, type Leistung } from "@/lib/spieler-leistung";

const k = (n: number) => n.toFixed(2).replace(".", ",");
const th = "px-3 py-2 text-right font-semibold first:pl-4 first:text-left last:pr-4";
const td = "px-3 py-1.5 text-right tabular-nums first:pl-4 first:text-left last:pr-4";

// Leistung je Rolle aus Spielen (je 90 Minuten); Zeilen mit wenig Spielzeit grau (Marcus, 01.11.2026)
export function LeistungTabelle({ zeilen, name }: { zeilen: { name?: string; l: Leistung }[]; name?: boolean }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[13.5px]">
        <thead>
          <tr className="border-b border-separator bg-card-2 text-[11px] uppercase tracking-wider text-label-3">
            {name && <th className={th}>Spieler</th>}
            <th className={th}>Rolle</th>
            <th className={th} title="Spiele (Liga + Scout)">Spiele</th>
            <th className={th}>Minuten</th>
            <th className={th} title="Tore je 90 Minuten">Tore/90</th>
            <th className={th} title="Vorlagen je 90 Minuten">Vorl./90</th>
            <th className={th} title="Schüsse aufs Tor je 90 Minuten">Schüsse/90</th>
            <th className={th} title="Zweikämpfe gewonnen : verloren">Zweikämpfe</th>
            <th className={th} title="Angekommene Pässe je 90 Minuten">Pässe/90</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {zeilen.map(({ name: n, l }, i) => (
            <tr key={i} className={l.minuten < MIN_MINUTEN ? "text-label-3" : ""} title={l.minuten < MIN_MINUTEN ? "Weniger als 90 Minuten: wenig Daten" : undefined}>
              {name && <td className={td}>{n}</td>}
              <td className={td}>{posDe(l.rolle)}</td>
              <td className={td}>
                {l.spiele} <span className="text-label-3">({l.quellen.liga} L / {l.quellen.scout} S)</span>
              </td>
              <td className={td}>{l.minuten}</td>
              <td className={td}>{k(je90(l.tore, l.minuten))}</td>
              <td className={td}>{k(je90(l.vorlagen, l.minuten))}</td>
              <td className={td}>{k(je90(l.schuesseAufsTor, l.minuten))}</td>
              <td className={td}>
                {l.zkGewonnen}:{l.zkVerloren}
              </td>
              <td className={td}>{Math.round(je90(l.paesse, l.minuten))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
