import { Spielfeld, type DuellLinie, type FeldSpieler } from "@/components/spielfeld";
import { Card } from "@/components/ui";
import { ABWEHR_Y } from "@/lib/mz/analyse/gegner";
import { seitenVergleich } from "@/lib/mz/analyse/seiten";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { istAussen, STURM_Y } from "@/lib/mz/taktik/pruefer";

// Beide Startaufstellungen auf einem Feld (Marcus, 30.10.2026: eine Karte, übersichtlich). Sicht von deinem Tor (unten).
// Seine Plätze werden gespiegelt (x -> 208 − x, y -> 326 − y; mz-wissen.md, Abschnitt 13), so steht jeder seiner Spieler
// dort, wo er bei dir ankommt. Duelle (✓/✗ am eigenen Spieler): seine Stürmer gegen den nächsten deiner Verteidiger, deine Stürmer gegen den
// nächsten seiner Verteidiger; grün = dein Spieler mehr wert, rot = seiner, grau = Wert fehlt. Werte: heutiger Stand der
// Kaderseiten, nicht der Wert am Spieltag.

type P = { x: number; y: number; name: string; wert?: number; torwart: boolean };
const kurz = (name: string) => name.split(" ").at(-1) ?? name;
const mio = (n?: number) => (n === undefined ? "Wert n. v." : `${(n / 1_000_000).toFixed(2).replace(".", ",")} Mio`);
const naechster = (von: P, aus: P[]) => [...aus].sort((a, b) => Math.hypot(a.x - von.x, a.y - von.y) - Math.hypot(b.x - von.x, b.y - von.y))[0];

type Duell = { du: P; er: P; farbe: DuellLinie["farbe"] };
const farbe = (du?: number, er?: number): DuellLinie["farbe"] => (du === undefined || er === undefined ? "grau" : du >= er ? "gruen" : "rot");

