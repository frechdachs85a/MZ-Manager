"use client";

import { useEffect, useRef, useState } from "react";

// Seitenkopf wie ein Bildschirmtitel im Manager-Spiel. Auf dem Handy erscheint beim Scrollen oben eine kleine
// Titelleiste (mit Aktion).
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
          <span className={`display text-[17px] font-bold uppercase tracking-wide transition-opacity duration-200 ${compact ? "opacity-100" : "opacity-0"}`}>
            {title}
          </span>
          <span className="flex w-11 justify-end">{action}</span>
        </div>
      </div>
      <header className="pt-safe seite">
        <div className="h-12 lg:h-6" />
        <div className="flex items-end justify-between gap-4 border-b border-separator pb-4">
          <div className="min-w-0">
            <h1 className="text-[32px] font-bold leading-none tracking-wide lg:text-[40px]">{title}</h1>
            {subtitle && <p className="mt-2 text-[13.5px] text-label-2 lg:text-[14px]">{subtitle}</p>}
          </div>
          {action && <div className="hidden shrink-0 lg:block">{action}</div>}
        </div>
        <div ref={sentinel} className="h-px" />
      </header>
    </>
  );
}
