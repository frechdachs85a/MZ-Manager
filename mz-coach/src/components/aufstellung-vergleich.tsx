import { Spielfeld, type FeldSpieler } from "@/components/spielfeld";
import { Card } from "@/components/ui";
import { duelle } from "@/lib/mz/analyse/duelle";
import { seitenVergleich } from "@/lib/mz/analyse/seiten";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { istAussen } from "@/lib/mz/taktik/pruefer";
import { ABWEHR_Y } from "@/lib/mz/analyse/gegner";

// Aufstellungen eines Spiels im Vergleich (Marcus, 30.10.2026): deine Startelf, seine Startelf und beide übereinander.
// Im Vergleichsfeld werden seine Plätze auf dein Feld gespiegelt (x -> 208 − x, y -> 326 − y; mz-wissen.md, Abschnitt 13),
// so steht jeder seiner Spieler dort, wo er bei dir ankommt. Bewertung nur aus Plätzen und Marktwerten (heutiger
// Stand der Kaderseiten, nicht der Wert am Spieltag).

const kurz = (name: string) => name.split(" ").at(-1) ?? name;
const spiegelX = (x: number) => 208 - x;
const spiegelY = (y: number) => 326 - y;

export function AufstellungVergleich({ spiel, eigeneTid, werte }: { spiel: StatsSpiel; eigeneTid: number; werte: Record<number, number> }) {
  const er = spiel.teams.find((t) => t.id !== eigeneTid);
  const ich = spiel.teams.find((t) => t.id === eigeneTid);
  if (!er || !ich) return null;
  const elf = (tid: number) =>
    spiel.spieler.filter((p) => p.teamId === tid && p.editor).map((p) => ({ x: p.editor!.x, y: p.editor!.y, label: kurz(p.name), name: kurz(p.name), wert: werte[p.id], torwart: p.torwart }));
  const meine = elf(ich.id);
  const seine = elf(er.id);
  if (!meine.length || !seine.length) return null;
  const uebereinander: FeldSpieler[] = [...meine, ...seine.map((p) => ({ ...p, x: spiegelX(p.x), y: spiegelY(p.y), gegner: true }))];

  // Getroffen? Duelle seiner Stürmer gegen deine Verteidiger, und ob dein Angriff über seine schwächere Abwehrseite lief
  const d = duelle(meine, seine);
  const seiten = seitenVergleich(seine);
  const vorne = meine.filter((p) => !p.torwart && p.y < ABWEHR_Y && istAussen(p.x));
  const rechts = vorne.filter((p) => p.x >= 104).length;
  const links = vorne.length - rechts;
  const deineSeite = rechts === links ? null : rechts > links ? "rechts" : "links";
  const punkte: string[] = [...d.kurz];
  if (seiten.angriff) {
    punkte.push(
      deineSeite
        ? `Angriff: deine Außen standen ${deineSeite}, seine schwächere Abwehrseite lag für dich ${seiten.angriff} → ${deineSeite === seiten.angriff ? "getroffen" : "nicht getroffen"}`
        : `Angriff: deine Außen gleich verteilt; seine schwächere Abwehrseite lag für dich ${seiten.angriff}`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-3">
          <div className="mb-2 text-[14px] font-semibold">{ich.name} (du)</div>
          <Spielfeld spieler={meine} />
        </Card>
        <Card className="p-3">
          <div className="mb-2 text-[14px] font-semibold">{er.name}</div>
          <Spielfeld spieler={seine} />
          <div className="mt-1 text-[11.5px] text-label-3">Seine Sicht (sein Tor unten)</div>
        </Card>
        <Card className="p-3">
          <div className="mb-2 text-[14px] font-semibold">Übereinander</div>
          <Spielfeld spieler={uebereinander} />
          <div className="mt-1 text-[11.5px] text-label-3">Weiß = du (dein Tor unten), dunkel = {er.name}, auf dein Feld gespiegelt</div>
        </Card>
      </div>
      {punkte.length > 0 && (
        <Card className="p-4">
          <div className="text-[14px] font-semibold">Hat die Aufstellung getroffen?</div>
          <ul className="mt-2 space-y-1 text-[13.5px]">
            {punkte.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-tint" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-label-3">Duelle: seine Stürmer gegen deine Verteidiger nach Marktwert. Werte = heutiger Stand der Kaderseiten.</p>
        </Card>
      )}
    </div>
  );
}
