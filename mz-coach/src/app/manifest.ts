import type { MetadataRoute } from "next";

// Manifest, damit die Seite auf dem iPhone zum Home-Bildschirm hinzugefügt werden kann: nur so erlaubt iOS
// Push-Nachrichten (Marcus, 31.10.2026: Auktionsbericht aufs Handy). Kein Offline-Betrieb, kein Zwischenspeicher.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MZ Coach",
    short_name: "MZ Coach",
    start_url: "/",
    display: "standalone",
    background_color: "#eef2f6",
    theme_color: "#eef2f6",
    icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  };
}
