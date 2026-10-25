"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { haptic } from "@/lib/haptics";

type Tab = { href: string; label: string; icon: React.ReactNode };

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const TABS: Tab[] = [
  {
    href: "/",
    label: "Übersicht",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: "/kader",
    label: "Kader",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.2c2.8.2 5 2.7 5 5.8" />
      </svg>
    ),
  },
  {
    href: "/gegner",
    label: "Gegner",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20.5 20.5-4.8-4.8" />
      </svg>
    ),
  },
  {
    href: "/taktik",
    label: "Taktik",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <rect x="3.5" y="2.5" width="17" height="19" rx="2" />
        <path d="M3.5 12h17M9 2.5v3.5h6V2.5M9 21.5V18h6v3.5" />
        <circle cx="12" cy="12" r="2.3" />
      </svg>
    ),
  },
  {
    href: "/markt",
    label: "Markt",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M4 7h16l-1.2 12.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
        <path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "Chat",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M20.5 11.5c0 4.1-3.8 7.5-8.5 7.5-1.2 0-2.3-.2-3.3-.6L4 20l1.2-3.6C4.1 15 3.5 13.3 3.5 11.5 3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.5z" />
      </svg>
    ),
  },
];

// Nur in der Seitenleiste am Laptop (die Tab-Leiste am Handy hat Platz für 6)
const MEHR: Tab[] = [
  {
    href: "/top10",
    label: "Top 10",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z" />
      </svg>
    ),
  },
];

const EINSTELLUNGEN: Tab = {
  href: "/einstellungen",
  label: "Einstellungen",
  icon: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
};

function istAktiv(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Handy und Tablet: Tab-Leiste unten. Ab Desktop-Breite (lg): Seitenleiste links.
export function Navigation() {
  const pathname = usePathname();
  return (
    <>
      <nav
        aria-label="Hauptnavigation"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-bar backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((tab) => {
            const active = istAktiv(pathname, tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  onClick={() => !active && haptic()}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 pt-1.5 text-[10px] font-medium tracking-tight ${
                    active ? "text-tint" : "text-label-3"
                  }`}
                >
                  <span className={`flex h-[26px] w-[44px] items-center justify-center rounded-full transition-colors ${active ? "bg-tint/10" : ""}`}>
                    <span className="h-[22px] w-[22px]">{tab.icon}</span>
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-nacht px-4 py-8 text-[#e9e4d8] lg:flex"
      >
        <Link href="/" className="mb-10 flex items-center gap-3 px-3">
          <Image src="/icons/icon-192.png" alt="" width={38} height={38} className="rounded-full ring-1 ring-gold/60" />
          <span>
            <span className="display block text-[21px] font-semibold leading-tight tracking-tight text-[#f5f2ea]">MZ Coach</span>
            <span className="kapitaelchen block !text-gold-hell">FC Toho</span>
          </span>
        </Link>
        <ul className="flex flex-1 flex-col gap-1">
          {[...TABS, ...MEHR, EINSTELLUNGEN].map((tab) => {
            const active = istAktiv(pathname, tab.href);
            return (
              <li key={tab.href} className={tab === EINSTELLUNGEN ? "mt-auto" : undefined}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-11 items-center gap-3 rounded-[8px] px-3 text-[15px] transition-colors ${
                    active
                      ? "bg-white/[0.07] font-medium text-[#f5f2ea] before:absolute before:inset-y-2.5 before:left-0 before:w-[2px] before:rounded-full before:bg-gold"
                      : "text-[#e9e4d8]/70 hover:bg-white/[0.04] hover:text-[#f5f2ea]"
                  }`}
                >
                  <span className="h-[22px] w-[22px] shrink-0">{tab.icon}</span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
