import { berlinZuUtc } from "@/lib/mz/parser/kader";
import { endeAlsDatum } from "@/lib/mz/parser/transfer";

// Auktionsende von ManagerZone ("31-10-2026 20:37", Berliner Zeit) als ISO-Zeitpunkt
export function endeIso(ende?: string): string | undefined {
  const m = endeAlsDatum(ende)?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return m ? berlinZuUtc(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString() : undefined;
}
