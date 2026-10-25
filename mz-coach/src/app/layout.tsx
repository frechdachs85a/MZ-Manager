import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { AlteServiceWorkerEntfernen } from "@/components/service-worker";
import "./globals.css";

// Schriften werden beim Build geladen und selbst ausgeliefert (keine Anfragen an Google im Browser)
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", variable: "--font-playfair" });

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
  themeColor: "#f5f2ea",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`h-full antialiased ${inter.variable} ${playfair.variable}`}>
      <body className="min-h-full">
        {children}
        <AlteServiceWorkerEntfernen />
      </body>
    </html>
  );
}
