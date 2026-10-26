import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { AlteServiceWorkerEntfernen } from "@/components/service-worker";
import "./globals.css";

// Schriften werden beim Build geladen und selbst ausgeliefert (keine Anfragen an Google im Browser)
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
// Überschriften und Zahlen wie in Fußballmanager-Spielen: schmal, kräftig
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--font-barlow" });

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
  themeColor: "#eef2f6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`h-full antialiased ${inter.variable} ${barlow.variable}`}>
      <body className="min-h-full">
        {children}
        <AlteServiceWorkerEntfernen />
      </body>
    </html>
  );
}
