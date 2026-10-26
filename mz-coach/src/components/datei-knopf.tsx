"use client";

// Lädt einen Text als Datei herunter (z. B. Taktik-XML zum Import im Taktik-Editor)
export function DateiKnopf({ text, dateiname, label }: { text: string; dateiname: string; label: string }) {
  return (
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
      className="pressable inline-flex min-h-[44px] items-center rounded-[8px] bg-white px-4 text-[13px] font-bold uppercase tracking-wider text-[#0b3b26] hover:bg-white/90"
    >
      {label}
    </button>
  );
}
