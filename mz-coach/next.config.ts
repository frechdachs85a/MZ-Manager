import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Persönliche Webseite mit Daten pro Anfrage aus der eigenen Datenbank:
  // klassisches dynamisches Rendern, kein Cache-Components-Modell.
  poweredByHeader: false,
  // Upload der von Hand gespeicherten ManagerZone-Seiten (Taktikseite allein ca. 750 KB)
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
