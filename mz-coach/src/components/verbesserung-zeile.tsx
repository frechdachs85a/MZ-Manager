import { posDe } from "@/lib/mz/formel";

// Wen der Spieler in deiner Startelf ersetzen würde und um wie viel (MZ-Wert auf dessen Position)
const komma = (n: number) => n.toFixed(2).replace(".", ",");
export function VerbesserungZeile({ v }: { v: { rolle: string; statt: string; alt: number; neu: number; gewinn: number } | null }) {
  if (!v) return null;
  const besser = v.gewinn > 0;
  return (
    <div className={`rounded-md px-3 py-2 text-[13px] ${besser ? "bg-green/10" : "bg-fill"}`}>
      Als <b>{posDe(v.rolle)}</b> statt <b>{v.statt}</b>: {komma(v.alt)} → {komma(v.neu)}{" "}
      <b className={besser ? "text-green" : "text-label-2"}>
        ({v.gewinn > 0 ? "+" : ""}
        {komma(v.gewinn)})
      </b>
      {!besser && <span className="text-label-2"> · verbessert deine Startelf nach MZ-Wert nicht</span>}
    </div>
  );
}
