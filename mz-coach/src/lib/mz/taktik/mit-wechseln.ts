import { pruefeTaktikGegenKader } from "@/lib/taktik-check";
import { erzeugeTaktik } from "./erzeugen";

// Neu erzeugte Taktik gleich mit den Ausdauer-Wechselregeln (Marcus, 01.11.2026: beim Import von 343kp fehlten sie; „das
// darfst du nicht vergessen“). Die Erzeugung stellt die beste Elf und die Bank auf; die tägliche Prüfung (taktik-check.ts)
// ergänzt danach dieselben Regeln wie bei jedem Reiter: Startspieler mit Ausdauer unter 8 werden in der 70. Minute durch den
// besten passenden Bankspieler ersetzt, höchstens 3 Wechsel. Geht die Prüfung nicht, bleibt die erzeugte Taktik und der
// Hinweis steht in `hinweise`.
export function erzeugeMitWechseln(opt: Parameters<typeof erzeugeTaktik>[0], reiter = "neu") {
  const e = erzeugeTaktik(opt);
  const c = pruefeTaktikGegenKader(reiter, e.xml, opt.kader, opt.spieltag);
  if (c.fehler) return { ...e, wechsel: [] as string[], hinweise: [...e.hinweise, `Wechselregeln nicht ergänzt: ${c.fehler}`] };
  return { ...e, xml: c.xml, wechsel: c.wechselregeln };
}
