import Link from "next/link";

// Zwei klar getrennte Bereiche (Marcus, 26.10.2026): nächster Gegner mit Taktikvorschlag, dein letztes Ligaspiel
export function SpieltagReiter({ aktiv }: { aktiv: "gegner" | "letztes" }) {
  const cls = (an: boolean) =>
    `flex min-h-[48px] flex-1 items-center justify-center rounded-[8px] px-4 text-center text-[14px] font-bold uppercase tracking-wider sm:flex-none ${
      an ? "bg-tint text-auf-akzent" : "bg-card text-label-2 hover:text-label karte"
    }`;
  return (
    <nav aria-label="Spieltag" className="mt-6 flex gap-2">
      <Link href="/spieltag" aria-current={aktiv === "gegner" ? "page" : undefined} className={cls(aktiv === "gegner")}>
        Nächster Gegner
      </Link>
      <Link href="/spieltag/letztes" aria-current={aktiv === "letztes" ? "page" : undefined} className={cls(aktiv === "letztes")}>
        Dein letztes Ligaspiel
      </Link>
    </nav>
  );
}
