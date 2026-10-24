"use client";

import { useEffect, useRef, useState } from "react";

// Großer Titel. Auf dem Handy erscheint beim Scrollen oben eine kleine, unscharf
// hinterlegte Titelleiste (mit Aktion, z. B. Einstellungen). Ab Desktop-Breite
// übernimmt die Seitenleiste die Navigation, dort gibt es nur den Titel.
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), {
      rootMargin: "-44px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        className={`pt-safe fixed inset-x-0 top-0 z-30 transition-[background-color,border-color] duration-200 ${
          compact
            ? "border-b border-separator bg-bar backdrop-blur-xl backdrop-saturate-150"
            : "border-b border-transparent"
        } lg:hidden`}
      >
        <div className="px-safe mx-auto flex h-11 max-w-2xl items-center justify-between">
          <span className="w-11" />
          <span
            className={`text-[17px] font-semibold transition-opacity duration-200 ${
              compact ? "opacity-100" : "opacity-0"
            }`}
          >
            {title}
          </span>
          <span className="flex w-11 justify-end">{action}</span>
        </div>
      </div>
      <header className="pt-safe seite">
        <div className="h-11 lg:h-10" />
        <h1 className="text-[34px] leading-[41px] font-bold tracking-tight lg:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-label-2">{subtitle}</p>}
        <div ref={sentinel} className="h-px" />
      </header>
    </>
  );
}
