import { getDb } from "@/lib/db";
import { fernAbrufFrei, fernErlaubt } from "@/lib/fern";
import { kaderAbrufen } from "@/lib/mz/abruf/kader";
import { marktAbrufen } from "@/lib/mz/abruf/markt";
import { spieltagAbrufen } from "@/lib/mz/abruf/spieltag";
import { topAbrufen } from "@/lib/mz/abruf/top";
import { wertScanAbrufen } from "@/lib/mz/abruf/wertscan";
import { ligaHinterlegen } from "@/lib/mz/abruf/liga";
import { gebotsformularLesen, gebotsuebersichtLesen } from "@/lib/mz/abruf/bietomat";
import { scoutspieleAbrufen } from "@/lib/mz/abruf/scoutspiele";
import { ligaTabelleAbrufen } from "@/lib/mz/abruf/tabelle";

// Abruf für Claude mit Fernschlüssel starten (siehe src/lib/fern.ts): ?art=kader|markt|top|spieltag|wertscan|liga|gebotsformular|scoutspiele|tabelle (nur lesen). Läuft im Hintergrund,
// das Ergebnis steht danach im Abrufprotokoll der Diagnose. Gebremst je Art; nach "Passwort falsch" oder
// "gesperrt" blockiert die Sitzung selbst jeden weiteren Login.
const ABRUFE = { kader: kaderAbrufen, markt: marktAbrufen, top: topAbrufen, spieltag: spieltagAbrufen, wertscan: wertScanAbrufen, liga: ligaHinterlegen, gebotsformular: (db: Parameters<typeof gebotsformularLesen>[0]) => gebotsformularLesen(db), scoutspiele: (db: Parameters<typeof scoutspieleAbrufen>[0]) => scoutspieleAbrufen(db, { manuell: true }), tabelle: ligaTabelleAbrufen, gebotsuebersicht: (db: Parameters<typeof gebotsuebersichtLesen>[0]) => gebotsuebersichtLesen(db) } as const;

// Fernabruf starten (nur mit Fernschlüssel; je Art gebremst)
export async function POST(request: Request) {
  if (!fernErlaubt(request.headers.get("authorization"))) return new Response("nicht gefunden", { status: 404 });
  const url = new URL(request.url);
  const art = url.searchParams.get("art") ?? "";
  // Vorschlag der täglichen Prüfung für einen Reiter übernehmen (nur auf ausdrücklichen Wunsch von Marcus, z. B. 01.11.2026
  // „zieh I nun bitte nach“). Schreibt ausschließlich die von der Prüfung berechnete XML, keine fremde.
  if (art === "taktik-uebernehmen" || art === "regeln-ergaenzen") {
    const reiter = url.searchParams.get("reiter") ?? "";
    if (!reiter) return Response.json({ fehler: "reiter fehlt" }, { status: 400 });
    const db = getDb();
    const bremse = fernAbrufFrei(db, `${art}-${reiter}`);
    if (!bremse.frei) return Response.json({ gestartet: false, grund: `Bremse: nächster Abruf ab ${bremse.ab}` }, { status: 429 });
    const { taktikUebernehmen, regelnErgaenzen } = await import("@/lib/mz/abruf/liga");
    void (art === "regeln-ergaenzen" ? regelnErgaenzen(db, reiter) : taktikUebernehmen(db, reiter)).catch(() => {});
    return Response.json({ gestartet: true, art, reiter });
  }
  if (!(art in ABRUFE)) return Response.json({ fehler: "art muss kader, markt, top, spieltag, wertscan, liga, gebotsformular, scoutspiele, tabelle oder gebotsuebersicht sein" }, { status: 400 });
  const db = getDb();
  const bremse = fernAbrufFrei(db, art);
  if (!bremse.frei) return Response.json({ gestartet: false, grund: `Bremse: nächster Abruf ab ${bremse.ab}` }, { status: 429 });
  // Nach neuen Infos die Taktiken kontrollieren (Marcus, 31.10.2026); nicht nach dem Markt, Liga oder Gebotsformular
  const danach = ["kader", "spieltag", "scoutspiele", "tabelle"].includes(art);
  void ABRUFE[art as keyof typeof ABRUFE](db, { manuell: true })
    .then(async (r) => {
      if (r.ok && danach) {
        const { taktikenNachNeuenDaten } = await import("@/lib/nach-neuen-daten");
        await taktikenNachNeuenDaten(db, `Fernabruf ${art}`);
      }
    })
    .catch(() => {});
  return Response.json({ gestartet: true, art });
}
