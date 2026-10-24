"use client";

import { useEffect } from "react";

// Die Seite ist bewusst keine installierbare App mehr. Früher registrierte Service Worker
// (aus der ersten Fassung) werden im Browser abgemeldet, damit nichts Altes zwischenspeichert.
export function AlteServiceWorkerEntfernen() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
  }, []);
  return null;
}
