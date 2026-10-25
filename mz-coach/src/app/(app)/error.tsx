"use client"; // Fehlergrenzen müssen Client-Komponenten sein

import { useEffect } from "react";

export default function Fehler({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="seite pt-24">
      <div className="kapitaelchen">Fehler</div>
      <h1 className="mt-2 text-[34px] font-semibold tracking-tight">Diese Seite konnte nicht geladen werden</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-label-2">
        Die Daten sind nicht verloren. Meist hilft es, die Seite neu zu laden. Bleibt der Fehler, steht die Ursache im Server-Protokoll.
      </p>
      <button onClick={() => retry()} className="pressable knopf mt-6 min-h-[46px] px-6 text-[15px] font-medium">
        Erneut versuchen
      </button>
    </div>
  );
}
