// Stats-XML von ManagerZone holen, ohne Login (für Ligaspiele beobachtet am 25.10.2026, docs/mz-seiten.md):
// 1. getMatchFiles holen. Ist die Antwort leer:
// 2. check-match alle 6 s aufrufen. Erste Antwort ist meist "queued" mit "Error preparing match!",
//    danach "ok". "blocked" = nur eingeloggt sichtbar (z. B. Scoutspiele).
// 3. getMatchFiles erneut holen. Bleibt sie leer: "XML LEER".
// Höflich: immer nur ein Spiel, Pausen zwischen den Anfragen. Gespeicherte Spiele nie erneut.

export const UA = "MZ-Coach (persoenlicher Assistent fuer FC Toho)";
const basis = () => process.env.MZ_BASIS_URL ?? "https://www.managerzone.com";

export type HolOptionen = {
  holen?: (url: string) => Promise<string>;
  warte?: (ms: number) => Promise<void>;
  versuche?: number; // check-match-Versuche
  pauseMs?: number;
};

export type HolErgebnis =
  | { ok: true; xml: string; checks: number }
  | { ok: false; grund: "leer" | "gesperrt" | "fehler"; text: string; checks: number };

const standardHolen = async (url: string) => {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
};
const schlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Stats-XML eines Spiels holen (ohne Login, mit Wiederholung)
export async function holeStatsXml(mid: number, opt: HolOptionen = {}): Promise<HolErgebnis> {
  const holen = opt.holen ?? standardHolen;
  const warte = opt.warte ?? schlafen;
  const versuche = opt.versuche ?? 10;
  const pause = opt.pauseMs ?? 6000;
  const statsUrl = `${basis()}/matchviewer/getMatchFiles.php?type=stats&mid=${mid}&sport=soccer`;
  const checkUrl = `${basis()}/ajax.php?p=matchViewer&sub=check-match&type=2d&mid=${mid}&sport=soccer`;
  const hatXml = (t: string) => /<SoccerStatistics[\s>]/.test(t) && /<\/SoccerStatistics>/.test(t);
  try {
    let xml = await holen(statsUrl);
    if (hatXml(xml)) return { ok: true, xml, checks: 0 };
    let checks = 0;
    for (; checks < versuche; ) {
      await warte(pause);
      checks++;
      const antwort = await holen(checkUrl);
      let response = "";
      try {
        response = (JSON.parse(antwort) as { response?: string }).response ?? "";
      } catch {
        return { ok: false, grund: "fehler", text: `check-match: unerwartete Antwort „${antwort.slice(0, 60)}“`, checks };
      }
      if (response === "blocked") return { ok: false, grund: "gesperrt", text: "Nur eingeloggt sichtbar (z. B. Scoutspiel).", checks };
      if (response === "ok") break;
    }
    await warte(3000);
    xml = await holen(statsUrl);
    if (hatXml(xml)) return { ok: true, xml, checks };
    return { ok: false, grund: "leer", text: `XML LEER nach ${checks} Prüfungen.`, checks };
  } catch (e) {
    return { ok: false, grund: "fehler", text: e instanceof Error ? e.message : String(e), checks: 0 };
  }
}
