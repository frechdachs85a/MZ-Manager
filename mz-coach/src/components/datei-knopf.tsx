"use client";

import { useState } from "react";

// Taktik-XML herunterladen oder in die Zwischenablage kopieren (Marcus, 31.10.2026: XML auch kopieren können, z. B. für
// den Import im Taktik-Editor von ManagerZone)
export function DateiKnopf({ text, dateiname, label }: { text: string; dateiname: string; label: string }) {
  const [kopiert, setKopiert] = useState<"ja" | "fehler" | null>(null);
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert("ja");
    } catch {
      // Ohne Clipboard-API (z. B. ohne HTTPS): über ein unsichtbares Textfeld
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      setKopiert(ok ? "ja" : "fehler");
    }
    setTimeout(() => setKopiert(null), 2500);
  };
  const stil =
    "pressable inline-flex min-h-[44px] items-center rounded-[8px] border border-separator bg-white px-4 text-[13px] font-bold uppercase tracking-wider text-[#0b3b26] hover:bg-white/90";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          const url = URL.createObjectURL(new Blob([text], { type: "application/xml" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = dateiname;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
        className={stil}
        title="Als Datei herunterladen"
      >
        {label} ↓
      </button>
      <button type="button" onClick={kopieren} className={stil} title="In die Zwischenablage kopieren">
        {kopiert === "ja" ? "Kopiert ✓" : kopiert === "fehler" ? "Nicht kopiert" : `${label} kopieren`}
      </button>
    </span>
  );
}
