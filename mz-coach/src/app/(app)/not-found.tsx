// Seite „nicht gefunden“ des App-Bereichs.

import Link from "next/link";

// Anzeige „Seite nicht gefunden“
export default function NichtGefunden() {
  return (
    <div className="seite pt-24">
      <div className="kapitaelchen">Nicht gefunden</div>
      <h1 className="mt-2 text-[34px] font-semibold tracking-tight">Diese Seite gibt es nicht</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-label-2">
        Vielleicht ist das Spiel, der Spieler oder der Gegner noch nicht gespeichert.
      </p>
      <Link href="/" className="pressable knopf mt-6 inline-flex min-h-[46px] items-center px-6 text-[15px] font-medium">
        Zur Übersicht
      </Link>
    </div>
  );
}
