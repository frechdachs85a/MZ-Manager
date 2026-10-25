"use client";

import { useEffect, useRef, useState } from "react";

// Großer Titel. Auf dem Handy erscheint beim Scrollen oben eine kleine Titelleiste (mit Aktion).
// Ab Desktop-Breite übernimmt die Seitenleiste die Navigation.
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
          compact ? "border-b border-separator bg-bar backdrop-blur-xl" : "border-b border-transparent"
        } lg:hidden`}
      >
        <div className="px-safe mx-auto flex h-11 max-w-2xl items-center justify-between">
          <span className="w-11" />
          <span className={`display text-[17px] font-semibold transition-opacity duration-200 ${compact ? "opacity-100" : "opacity-0"}`}>
            {title}
          </span>
          <span className="flex w-11 justify-end">{action}</span>
        </div>
      </div>
      <header className="pt-safe seite">
        <div className="h-11 lg:h-14" />
        <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight lg:text-[46px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-label-2 lg:text-[16px]">{subtitle}</p>}
        <div className="mt-5 h-px w-16 bg-gold" />
        <div ref={sentinel} className="h-px" />
      </header>
    </>
  );
}
