import type { Metadata, Viewport } from "next";
import { AlteServiceWorkerEntfernen } from "@/components/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: "MZ Coach",
  description: "ManagerZone-Assistent für FC Toho",
  icons: {
    icon: [{ url: "/favicon.png", sizes: "48x48", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <AlteServiceWorkerEntfernen />
      </body>
    </html>
  );
}
