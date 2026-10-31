import { parse } from "node-html-parser";

// „Deine Gebote“ aus der Gebotsübersicht (ajax.php?p=transfer&sub=your-bids, JSON {content: HTML}; Aufbau gesehen am
// 31.10.2026): je Gebot ein Block yourbids___title_N mit Spielerlink ?p=transfer&sub=players&u=PID, Auktionsende,
// „Letztes Gebot: 1 400 001 EUR“ und ggf. „Kosten für die Arbeitsbewilligung: 139 191 EUR“, darunter
// yourbids___body_N mit „Mannschaft:“ (Link ?p=team&tid=…), die das letzte Gebot hält.

export type EigenesGebot = { pid: number; name: string; ende?: string; letztesGebot?: number; arbeitsbewilligung?: number; tid?: number; team?: string };

const euro = (t?: string) => {
  const z = t?.replace(/&nbsp;| |\s|\./g, "").match(/^(\d+)EUR/);
  return z ? Number(z[1]) : undefined;
};

export function eigeneGebote(antwort: string): EigenesGebot[] {
  let html = antwort;
  try {
    html = (JSON.parse(antwort) as { content?: string }).content ?? antwort;
  } catch {
    // schon HTML
  }
  const doc = parse(html);
  const out: EigenesGebot[] = [];
  for (const titel of doc.querySelectorAll('td[name^="yourbids___title_"]')) {
    const n = titel.getAttribute("name")!.replace("yourbids___title_", "");
    const link = titel.querySelector('a[href*="u="]');
    const pid = Number((link?.getAttribute("href") ?? "").match(/[?&]u=(\d+)/)?.[1]);
    if (!pid) continue;
    const text = titel.text.replace(/\s+/g, " ");
    const ende = text.match(/(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2})/);
    const letztes = text.match(/Letztes Gebot:\s*([\d\s.]+EUR)/);
    const bewilligung = text.match(/Arbeitsbewilligung:\s*([\d\s.]+EUR)/);
    const body = doc.querySelector(`#yourbids___body_${n}`);
    const team = body?.querySelectorAll("td").find((td) => td.text.trim() === "Mannschaft:")?.nextElementSibling?.querySelector('a[href*="tid="]');
    out.push({
      pid,
      name: link!.text.trim(),
      ende: ende ? `${ende[3]}-${ende[2]}-${ende[1]} ${ende[4]}` : undefined,
      letztesGebot: euro(letztes?.[1]),
      arbeitsbewilligung: euro(bewilligung?.[1]),
      tid: Number((team?.getAttribute("href") ?? "").match(/[?&]tid=(\d+)/)?.[1]) || undefined,
      team: team?.text.trim(),
    });
  }
  return out;
}
