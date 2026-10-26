"use client";

// Knopf, der einen Text (z. B. Taktik-Code) in die Zwischenablage kopiert.

import { useState } from "react";

// Kopiert den Text in die Zwischenablage
export function KopierKnopf({ text, label = "Code kopieren" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          setOk(false);
        }
      }}
      className="pressable min-h-[44px] knopf px-4 text-[14px] font-bold"
    >
      {ok ? "Kopiert ✓" : label}
    </button>
  );
}
