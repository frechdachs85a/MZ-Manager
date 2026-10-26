// Grundbausteine im Manager-Spiel-Stil (Marcus, 26.10.2026): dunkle Panels mit Kopfzeile, kräftige
// schmale Überschriften, Akzentgrün, Gold für Bewertungen.

// Panel mit Kopfzeile wie im Manager-Spiel (Titel links, Aktion rechts)
export function Section({
  title,
  footer,
  aktion,
  children,
}: {
  title?: string;
  footer?: string;
  aktion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2.5 text-[19px] font-bold leading-none tracking-wide">
            <span aria-hidden className="h-4 w-1 rounded-full bg-tint" />
            {title}
          </h2>
          {aktion}
        </div>
      )}
      {children}
      {footer && <p className="mt-2.5 max-w-[80ch] text-[12.5px] leading-relaxed text-label-3">{footer}</p>}
    </section>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`karte overflow-hidden rounded-[10px] bg-card ${className}`}>{children}</div>;
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <ul className="divide-y divide-separator [&>li]:px-4 [&>li:first-child]:border-t-0">{children}</ul>
    </Card>
  );
}

export function Row({
  title,
  detail,
  value,
  accessory,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  accessory?: React.ReactNode;
}) {
  return (
    <li className="flex min-h-11 items-center gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium leading-snug">{title}</div>
        {detail && <div className="mt-0.5 text-[12.5px] text-label-2">{detail}</div>}
      </div>
      {value && <div className="shrink-0 text-[14.5px] text-label-2">{value}</div>}
      {accessory}
    </li>
  );
}

// "Nicht verfügbar" mit Grund. Grundregel der Webseite: nie Werte erfinden.
export function Unavailable({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-white/15 bg-card/50 p-4">
      <div className="kapitaelchen !text-label-3">Nicht verfügbar</div>
      <div className="display mt-1 text-[17px] font-semibold uppercase">{title}</div>
      <div className="mt-1 text-[13.5px] leading-relaxed text-label-2">{reason}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red" | "orange" | "tint";
}) {
  const tones = {
    neutral: "bg-white/[0.06] text-label-2",
    green: "bg-green/15 text-green",
    red: "bg-red/15 text-red",
    orange: "bg-orange/15 text-orange",
    tint: "bg-tint/15 text-tint-hell",
  };
  return (
    <span className={`inline-flex items-center rounded-[4px] px-1.5 py-[2px] text-[10.5px] font-bold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Kopfkarte für die wichtigste Information einer Seite
export function Hero({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`hero relative overflow-hidden rounded-[12px] p-6 ${className}`}>{children}</div>;
}

// Kennzahl-Kachel: Titel klein, Zahl groß und schmal, Akzentlinie links
export function Kachel({
  titel,
  wert,
  unten,
  href,
  ton = "tint",
}: {
  titel: string;
  wert: React.ReactNode;
  unten?: React.ReactNode;
  href?: string;
  ton?: "tint" | "gold" | "red" | "neutral";
}) {
  const linie = { tint: "before:bg-tint", gold: "before:bg-gold", red: "before:bg-red", neutral: "before:bg-white/20" }[ton];
  const inhalt = (
    <>
      <div className="kapitaelchen">{titel}</div>
      <div className="display mt-2 text-[38px] font-bold leading-none">{wert}</div>
      {unten && <div className="mt-2 text-[12.5px] leading-snug text-label-2">{unten}</div>}
    </>
  );
  const cls = `karte relative flex min-h-[124px] flex-col overflow-hidden rounded-[10px] bg-card p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${linie}`;
  return href ? (
    <a href={href} className={`${cls} transition-colors hover:bg-card-2`}>
      {inhalt}
      <span className="absolute right-4 top-4 text-[13px] text-label-3" aria-hidden>
        →
      </span>
    </a>
  ) : (
    <div className={cls}>{inhalt}</div>
  );
}
