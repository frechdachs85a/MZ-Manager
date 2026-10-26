import type { Anpassung } from "@/lib/wissen/scoutspiele";

// Wendet Anpassungen auf das XML einer Archiv-Taktik an, ohne sonst etwas zu ändern (Zeilen bleiben, wie
// ManagerZone sie exportiert hat). wechselzeit: jede Wechselregel mit diesem Ausgewechselten und Zeitbedingung
// unter der Minute wird auf diese Minute gesetzt.
export function anpassen(xml: string, anpassungen: Anpassung[]): { xml: string; geaendert: string[] } {
  const geaendert: string[] = [];
  let neu = xml;
  for (const a of anpassungen) {
    if (a.art !== "wechselzeit") continue;
    neu = neu.replace(/<TacticRule\b[^>]*\/>/g, (regel) => {
      if (!new RegExp(`\\bout_player="${a.outPid}"`).test(regel) || !/\bcheck_time="true"/.test(regel)) return regel;
      const m = regel.match(/\btime="(\d+)"/);
      if (!m || Number(m[1]) >= a.ab) return regel;
      geaendert.push(`Wechsel ${a.name}: Minute ${m[1]} → ${a.ab}`);
      return regel.replace(/\btime="\d+"/, `time="${a.ab}"`);
    });
  }
  return { xml: neu, geaendert };
}
