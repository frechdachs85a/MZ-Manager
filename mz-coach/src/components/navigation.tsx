"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { haptic } from "@/lib/haptics";

// Navigation im Manager-Spiel-Stil (Marcus, 26.10.2026: „maximal unübersichtlich“): wenige klare Gruppen.
// Desktop: Seitenleiste mit Gruppen. Handy: Tab-Leiste mit den vier wichtigsten Bereichen und „Mehr“.

type Tab = { href: string; label: string; icon: React.ReactNode };

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const GRUPPEN: { titel: string | null; tabs: Tab[] }[] = [
  { titel: null, tabs: [
    { href: "/", label: "Zentrale", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </svg>
    ) },
  ] },
  { titel: "Verein", tabs: [
    { href: "/kader", label: "Kader", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.2c2.8.2 5 2.7 5 5.8" />
      </svg>
    ) },
    { href: "/jugend", label: "Jugend", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
      </svg>
    ) },
    { href: "/markt", label: "Transfermarkt", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M4 7h16l-1.2 12.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
        <path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" />
      </svg>
    ) },
  ] },
  { titel: "Spieltag", tabs: [
    { href: "/gegner", label: "Gegner", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20.5 20.5-4.8-4.8" />
      </svg>
    ) },
    { href: "/taktik", label: "Taktik", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <rect x="3.5" y="2.5" width="17" height="19" rx="2" />
        <path d="M3.5 12h17M9 2.5v3.5h6V2.5M9 21.5V18h6v3.5" />
        <circle cx="12" cy="12" r="2.3" />
      </svg>
    ) },
    { href: "/spiele", label: "Spiele", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m12 7.5 3.6 2.6-1.4 4.2H9.8L8.4 10.1z" />
      </svg>
    ) },
  ] },
  { titel: "Analyse", tabs: [
    { href: "/saison", label: "Saison", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ) },
    { href: "/top10", label: "Top 10", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z" />
      </svg>
    ) },
    { href: "/portfolio", label: "Taktik-Portfolio", icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" />
      </svg>
    ) },
  ] },
];

const EINSTELLUNGEN: Tab = { href: "/einstellungen", label: "Einstellungen", icon: (
      <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
    ) };

const ALLE = GRUPPEN.flatMap((g) => g.tabs);
const tab = (href: string) => ALLE.find((t) => t.href === href)!;
// Handy: die vier Bereiche, die man vor jedem Spieltag braucht
const UNTEN: Tab[] = [tab("/"), tab("/kader"), { ...tab("/gegner"), label: "Spieltag" }, { ...tab("/markt"), label: "Markt" }];

function istAktiv(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function SeitenLink({ t, aktiv, onClick }: { t: Tab; aktiv: boolean; onClick?: () => void }) {
  return (
    <Link
      href={t.href}
      onClick={onClick}
      aria-current={aktiv ? "page" : undefined}
      className={`relative flex min-h-10 items-center gap-3 rounded-[6px] px-3 text-[14px] transition-colors ${
        aktiv
          ? "bg-tint/[0.12] font-semibold text-label before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-tint"
          : "text-label-2 hover:bg-fill hover:text-label"
      }`}
    >
      <span className={`h-[20px] w-[20px] shrink-0 ${aktiv ? "text-tint" : ""}`}>{t.icon}</span>
      {t.label}
    </Link>
  );
}

function Gruppen({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  return (
    <>
      {GRUPPEN.map((g, i) => (
        <div key={i} className={i ? "mt-5" : ""}>
          {g.titel && <div className="kapitaelchen mb-1.5 px-3 !text-[10px] !text-label-3">{g.titel}</div>}
          <ul className="flex flex-col gap-0.5">
            {g.tabs.map((t) => (
              <li key={t.href}>
                <SeitenLink t={t} aktiv={istAktiv(pathname, t.href)} onClick={onClick} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const [mehr, setMehr] = useState(false);
  const mehrAktiv = !UNTEN.some((t) => istAktiv(pathname, t.href));
  return (
    <>
      {/* Handy: Tab-Leiste unten */}
      <nav aria-label="Hauptnavigation" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-bar backdrop-blur-xl lg:hidden">
        <ul className="mx-auto flex max-w-2xl">
          {UNTEN.map((t) => {
            const aktiv = istAktiv(pathname, t.href) && !mehr;
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  onClick={() => !aktiv && haptic()}
                  aria-current={aktiv ? "page" : undefined}
                  className={`flex min-h-[54px] flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${aktiv ? "text-tint" : "text-label-3"}`}
                >
                  <span className="h-[22px] w-[22px]">{t.icon}</span>
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMehr((m) => !m)}
              aria-expanded={mehr}
              className={`flex min-h-[54px] w-full flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${mehr || mehrAktiv ? "text-tint" : "text-label-3"}`}
            >
              <svg viewBox="0 0 24 24" {...s} className="h-[22px] w-[22px]">
                <circle cx="5" cy="12" r="1.3" />
                <circle cx="12" cy="12" r="1.3" />
                <circle cx="19" cy="12" r="1.3" />
              </svg>
              Mehr
            </button>
          </li>
        </ul>
      </nav>
      {mehr && (
        <div className="fixed inset-0 z-30 bg-label/40 lg:hidden" onClick={() => setMehr(false)}>
          <div
            className="pb-tabbar absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[16px] border-t border-separator bg-nacht px-4 pt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <Gruppen pathname={pathname} onClick={() => setMehr(false)} />
            <div className="mt-5 border-t border-separator pt-3 pb-4">
              <SeitenLink t={EINSTELLUNGEN} aktiv={istAktiv(pathname, EINSTELLUNGEN.href)} onClick={() => setMehr(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop: Seitenleiste mit Gruppen */}
      <nav aria-label="Hauptnavigation" className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-separator bg-nacht px-3 py-5 lg:flex">
        <Link href="/" className="mb-7 flex items-center gap-3 px-3">
          <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="rounded-[8px]" />
          <span>
            <span className="display block text-[20px] font-bold uppercase leading-none tracking-wide text-label">MZ Coach</span>
            <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-tint">FC Toho</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <Gruppen pathname={pathname} />
        </div>
        <div className="border-t border-separator pt-3">
          <SeitenLink t={EINSTELLUNGEN} aktiv={istAktiv(pathname, EINSTELLUNGEN.href)} />
        </div>
      </nav>
    </>
  );
}
