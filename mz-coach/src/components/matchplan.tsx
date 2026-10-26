import Link from "next/link";
import { Spielfeld } from "@/components/spielfeld";
import { Hero } from "@/components/ui";
import type { spieltagLage } from "@/lib/spieltag";

// Das Herzstück (Marcus, 26.10.2026): Taktikvorschlag für das nächste Ligaspiel, groß und sofort sichtbar.
// Gegner, Anstoß, vorgeschlagener Reiter mit Aufstellung auf dem Feld, die Gründe und was dagegen spricht.

type Lage = ReturnType<typeof spieltagLage>;

const anstossText = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function Matchplan({ l, mitLink }: { l: Lage; mitLink?: boolean }) {
  const { lauf, empfehlung, aufstellung, gegner } = l;
  if (!lauf?.anstoss || !lauf.gegnerTid) {
    return (
      <Hero>
        <div className="kapitaelchen !text-tint-hell">Matchplan · Nächstes Ligaspiel</div>
        <div className="display mt-2 text-[30px] font-bold uppercase leading-none">Noch kein Spielplan abgerufen</div>
        <p className="mt-3 text-[14px] text-label-2">Unter „Spieltag“ einmal „Jetzt abrufen“, danach läuft es automatisch 5 Stunden nach jedem Ligaspiel.</p>
      </Hero>
    );
  }
  const stuetzen = l.belege.filter((b) => b.stuetzt === true);
  const dagegen = l.belege.filter((b) => b.stuetzt === false);
  return (
    <Hero className="!p-0">
      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="p-6 lg:p-8">
          <div className="kapitaelchen !text-tint-hell">
            Matchplan · {anstossText(lauf.anstoss)} · {lauf.heim ? "Heimspiel" : "Auswärtsspiel"}
          </div>
          <div className="display mt-3 text-[15px] font-semibold uppercase text-label-2">{lauf.heim ? "Gegen" : "Bei"}</div>
          <div className="display text-[32px] font-bold uppercase leading-none lg:text-[40px]">{lauf.gegnerName}</div>

          <div className="mt-6 border-t border-separator pt-5">
            <div className="kapitaelchen">Unser Taktikvorschlag</div>
            <div className="display mt-1 text-[64px] font-bold uppercase leading-[0.9] text-tint-hell lg:text-[88px]">{empfehlung?.taktik ?? "n. v."}</div>
            {aufstellung?.einstellung && <div className="mt-2 text-[15px] font-semibold text-label">{aufstellung.einstellung}</div>}
          </div>

          {empfehlung ? (
            <ul className="mt-5 space-y-2 text-[14px] leading-relaxed text-label-2">
              <li className="flex gap-2.5">
                <span aria-hidden className="mt-[3px] text-tint-hell">●</span>
                <span>{gegner?.analyse?.urteilText}</span>
              </li>
              {empfehlung.gruende.slice(0, 2).map((g, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden className="mt-[3px] text-tint-hell">●</span>
                  <span>{g}</span>
                </li>
              ))}
              {stuetzen.map((b, i) => (
                <li key={`s${i}`} className="flex gap-2.5">
                  <span aria-label="stützt" className="mt-[1px] font-bold text-tint-hell">✓</span>
                  <span>
                    <span className="font-semibold text-label">{b.quelle}: </span>
                    {b.text}
                  </span>
                </li>
              ))}
              {dagegen.map((b, i) => (
                <li key={`d${i}`} className="flex gap-2.5">
                  <span aria-label="spricht dagegen" className="mt-[1px] font-bold text-[#fbbf24]">!</span>
                  <span>
                    <span className="font-semibold text-label">{b.quelle}: </span>
                    {b.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-[14px] text-label-2">Noch keine Ligaspiele des Gegners mit Stats-XML gespeichert: kein Vorschlag möglich.</p>
          )}

          {aufstellung && aufstellung.fehler.length > 0 && (
            <div className="mt-5 rounded-[8px] border border-[#fca5a5]/40 bg-[#7f1d1d]/40 p-3 text-[13.5px] text-[#fee2e2]">
              <span className="font-bold">Vor dem Spiel ändern: </span>
              {aufstellung.fehler.map((f) => f.text).join(" ")}
            </div>
          )}

          {mitLink && (
            <Link href="/spieltag" className="mt-6 inline-flex min-h-[44px] items-center rounded-[8px] bg-white/10 px-4 text-[13px] font-semibold uppercase tracking-wider text-label hover:bg-white/15">
              Alle Belege, Gegneranalyse und Spielbericht →
            </Link>
          )}
        </div>

        <div className="border-t border-separator bg-black/10 p-6 lg:border-l lg:border-t-0 lg:p-8">
          {aufstellung ? (
            <>
              <div className="kapitaelchen mb-3">Aufstellung {empfehlung?.taktik}</div>
              <div className="mx-auto max-w-[340px]">
                <Spielfeld spieler={aufstellung.feld} titel={`Aufstellung ${empfehlung?.taktik}`} />
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-label-3">{aufstellung.quelle}</p>
            </>
          ) : (
            <p className="text-[13.5px] text-label-2">Aufstellung des Reiters weder im Taktik-Archiv noch in mz-wissen.md.</p>
          )}
        </div>
      </div>
    </Hero>
  );
}
