// Grundbausteine: Abschnitte, Karten, Listenzeilen, Hinweise. Stil "hell und knallig":
// schwarze Kanten, harte Schatten, kräftige Farbblöcke, große fette Überschriften.

export type Farbe = "blau" | "lila" | "orange" | "limette" | "gelb" | "pink";

const MARKER: Record<Farbe, string> = {
  blau: "bg-tint",
  lila: "bg-purple",
  orange: "bg-orange",
  limette: "bg-lime",
  gelb: "bg-yellow",
  pink: "bg-pink",
};

export function Section({
  title,
  footer,
  farbe = "blau",
  children,
}: {
  title?: string;
  footer?: string;
  farbe?: Farbe;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      {title && (
        <h2 className="mb-3 flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight">
          <span className={`inline-block h-4 w-4 rounded-[5px] border-2 border-ink ${MARKER[farbe]}`} />
          {title}
        </h2>
      )}
      {children}
      {footer && <p className="mt-3 px-1 text-[13px] leading-relaxed text-label-2">{footer}</p>}
    </section>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`karte overflow-hidden rounded-[18px] bg-card ${className}`}>{children}</div>;
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <ul className="divide-y divide-separator [&>li]:pl-4 [&>li]:pr-4 [&>li:first-child]:border-t-0">{children}</ul>
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
    <li className="flex min-h-12 items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold leading-snug">{title}</div>
        {detail && <div className="mt-0.5 text-[13px] text-label-2">{detail}</div>}
      </div>
      {value && <div className="shrink-0 text-[16px] text-label-2">{value}</div>}
      {accessory}
    </li>
  );
}

// "Nicht verfügbar" mit Grund. Grundregel der Webseite: nie Werte erfinden.
export function Unavailable({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-[18px] border-2 border-dashed border-ink/40 bg-card-2 p-5">
      <div className="display text-[17px] font-bold">{title}</div>
      <div className="mt-1 text-[15px] text-label-2">Nicht verfügbar: {reason}</div>
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
    neutral: "bg-card-2 text-label",
    green: "bg-lime text-ink",
    red: "bg-red text-white",
    orange: "bg-orange text-ink",
    tint: "bg-tint text-white",
  };
  return (
    <span className={`inline-flex items-center rounded-full border-[1.5px] border-ink px-2 py-0.5 text-[11px] font-bold tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Farbblock für die wichtigste Information einer Seite
export function Hero({ children, className = "", farbe = "blau" }: { children: React.ReactNode; className?: string; farbe?: Farbe }) {
  return <div className={`farbblock farbblock-${farbe} relative overflow-hidden p-6 ${className}`}>{children}</div>;
}

// Kennzahl-Kachel für die Übersicht
export function Kachel({
  farbe,
  titel,
  wert,
  unten,
  href,
}: {
  farbe: Farbe;
  titel: string;
  wert: React.ReactNode;
  unten?: React.ReactNode;
  href?: string;
}) {
  const inhalt = (
    <>
      <div className="text-[12px] font-extrabold uppercase tracking-[0.12em] opacity-80">{titel}</div>
      <div className="display mt-2 text-[34px] font-extrabold leading-none tracking-tight">{wert}</div>
      {unten && <div className="mt-3 text-[14px] font-medium opacity-90">{unten}</div>}
    </>
  );
  const cls = `farbblock farbblock-${farbe} flex min-h-[148px] flex-col p-5 transition-transform`;
  return href ? (
    <a href={href} className={`${cls} hover:-translate-y-0.5`}>
      {inhalt}
    </a>
  ) : (
    <div className={cls}>{inhalt}</div>
  );
}
