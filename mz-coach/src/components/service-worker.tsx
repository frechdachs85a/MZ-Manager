"use client";

import { useEffect } from "react";

// Früher registrierte Service Worker (aus der ersten Fassung, mit Zwischenspeicher) werden im Browser abgemeldet,
// damit nichts Altes zwischenspeichert. Der reine Push-Worker /push-sw.js (31.10.2026) bleibt.
export function AlteServiceWorkerEntfernen() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.filter((r) => !r.active?.scriptURL.endsWith("/push-sw.js")).forEach((r) => r.unregister()))
      .catch(() => {});
  }, []);
  return null;
}
