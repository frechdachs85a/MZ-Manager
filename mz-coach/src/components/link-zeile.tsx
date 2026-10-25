import Link from "next/link";

// Listenzeile als Link mit Pfeil (iOS-Stil)
export function LinkZeile({ href, children, detail }: { href: string; children: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <li className="!px-0">
      <Link href={href} className="pressable zeile-hover flex min-h-12 items-center gap-3 px-5 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">{children}</span>
          {detail && <span className="block text-[13px] text-label-2">{detail}</span>}
        </span>
        <svg viewBox="0 0 8 14" className="h-3.5 w-2 shrink-0 text-label-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m1 1 6 6-6 6" />
        </svg>
      </Link>
    </li>
  );
}
