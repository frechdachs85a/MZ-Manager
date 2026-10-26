import { getDb } from "@/lib/db";
import { fernAbrufFrei, fernErlaubt } from "@/lib/fern";
import { kaderAbrufen } from "@/lib/mz/abruf/kader";
import { marktAbrufen } from "@/lib/mz/abruf/markt";
import { spieltagAbrufen } from "@/lib/mz/abruf/spieltag";
import { topAbrufen } from "@/lib/mz/abruf/top";
import { wertScanAbrufen } from "@/lib/mz/abruf/wertscan";
import { ligaHinterlegen } from "@/lib/mz/abruf/liga";
import { gebotsformularLesen } from "@/lib/mz/abruf/bietomat";

// Abruf für Claude mit Fernschlüssel starten (siehe src/lib/fern.ts): ?art=kader|markt|top|spieltag|wertscan|liga|gebotsformular (nur lesen). Läuft im Hintergrund,
// das Ergebnis steht danach im Abrufprotokoll der Diagnose. Gebremst je Art; nach "Passwort falsch" oder
// "gesperrt" blockiert die Sitzung selbst jeden weiteren Login.
const ABRUFE = { kader: kaderAbrufen, markt: marktAbrufen, top: topAbrufen, spieltag: spieltagAbrufen, wertscan: wertScanAbrufen, liga: ligaHinterlegen, gebotsformular: (db: Parameters<typeof gebotsformularLesen>[0]) => gebotsformularLesen(db) } as const;

export async function POST(request: Request) {
  if (!fernErlaubt(request.headers.get("authorization"))) return new Response("nicht gefunden", { status: 404 });
  const art = new URL(request.url).searchParams.get("art") ?? "";
  if (!(art in ABRUFE)) return Response.json({ fehler: "art muss kader, markt, top, spieltag, wertscan, liga oder gebotsformular sein" }, { status: 400 });
  const db = getDb();
  const bremse = fernAbrufFrei(db, art);
  if (!bremse.frei) return Response.json({ gestartet: false, grund: `Bremse: nächster Abruf ab ${bremse.ab}` }, { status: 429 });
  void ABRUFE[art as keyof typeof ABRUFE](db, { manuell: true }).catch(() => {});
  return Response.json({ gestartet: true, art });
}