export function AufstellungVergleich({ spiel, eigeneTid, werte }: { spiel: StatsSpiel; eigeneTid: number; werte: Record<number, number> }) {
  const er = spiel.teams.find((t) => t.id !== eigeneTid);
  const ich = spiel.teams.find((t) => t.id === eigeneTid);
  if (!er || !ich) return null;
  const elf = (tid: number): P[] =>
    spiel.spieler
      .filter((p) => p.teamId === tid && p.editor)
      .map((p) => ({ x: p.editor!.x, y: p.editor!.y, name: kurz(p.name), wert: werte[p.id], torwart: p.torwart }));
  const meine = elf(ich.id);
  const seineEigen = elf(er.id); // seine Sicht, für den Seitenvergleich
  if (!meine.length || !seineEigen.length) return null;
  const seine = seineEigen.map((p) => ({ ...p, x: 208 - p.x, y: 326 - p.y })); // auf dein Feld gespiegelt

  // Abwehr: jeder seiner Stürmer (seine Sicht y ≤ 110) gegen deinen nächsten Verteidiger (y ≥ 215)
  const deineAbwehr = meine.filter((p) => !p.torwart && p.y >= ABWEHR_Y);
  const abwehr: Duell[] = seine
    .filter((p, i) => !p.torwart && seineEigen[i].y <= STURM_Y && deineAbwehr.length)
    .map((st) => {
      const vt = naechster(st, deineAbwehr);
      return { du: vt, er: st, farbe: farbe(vt.wert, st.wert) };
    });
  // Angriff: jeder deiner Stürmer gegen seinen nächsten Verteidiger
  const seineAbwehr = seine.filter((p, i) => !p.torwart && seineEigen[i].y >= ABWEHR_Y);
  const angriff: Duell[] = meine
    .filter((p) => !p.torwart && p.y <= STURM_Y && seineAbwehr.length)
    .map((st) => {
      const vt = naechster(st, seineAbwehr);
      return { du: st, er: vt, farbe: farbe(st.wert, vt.wert) };
    });

  // Ergebnis je eigenem Spieler: ✗, sobald eines seiner Duelle an den wertvolleren Gegner ging
  const ergebnis = new Map<P, "gut" | "schlecht">();
  for (const d of [...abwehr, ...angriff]) {
    if (d.farbe === "grau") continue;
    if (ergebnis.get(d.du) !== "schlecht") ergebnis.set(d.du, d.farbe === "gruen" ? "gut" : "schlecht");
  }
  // Liegt einer seiner Spieler fast auf einem deiner (direktes Gegenüber), seine Raute leicht nach oben versetzen
  const versatz = (p: P) => (meine.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < 11) ? { x: p.x, y: p.y - 8 } : { x: p.x, y: p.y });
  const feld: FeldSpieler[] = [
    ...meine.map((p) => ({ x: p.x, y: p.y, label: p.name, wert: p.wert, torwart: p.torwart, urteil: ergebnis.get(p) })),
    ...seine.map((p) => ({ ...versatz(p), label: p.name, wert: p.wert, torwart: p.torwart, gegner: true })),
  ];

  const bilanz = (l: Duell[]) => {
    const mitWert = l.filter((d) => d.farbe !== "grau");
    return mitWert.length ? `${mitWert.filter((d) => d.farbe === "gruen").length} von ${mitWert.length} Duellen mit dem wertvolleren Spieler` : "Werte fehlen";
  };
  const seiten = seitenVergleich(seineEigen);
  const vorne = meine.filter((p) => !p.torwart && p.y < ABWEHR_Y && istAussen(p.x));
  const rechts = vorne.filter((p) => p.x >= 104).length;
  const deineSeite = rechts * 2 === vorne.length ? null : rechts * 2 > vorne.length ? "rechts" : "links";

  const punkte: { text: string; ok?: boolean }[] = [];
  // ✓/✗ nur, wenn Werte da sind
  const urteil = (l: Duell[]) => (l.some((d) => d.farbe !== "grau") ? l.every((d) => d.farbe !== "rot") : undefined);
  if (abwehr.length) punkte.push({ text: `Abwehr gegen seine Stürmer: ${bilanz(abwehr)}`, ok: urteil(abwehr) });
  for (const d of abwehr.filter((x) => x.farbe === "rot"))
    punkte.push({ text: `${d.er.name} (${mio(d.er.wert)}) gegen ${d.du.name} (${mio(d.du.wert)})`, ok: false });
  if (angriff.length) punkte.push({ text: `Angriff gegen seine Abwehr: ${bilanz(angriff)}`, ok: urteil(angriff) });
  if (seiten.angriff)
    punkte.push(
      deineSeite
        ? { text: `Deine Außen standen ${deineSeite}, seine schwächere Abwehrseite lag für dich ${seiten.angriff}`, ok: deineSeite === seiten.angriff }
        : { text: `Deine Außen gleich verteilt; seine schwächere Abwehrseite lag für dich ${seiten.angriff}` },
    );

  return (
    <Card className="p-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
        <div>
          <Spielfeld spieler={feld} vergleich titel={`${ich.name} gegen ${er.name}`} />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-label-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-label-3 bg-white" /> {ich.name} (du)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rotate-45 bg-[#7f1d1d]" /> {er.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#16a34a] text-[9px] font-bold text-white">✓</span> Duell: du wertvoller
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#dc2626] text-[9px] font-bold text-white">✗</span> Duell: er wertvoller
            </span>
          </div>
        </div>
        <div>
          <div className="text-[15px] font-semibold">Hat die Aufstellung getroffen?</div>
          <ul className="mt-2 space-y-1.5 text-[13.5px]">
            {punkte.map((p) => (
              <li key={p.text} className="flex gap-2">
                <span className={`font-bold ${p.ok === true ? "text-green" : p.ok === false ? "text-red" : "text-label-3"}`}>
                  {p.ok === true ? "✓" : p.ok === false ? "✗" : "•"}
                </span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-label-3">
            Ein Feld aus deiner Sicht (dein Tor unten), seine Plätze gespiegelt. Ring = Marktwert (feste Skala). ✓/✗ = Duell mit dem nächsten Gegenspieler
            (seine Stürmer gegen deine Abwehr, deine Stürmer gegen seine Abwehr). Steht er fast auf deinem Spieler, ist seine Raute leicht nach oben versetzt.
            Werte = heutiger Stand der Kaderseiten.
          </p>
        </div>
      </div>
    </Card>
  );
}
