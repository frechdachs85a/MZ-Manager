"use client";

// Ungelesene Nachrichten (z. B. Auktionsbericht) als Pop-up beim nächsten Besuch der Seite (Marcus, 31.10.2026)

import Link from "next/link";
import { useState } from "react";
import { nachrichtenGelesen } from "@/app/nachricht-actions";

type N = { id: number; zeit: string; titel: string; text: string; link: string | null };

export function NachrichtenPopup({ nachrichten }: { nachrichten: N[] }) {
  const [offen, setOffen] = useState(nachrichten.length > 0);
  if (!offen || !nachrichten.length) return null;
  const schliessen = () => {
    setOffen(false);
    void nachrichtenGelesen(nachrichten.map((n) => n.id));
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Neue Nachrichten">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[14px] bg-card p-4 shadow-xl">
        <div className="text-[12px] font-bold uppercase tracking-wider text-label-3">{nachrichten.length === 1 ? "Neue Nachricht" : `${nachrichten.length} neue Nachrichten`}</div>
        <ul className="mt-2 divide-y divide-separator">
          {nachrichten.map((n) => (
            <li key={n.id} className="py-2.5">
              <div className="text-[15px] font-bold">{n.titel}</div>
              <div className="text-[11.5px] text-label-3">{new Date(n.zeit).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</div>
              <p className="mt-1 text-[14px] text-label-2">{n.text}</p>
              {n.link && (
                <Link href={n.link} onClick={schliessen} className="mt-1 inline-block text-[13px] font-semibold text-tint hover:underline">
                  Ansehen →
                </Link>
              )}
            </li>
          ))}
        </ul>
        <button onClick={schliessen} className="pressable mt-3 min-h-[44px] w-full rounded-[10px] bg-tint text-[15px] font-semibold text-auf-akzent">
          Gelesen
        </button>
      </div>
    </div>
  );
}
