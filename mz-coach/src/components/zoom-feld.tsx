"use client";

import { useEffect, useState } from "react";

// Spielfeld anklicken = groß anzeigen (Marcus, 31.10.2026: Details besser sehen). Schließen per Klick, Escape oder ×.
// inline: als Text-Link (z. B. Spielername), sonst als Block (Spielfeld)
export function ZoomFeld({ klein, gross, titel, inline = false }: { klein: React.ReactNode; gross: React.ReactNode; titel?: string; inline?: boolean }) {
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => e.key === "Escape" && setOffen(false);
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [offen]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={inline ? "cursor-pointer text-left font-semibold underline decoration-dotted underline-offset-4 hover:text-tint" : "block w-full cursor-zoom-in text-left"}
        title={inline ? "Details anzeigen" : "Groß anzeigen"}
      >
        {klein}
      </button>
      {offen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titel ?? "Spielfeld"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOffen(false)}
        >
          <div className="relative max-h-[95vh] w-full max-w-[640px] overflow-auto rounded-[14px] bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[16px] font-bold">{titel}</span>
              <button type="button" onClick={() => setOffen(false)} className="pressable rounded-md px-2 text-[22px] leading-none text-label-2" aria-label="Schließen">
                ×
              </button>
            </div>
            {gross}
          </div>
        </div>
      )}
    </>
  );
}
