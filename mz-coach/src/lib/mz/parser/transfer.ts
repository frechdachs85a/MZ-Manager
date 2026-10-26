import { parse, type HTMLElement } from "node-html-parser";
import { euro, KaderSeiteUnbekannt } from "./kader";
import { parseSpielerBlock, text, type SpielerBlock } from "./spielerblock";

// Antwort der Transfermarktsuche ajax.php?p=transfer&sub=transfer-search (nur eingeloggt;
// ohne Login antwortet sie mit "An error occurred: You need to be logged in", geprüft 25.10.2026).
// Aufbau laut Quelltext des Userscripts Mazyar (github.com/mz-ir/mazyar, src/tools.js und
// src/index.js): JSON { totalHits, players }, players = HTML mit div.playerContainer je Spieler,
// 20 Spieler je Seite (Parameter o = Versatz). Die Felder im Transferkasten liest Mazyar über
// die Position. An einer echten Antwort ist das noch NICHT geprüft: jede Abweichung wirft
// einen Fehler, statt Werte zu raten. Die Rohantwort wird gespeichert.

export type MarktSpieler = SpielerBlock & {
  markt: {
    gefordert?: number; // EUR, erstes Feld im Transferkasten (Mazyar: "fee")
    hoechstgebot?: number; // EUR, zweites Feld (Mazyar: "latestBid")
    ende?: string; // Auktionsende wie auf der Seite
    verkaeuferTid?: number; // Link ?p=team&tid=… im Transferkasten (Gebotsfenster zeigt "Verein: …")
    kasten: string; // gesamter Text des Transferkastens, zur Kontrolle
  };
};

export type TransferSuche = { treffer: number; spieler: MarktSpieler[] };

export function istNichtEingeloggt(antwort: string): boolean {
  return /You need to be logged in/i.test(antwort);
}



function marktFelder(block: HTMLElement): MarktSpieler["markt"] {
  const kasten = block.querySelector(".transfer-control-area");
  if (!kasten) throw new KaderSeiteUnbekannt("Spieler in der Marktsuche ohne Transferkasten (.transfer-control-area).");
  // Nach Beschriftung, nicht nach Position (26.10.2026 an echter Antwort geprüft: Zeilen "Verein", "Angebot endet",
  // "Startgebot", "Letztes Gebot:"; die Position verschob sich durch die Zeile "Verein")
  const wert = (beschriftung: RegExp) => {
    const td = kasten.querySelectorAll("td").find((x) => beschriftung.test(text(x)) && text(x).length < 30);
    const nb = td?.nextElementSibling as HTMLElement | null | undefined;
    return text(nb?.querySelector("strong") ?? nb) || undefined;
  };
  const ende = wert(/^Angebot endet:?$/i);
  const gefordert = wert(/^Startgebot:?$/i);
  const gebot = wert(/^Letztes Gebot:?$/i);
  const tid = kasten
    .querySelectorAll("a")
    .map((a) => (a.getAttribute("href") ?? "").match(/[?&]tid=(\d+)/)?.[1])
    .find(Boolean);
  return {
    verkaeuferTid: tid ? Number(tid) : undefined,
    gefordert: gefordert ? euro(gefordert) : undefined,
    hoechstgebot: gebot ? euro(gebot) : undefined,
    ende,
    kasten: text(kasten),
  };
}

export function parseTransferSuche(antwort: string): TransferSuche {
  if (istNichtEingeloggt(antwort)) throw new KaderSeiteUnbekannt("Marktsuche: nicht eingeloggt.");
  let json: { totalHits?: unknown; players?: unknown };
  try {
    json = JSON.parse(antwort);
  } catch {
    throw new KaderSeiteUnbekannt(`Marktsuche: keine JSON-Antwort („${antwort.slice(0, 60)}“).`);
  }
  const treffer = Number(json.totalHits);
  if (!Number.isInteger(treffer) || treffer < 0) throw new KaderSeiteUnbekannt("Marktsuche: totalHits fehlt.");
  if (treffer > 0 && typeof json.players !== "string") throw new KaderSeiteUnbekannt("Marktsuche: players fehlt.");
  const bloecke = parse(typeof json.players === "string" ? json.players : "").querySelectorAll("div.playerContainer");
  if (treffer > 0 && bloecke.length === 0) throw new KaderSeiteUnbekannt("Marktsuche: keine Spielerblöcke (div.playerContainer).");
  return { treffer, spieler: bloecke.map((b) => ({ ...parseSpielerBlock(b), markt: marktFelder(b) })) };
}

// Auktionsende "25-10-2026 18:30" (Format laut Mazyar) oder "25.10.2026 18:30" als Berliner Zeit (ISO ohne Zone)
export function endeAlsDatum(ende?: string): string | undefined {
  const m = ende?.match(/^(\d{2})[-.](\d{2})[-.](\d{4}) (\d{2}):(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : undefined;
}
