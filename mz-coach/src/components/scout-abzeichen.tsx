import { Badge } from "@/components/ui";
import type { ScoutEinstufung } from "@/lib/scout";

// Einstufung aus dem Scoutbericht als Abzeichen; Rang 1 bis 3 grün (behalten), unbekannt rot
export function ScoutAbzeichen({ e, mitSternen = false }: { e: ScoutEinstufung; mitSternen?: boolean }) {
  const st = mitSternen && e.sterne ? ` ${e.sterne}` : "";
  if (e.status === "loyal") return <Badge tone="tint">Loyal</Badge>;
  if (e.status === "keiner") return <span className="text-label-3">-</span>;
  if (e.status === "unbekannt") return <Badge tone="red">Scoutbericht unbekannt{st}</Badge>;
  const tone = e.rang! <= 3 ? "green" : e.rang! >= 5 ? "orange" : "neutral";
  return (
    <span title={e.status === "ohneText" ? e.grund : `Rang ${e.rang}`}>
      <Badge tone={tone}>
        {e.abzeichen}
        {st}
        {e.status === "ohneText" ? " ?" : ""}
      </Badge>
    </span>
  );
}
