// Feste Stufen für MZ-Werte (Skala 0 bis 10), damit man sofort sieht, was ausgezeichnet ist und was nicht
// (Marcus, 26.10.2026: die alte Hinterlegung relativ zum ganzen Kader war kaum zu unterscheiden).
// Die Grenzen sind eine Lesehilfe dieser Seite, keine Einstufung von ManagerZone. Bezug: deine Startelf liegt
// in ihren Rollen bei ungefähr 8,3 bis 8,9.
export const STUFEN = [
  { ab: 8.5, name: "ausgezeichnet", cls: "bg-[#0b6b3f] text-white font-semibold" },
  { ab: 8.0, name: "sehr gut", cls: "bg-[#8fd4a6] text-[#0b2e1c]" },
  { ab: 7.5, name: "gut", cls: "bg-[#d4efdc] text-[#14212e]" },
  { ab: 6.5, name: "mittel", cls: "bg-[#fbeeb8] text-[#14212e]" },
  { ab: 5.0, name: "schwach", cls: "bg-[#fbd2ad] text-[#14212e]" },
  { ab: -Infinity, name: "ungeeignet", cls: "bg-transparent text-label-3" },
] as const;

export const stufe = (w: number) => STUFEN.find((s) => w >= s.ab)!;

export function WertLegende() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
      <span className="text-label-3">MZ-Wert:</span>
      {STUFEN.map((s, i) => (
        <span key={s.name} className={`rounded-[6px] px-2 py-0.5 ${s.cls} ${s.name === "ungeeignet" ? "border border-separator" : ""}`}>
          {s.name} {i === 0 ? `ab ${s.ab.toFixed(1).replace(".", ",")}` : s.ab === -Infinity ? `unter ${STUFEN[i - 1].ab.toFixed(1).replace(".", ",")}` : `${s.ab.toFixed(1).replace(".", ",")} bis ${STUFEN[i - 1].ab.toFixed(1).replace(".", ",")}`}
        </span>
      ))}
    </div>
  );
}
