"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { haptic } from "@/lib/haptics";

const THRESHOLD = 72;

// Nach unten ziehen lädt die Seite neu (Server-Daten frisch).
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      start.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
      armed.current = false;
    }
    function onMove(e: TouchEvent) {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0) return setPull(0);
      const damped = Math.min(120, dy * 0.5);
      setPull(damped);
      if (damped >= THRESHOLD && !armed.current) {
        armed.current = true;
        haptic();
      } else if (damped < THRESHOLD) {
        armed.current = false;
      }
    }
    function onEnd() {
      if (armed.current) startTransition(() => router.refresh());
      start.current = null;
      armed.current = false;
      setPull(0);
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  const visible = pending ? 1 : Math.min(1, pull / THRESHOLD);
  return (
    <>
      <div
        aria-hidden={!pending}
        className="pointer-events-none fixed inset-x-0 z-20 flex justify-center"
        style={{
          top: `calc(env(safe-area-inset-top) + 52px)`,
          opacity: visible,
          transform: `translateY(${pending ? 8 : pull / 3}px)`,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-6 w-6 text-label-2 ${pending ? "animate-spin" : ""}`}
          style={{ transform: pending ? undefined : `rotate(${pull * 3}deg)` }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1="12"
              y1="3"
              x2="12"
              y2="7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.25 + (i / 8) * 0.75}
              transform={`rotate(${i * 45} 12 12)`}
            />
          ))}
        </svg>
      </div>
      {/* transform nur während des Ziehens, sonst bricht es position:fixed der Titelleiste */}
      <div style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: pull ? "none" : "transform .25s" }}>
        {children}
      </div>
    </>
  );
}
