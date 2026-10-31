"use client";

// Push-Nachrichten auf diesem Gerät ein- oder ausschalten (Marcus, 31.10.2026: Auktionsbericht aufs Handy).
// iPhone: Push geht nur, wenn die Seite über „Teilen → Zum Home-Bildschirm“ hinzugefügt und von dort geöffnet ist (iOS 16.4+).

import { useEffect, useState } from "react";
import { pushAbonnieren, pushBeenden, pushSchluessel, pushTest } from "@/app/nachricht-actions";

const bytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

type Lage = "pruefe" | "nicht-moeglich" | "ios-home" | "aus" | "an" | "blockiert";

export function PushSchalter() {
  const [lage, setLage] = useState<Lage>("pruefe");
  const [meldung, setMeldung] = useState<string>();
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setLage(ios && !standalone ? "ios-home" : "nicht-moeglich");
        return;
      }
      if (Notification.permission === "denied") return setLage("blockiert");
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const abo = await reg?.pushManager.getSubscription();
      setLage(abo ? "an" : "aus");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function einschalten() {
    setLaeuft(true);
    setMeldung(undefined);
    try {
      const erlaubt = await Notification.requestPermission();
      if (erlaubt !== "granted") {
        setLage(erlaubt === "denied" ? "blockiert" : "aus");
        setMeldung("Mitteilungen wurden nicht erlaubt.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const abo =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(await pushSchluessel()) }));
      const r = await pushAbonnieren(abo.toJSON() as { endpoint: string; keys?: Record<string, string> });
      setMeldung(r.meldung);
      if (r.ok) setLage("an");
    } catch (e) {
      setMeldung(`Einschalten fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaeuft(false);
    }
  }

  async function ausschalten() {
    setLaeuft(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const abo = await reg?.pushManager.getSubscription();
      if (abo) {
        await pushBeenden(abo.endpoint);
        await abo.unsubscribe();
      }
      setLage("aus");
      setMeldung("Dieses Gerät bekommt keine Push-Nachrichten mehr.");
    } finally {
      setLaeuft(false);
    }
  }

  const knopf = "pressable rounded-md px-3 py-1.5 text-[13.5px] font-semibold disabled:opacity-50";
  return (
    <div className="space-y-2 text-[14px]">
      {lage === "pruefe" && <p className="text-label-2">Prüfe dieses Gerät …</p>}
      {lage === "nicht-moeglich" && <p className="text-label-2">Dieser Browser kann keine Push-Nachrichten empfangen. Die Berichte erscheinen beim nächsten Besuch als Pop-up.</p>}
      {lage === "ios-home" && (
        <p className="text-label-2">
          iPhone: Push geht nur aus der Home-Bildschirm-App. In Safari unten auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>, dann MZ Coach von dort öffnen und
          hier einschalten (ab iOS 16.4).
        </p>
      )}
      {lage === "blockiert" && <p className="text-label-2">Mitteilungen sind für diese Seite blockiert. In den Einstellungen des Browsers bzw. des Telefons erlauben.</p>}
      {lage === "aus" && (
        <button onClick={einschalten} disabled={laeuft} className={`${knopf} bg-tint text-auf-akzent`}>
          {laeuft ? "Wird eingeschaltet …" : "Push-Nachrichten auf diesem Gerät einschalten"}
        </button>
      )}
      {lage === "an" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-green">✓ Push auf diesem Gerät an</span>
          <button
            onClick={async () => {
              setMeldung((await pushTest()).meldung);
            }}
            className={`${knopf} border border-separator`}
          >
            Test senden
          </button>
          <button onClick={ausschalten} disabled={laeuft} className={`${knopf} border border-red/40 text-red`}>
            Ausschalten
          </button>
        </div>
      )}
      {meldung && <p className="text-[13px] text-label-2">{meldung}</p>}
    </div>
  );
}
