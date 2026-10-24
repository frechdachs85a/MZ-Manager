// Grundbausteine im iOS-Stil: gruppierte Abschnitte, Karten, Listenzeilen, Hinweise.

export function Section({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      {title && (
        <h2 className="mb-1.5 px-4 text-[13px] uppercase tracking-wide text-label-2">{title}</h2>
      )}
      {children}
      {footer && <p className="mt-1.5 px-4 text-[13px] text-label-2">{footer}</p>}
    </section>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-[14px] bg-card ${className}`}>{children}</div>;
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <ul className="divide-y divide-separator [&>li]:ml-4 [&>li]:pr-4 [&>li:first-child]:border-t-0">
        {children}
      </ul>
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
    <li className="flex min-h-11 items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[17px] leading-snug">{title}</div>
        {detail && <div className="text-[13px] text-label-2">{detail}</div>}
      </div>
      {value && <div className="shrink-0 text-[17px] text-label-2">{value}</div>}
      {accessory}
    </li>
  );
}

// "Nicht verfügbar" mit Grund. Grundregel der Webseite: nie Werte erfinden.
export function Unavailable({ title, reason }: { title: string; reason: string }) {
  return (
    <Card className="p-4">
      <div className="text-[15px] font-semibold">{title}</div>
      <div className="mt-1 flex items-start gap-2 text-[15px] text-label-2">
        <span className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full bg-label-3" />
        <span>Nicht verfügbar: {reason}</span>
      </div>
    </Card>
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
    neutral: "bg-fill text-label-2",
    green: "bg-green/15 text-green",
    red: "bg-red/15 text-red",
    orange: "bg-orange/15 text-orange",
    tint: "bg-tint/15 text-tint",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
