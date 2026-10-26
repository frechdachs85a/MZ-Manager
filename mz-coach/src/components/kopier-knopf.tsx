"use client";

import { useState } from "react";

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
