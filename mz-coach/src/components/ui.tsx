// Grundbausteine: Abschnitte, Karten, Listenzeilen, Hinweise. Stil "klassisch elegant":
// Elfenbein, Vereinsgrün, Gold, feine Linien, Serifen-Überschriften.

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
    <section className="mt-12">
      {title && (
        <div className="mb-4 flex items-end justify-between gap-4 border-b border-separator pb-2">
          <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
          {aktion}
        </div>
      )}
      {children}
      {footer && <p className="mt-3 max-w-[70ch] text-[13px] leading-relaxed text-label-2">{footer}</p>}
    </section>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`karte overflow-hidden rounded-[12px] bg-card ${className}`}>{children}</div>;
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <ul className="divide-y divide-separator [&>li]:px-5 [&>li:first-child]:border-t-0">{children}</ul>
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
    <li className="flex min-h-12 items-center gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-snug">{title}</div>
        {detail && <div className="mt-0.5 text-[13px] text-label-2">{detail}</div>}
      </div>
      {value && <div className="shrink-0 text-[15px] text-label-2">{value}</div>}
      {accessory}
    </li>
  );
}

// "Nicht verfügbar" mit Grund. Grundregel der Webseite: nie Werte erfinden.
export function Unavailable({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-gold-hell bg-card/60 p-5">
      <div className="kapitaelchen">Nicht verfügbar</div>
      <div className="display mt-1.5 text-[17px] font-semibold">{title}</div>
      <div className="mt-1 text-[14px] leading-relaxed text-label-2">{reason}</div>
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
    neutral: "border-separator text-label-2",
    green: "border-green/40 text-green",
    red: "border-red/40 text-red",
    orange: "border-orange/40 text-orange",
    tint: "border-tint/40 text-tint",
  };
  return (
    <span className={`inline-flex items-center rounded-full border bg-card px-2 py-[1px] text-[11px] font-medium tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Dunkle Kopfkarte für die wichtigste Information einer Seite
export function Hero({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`hero relative overflow-hidden rounded-[14px] p-7 ${className}`}>{children}</div>;
}

// Kennzahl-Karte: goldene Linie oben, große Serifenzahl
export function Kachel({
  titel,
  wert,
  unten,
  href,
}: {
  titel: string;
  wert: React.ReactNode;
  unten?: React.ReactNode;
  href?: string;
}) {
  const inhalt = (
    <>
      <div className="kapitaelchen">{titel}</div>
      <div className="display mt-3 text-[34px] font-semibold leading-none tracking-tight">{wert}</div>
      {unten && <div className="mt-3 text-[13px] leading-snug text-label-2">{unten}</div>}
    </>
  );
  const cls = "karte relative flex min-h-[140px] flex-col rounded-[12px] border-t-2 border-t-gold bg-card p-5";
  return href ? (
    <a href={href} className={`${cls} transition-shadow hover:shadow-[0_12px_32px_-14px_rgba(28,35,33,0.28)]`}>
      {inhalt}
      <span className="absolute right-5 top-5 text-[13px] text-gold" aria-hidden>
        →
      </span>
    </a>
  ) : (
    <div className={cls}>{inhalt}</div>
  );
}
