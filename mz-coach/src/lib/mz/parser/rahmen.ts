import type { MarktRahmenDaten } from "@/lib/db/markt";

// Rahmen aus dem Gebotsfenster (ajax.php?p=transfer&sub=bid-form&pid=…, gelesen 26.10.2026): Kasten
// "transfer_team_stats_list" mit "Ausländische Spieler: <span>n</span> (<em>maximum m</em>)", "Arbeitsbewilligungen: …"
// und "Verfügbarer Saldo: <span id="transfer_available_balance">3 482 080</span> EUR". Fehlt eine Zahl: null.
const zahl = (t: string) => Number(t.replace(/[^\d]/g, ""));

export function rahmenAusGebotsformular(html: string): MarktRahmenDaten | null {
  const aus = html.match(/Ausländische Spieler:\s*<span>\s*(\d+)\s*<\/span>\s*\(<em>\s*maximum\s+(\d+)\s*<\/em>\)/);
  const bew = html.match(/Arbeitsbewilligungen:\s*<span>\s*(\d+)\s*<\/span>\s*\(<em>\s*maximum\s+(\d+)\s*<\/em>\)/);
  const saldo = html.match(/id="transfer_available_balance">\s*([\d\s. ]+)\s*</);
  if (!aus || !bew || !saldo) return null;
  return { kapital: zahl(saldo[1]), auslaender: Number(aus[1]), auslaenderMax: Number(aus[2]), bewilligungen: Number(bew[1]), bewilligungenMax: Number(bew[2]) };
}
