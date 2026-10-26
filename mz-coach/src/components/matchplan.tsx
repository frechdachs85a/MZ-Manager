import Link from "next/link";
import { Spielfeld } from "@/components/spielfeld";
import { DateiKnopf } from "@/components/datei-knopf";
import { Hero } from "@/components/ui";
import type { spieltagLage } from "@/lib/spieltag";

// Das Herzstück (Marcus, 26.10.2026): Taktikvorschlag für das nächste Ligaspiel, groß und sofort sichtbar.
// Gegner, Anstoß, vorgeschlagener Reiter mit Aufstellung auf dem Feld, die Gründe und was dagegen spricht.

type Lage = ReturnType<typeof spieltagLage>;

const anstossText = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function Matchplan({ l, mitLink }: { l: Lage; mitLink?: boolean }) {
  const { lauf, vorschlag, aufstellung, gegner, anpassungen, taktikCode } = l;
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
            <div className="display mt-1 text-[64px] font-bold uppercase leading-[0.9] text-tint-hell lg:text-[88px]">{vorschlag?.taktik ?? "n. v."}</div>
            {aufstellung?.einstellung && <div className="mt-2 text-[15px] font-semibold text-label">{aufstellung.einstellung}</div>}
          </div>

          {vorschlag ? (
            <>
              <div className="mt-4 text-[12.5px] font-semibold uppercase tracking-wider text-label-3">Grundlage: {vorschlag.quelle}</div>
              <p className="mt-1 text-[14px] leading-relaxed text-label">{vorschlag.begruendung}</p>
              {gegner?.analyse && <p className="mt-2 text-[13.5px] leading-relaxed text-label-2">{gegner.analyse.urteilText}</p>}
              {anpassungen.length > 0 && (
                <div className="mt-4 rounded-[8px] bg-white/[0.07] p-3">
                  <div className="text-[12.5px] font-bold uppercase tracking-wider text-tint-hell">Anpassungen für dieses Spiel</div>
                  <ul className="mt-1.5 space-y-1.5 text-[13.5px] leading-relaxed text-label">
                    {anpassungen.map((a, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden className="text-tint-hell">→</span>
                        <span>{a.art === "wechselzeit" ? `${a.name} erst ab der ${a.ab}. Minute auswechseln. ${a.grund}` : a.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {stuetzen.length + dagegen.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-[13.5px] leading-relaxed text-label-2">
                  {stuetzen.map((b, i) => (
                    <li key={`s${i}`} className="flex gap-2.5">
                      <span aria-label="stützt" className="mt-[1px] font-bold text-tint-hell">✓</span>
                      <span>
                        <span className="font-semibold text-label">{b.quelle}</span>
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
              )}
            </>
          ) : (
            <p className="mt-5 text-[14px] text-label-2">Noch keine Ligaspiele des Gegners mit Stats-XML gespeichert: kein Vorschlag möglich.</p>
          )}

          {taktikCode && taktikCode.art !== "archiv" && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <DateiKnopf text={taktikCode.xml} dateiname={`${vorschlag?.taktik ?? "taktik"}-${lauf.gegnerName ?? "gegner"}.xml`.replace(/[^\w.-]+/g, "_")} label={taktikCode.art === "angepasst" ? "Angepasste Taktik als XML" : "Taktik als XML (neu)"} />
              <span className="text-[12.5px] text-label-2">
                {taktikCode.art === "angepasst" ? `Dein Reiter ${vorschlag?.taktik} aus dem Archiv mit: ${taktikCode.geaendert.join(", ")}.` : `${vorschlag?.taktik} ist nicht in deinem Archiv: neu erzeugt mit deiner besten Besetzung.`}
              </span>
            </div>
          )}
          {taktikCode?.art === "archiv" && <p className="mt-4 text-[12.5px] text-label-2">Reiter {vorschlag?.taktik} ist in deinem Archiv und braucht keine Änderung: im Spiel einfach diesen Reiter wählen.</p>}

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
              <div className="kapitaelchen mb-3">Aufstellung {vorschlag?.taktik}</div>
              <div className="mx-auto max-w-[340px]">
                <Spielfeld spieler={aufstellung.feld} titel={`Aufstellung ${vorschlag?.taktik}`} />
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
