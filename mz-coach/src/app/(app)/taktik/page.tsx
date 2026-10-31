// Taktikseite (Marcus, 31.10.2026): deine Reiter automatisch aus dem Editor, je Reiter die Vorschläge (Besetzung,
// Wechsel, kann weg, überschreiben, Name), U18 und freund mit eigenen Regeln, XML und Umbenennen. Darunter Abdeckung je
// Gegnerklasse, Archiv von Hand und die Prüfung einer XML.

import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Spielfeld, type FeldSpieler } from "@/components/spielfeld";
import { DateiKnopf } from "@/components/datei-knopf";
import { ReiterLoeschenKnopf, ReiterNameForm, TaktikCheckKarte } from "@/components/taktik-check-karte";
import { Badge, Card, Section } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { letzteEditorAktion } from "@/lib/db/taktik";
import { spieltagLage } from "@/lib/spieltag";
import { letzterAbruf } from "@/lib/db/abruf";
import { datumZeit } from "@/lib/format";
import { stilDe } from "@/lib/mz/analyse/gegner";
import { PRIO_NR } from "@/lib/taktik-check";
import { reiterUebersicht, type ReiterKarte } from "@/lib/reiter-uebersicht";
import { vorschlagText } from "@/lib/portfolio-plan";
import { TAKTIKEN } from "@/lib/wissen/startbasis";
import { ArchivForm } from "./archiv-form";
import { PruefForm } from "./pruef-form";

const ART: Record<ReiterKarte["art"], { text: string; ton: "neutral" | "green" | "orange" | "tint" }> = {
  offiziell: { text: "offiziell", ton: "tint" },
  liga: { text: "Liga, automatisch", ton: "neutral" },
  jugend: { text: "Jugend", ton: "orange" },
  freund: { text: "Freundschaft", ton: "green" },
  leer: { text: "leer", ton: "neutral" },
};

const komma = (n: number) => n.toFixed(2).replace(".", ",");

export default async function Taktik() {
  await connection();
  const db = getDb();
  const { karten, plan, stand, wichtig } = reiterUebersicht(db);
  // Letzte Editor-Aktion (bis 30 Minuten danach), damit die Meldung nach dem Neuladen sichtbar bleibt
  const letzte = letzteEditorAktion(db);
  // Formation Liga: was die Seite für das nächste Ligaspiel hinterlegt hat (spieltag.ts, abruf/liga.ts)
  const lage = spieltagLage(db);
  const kontrolle = letzterAbruf(db, "liga-kontrolle");
  const zeigeLetzte = !!letzte;
  const kader = new Map(ladeKader(db).map((s) => [s.pid, s]));
  const name = (pid: number) => kader.get(pid)?.name.split(" ").at(-1) ?? String(pid);
  const feld = (k: ReiterKarte): FeldSpieler[] =>
    (k.archiv?.taktik?.pos ?? []).map((p) => ({ x: p.start.x, y: p.start.y, label: name(p.pid), torwart: p.pos === "goalie" }));
  const genutzt = karten.filter((k) => k.art !== "leer");
  const vorschlaege = karten.filter((k) => (k.check && !k.check.ok) || k.portfolio || k.sinn?.name || k.freund?.xml || k.freund?.stilVorschlag).length;

  return (
    <>
      <PageHeader
        title="Taktik"
        subtitle={`${genutzt.length} Reiter${stand ? ` · aus dem Editor gelesen ${datumZeit(stand)}` : " · noch nicht aus dem Editor gelesen (beim nächsten Kaderabruf)"} · ${vorschlaege ? `${vorschlaege} mit Vorschlägen` : "keine Vorschläge"}`}
      />
      <div className="seite">
        {zeigeLetzte && (
          <p className={`mb-4 rounded-md px-3 py-2 text-[13px] ${letzte!.ok ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
            {letzte!.ok ? "✓" : "✗"} {letzte!.aufgabe}: {letzte!.text} ({datumZeit(letzte!.beginn)})
          </p>
        )}
        <Section
          title="Deine Reiter"
          footer="Stand: wie beim letzten Kaderabruf im Editor (täglich, nur gelesen). Vorschläge übernimmt die Seite erst auf Klick, mit Rückfrage, und prüft danach durch Neuladen. Namen höchstens 6 Zeichen (Grenze des Editors)."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {karten.map((k) => (
              <Card key={k.slot ?? k.name} className="flex flex-col">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-separator px-4 py-3">
                  <span className="flex items-center gap-2">
                    {k.slot && <span className="text-[12px] font-semibold text-label-3">{k.slot.toUpperCase()}</span>}
                    {k.archiv ? (
                      <Link href={`/taktik/${encodeURIComponent(k.archiv.reiter)}`} className="text-[16px] font-bold hover:underline">
                        {k.name}
                      </Link>
                    ) : (
                      <span className="text-[16px] font-bold">{k.name}</span>
                    )}
                    <Badge tone={ART[k.art].ton}>{ART[k.art].text}</Badge>
                  </span>
                  <span className="text-[12.5px] text-label-2">
                    {k.stil ? stilDe(k.stil) : ""}
                    {k.alter && (k.alter.von > 16 || k.alter.bis < 38) ? ` · Alter ${k.alter.von} bis ${k.alter.bis}` : ""}
                  </span>
                </div>
                {k.art === "leer" ? (
                  <p className="px-4 py-3 text-[13px] text-label-2">Leer: frei für einen neuen Stil oder eine Seitenvariante.</p>
                ) : (
                  <div className="grid gap-3 px-4 py-3 sm:grid-cols-[150px_1fr]">
                    {k.art === "liga" && lage.liga ? <Spielfeld spieler={lage.liga.feld} /> : k.archiv?.taktik ? <Spielfeld spieler={feld(k)} /> : <div />}
                    <div className="space-y-2 text-[13px]">
                      {k.art === "liga" ? <LigaInhalt lage={lage} kontrolle={kontrolle} /> : <Inhalt k={k} wichtig={wichtig.map((w) => w.name.split(" ").at(-1)!)} />}
                    </div>
                  </div>
                )}
                {k.art !== "leer" && (
                  <div className="mt-auto space-y-2 border-t border-separator px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {k.art === "liga" && lage.liga && <DateiKnopf text={lage.liga.xml} dateiname="Liga.xml" label="XML" />}
                      {k.archiv && <DateiKnopf text={k.archiv.xml} dateiname={`${k.name}.xml`.replace(/[^\w.-]+/g, "_")} label="XML" />}
                      {k.art !== "liga" && <ReiterNameForm reiter={k.name} vorschlag={k.nameVorschlag} />}
                      {k.art !== "liga" && k.slot !== "a" && <ReiterLoeschenKnopf reiter={k.name} />}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Section>

        {karten.some((k) => k.art === "leer") && (
          <p className="-mt-2 mb-4 text-[13px] text-label-2">
            Leere Reiter (frei für neue Stile oder Seitenvarianten):{" "}
            {karten
              .filter((k) => k.art === "leer")
              .map((k) => k.name)
              .join(", ")}
          </p>
        )}
        <Section
          title="Deckst du alles ab?"
          footer="Bewährt = bei den Top 10 mindestens 3 Spiele und 60 % Punktquote gegen diese Gegnerklasse. Nur offizielle Reiter zählen."
        >
          <Card className="px-4 py-3 text-[13px]">
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {plan.abdeckung.map((a) => (
                <li key={a.klasse} className="flex gap-2">
                  <span className={`font-bold ${a.reiter.length ? "text-green" : a.bester ? "text-red" : "text-label-3"}`}>
                    {a.reiter.length ? "✓" : a.bester ? "✗" : "–"}
                  </span>
                  <span>
                    {a.klasse}:{" "}
                    {a.reiter.length ? a.reiter.join(", ") : a.bester ? `Lücke (bewährt: ${stilDe(a.bester.schluessel)})` : "kein bewährter Stil bekannt"}
                    {a.dein && (
                      <span className="text-label-3">
                        {" "}
                        · dein Stil {stilDe(a.dein.schluessel)}: {Math.round(a.dein.quote * 100)} % in {a.dein.spiele} Top-10-Spielen
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {plan.abdeckung.length === 0 && <li className="text-label-2">Noch keine Top-10-Spiele ausgewertet.</li>}
            </ul>
            {plan.doppelt.length > 0 && (
              <p className="mt-2 text-label-2">
                Kann weg oder neu belegt werden:{" "}
                {plan.doppelt
                  .filter((d) => d.art !== "gespiegelt")
                  .map((d) => `${d.reiter} (${d.art} wie ${d.wie})`)
                  .join(" · ") || "nichts"}
              </p>
            )}
          </Card>
        </Section>

        <div className="lg:grid lg:grid-cols-2 lg:gap-x-10 lg:items-start">
          <Section
            title="Taktik von Hand ins Archiv"
            footer="Nur nötig für Reiter, die der Kaderabruf nicht liest. Sonst kommt jeder Reiter automatisch aus dem Editor."
          >
            <ArchivForm reiter={TAKTIKEN.map((t) => t.name)} />
          </Section>
          <Section
            title="Taktik prüfen"
            footer="Prüfliste aus mz-wissen.md, Abschnitt 5. Fehler = Regel eindeutig verletzt. Hinweis = Regel ohne genaue Grenze oder nur teilweise prüfbar."
          >
            <PruefForm />
          </Section>
        </div>
      </div>
    </>
  );
}

// Reiter Liga: Gegner, Grundlage, was angepasst wurde, Bank und Stand in ManagerZone
function LigaInhalt({ lage, kontrolle }: { lage: ReturnType<typeof spieltagLage>; kontrolle: ReturnType<typeof letzterAbruf> }) {
  const l = lage.liga;
  const st = lage.ligaStatus;
  const gegner = lage.lauf?.gegnerName;
  const anstoss = lage.lauf?.anstoss;
  return (
    <>
      <div className="font-semibold">
        {gegner ? `Gegen ${gegner}` : "Nächster Gegner unbekannt"}
        {anstoss ? `, ${datumZeit(anstoss)}` : ""}
      </div>
      {st && (
        <div className={st.ok ? "text-green" : "text-red"}>
          {st.ok ? "✓" : "✗"} {st.meldung} ({datumZeit(st.beendet ?? st.gestartet)})
        </div>
      )}
      {kontrolle && (
        <div className={kontrolle.ok ? "text-label-2" : "text-red"}>
          Zuletzt geprüft {datumZeit(kontrolle.beendet ?? kontrolle.gestartet)}: {kontrolle.meldung}
        </div>
      )}
      {l ? (
        <>
          {lage.vorschlag && (
            <div className="text-label-2">
              Gewählt: {lage.vorschlag.taktik} ({lage.vorschlag.quelle}) · {lage.vorschlag.kurz.join(" · ")}
            </div>
          )}
          <ul className="space-y-1 text-label-2">
            {l.kurz.map((z) => (
              <li key={z}>• {z}</li>
            ))}
            {l.hinweise.map((z) => (
              <li key={z} className="text-orange">
                • {z}
              </li>
            ))}
          </ul>
          <div className="text-label-3">Bank: {l.bank.join(", ")}</div>
        </>
      ) : (
        <div className="text-red">Noch keine Formation Liga berechnet (kein Gegner oder zu wenige aufstellbare Spieler).</div>
      )}
      <div className="text-label-3">
        Neu berechnet nach jeder Spieltag-Analyse und bei jedem täglichen Kaderabruf bis zum Anstoß geprüft; in ManagerZone geschrieben nur, wenn sich etwas ändert.
      </div>
    </>
  );
}

// Vorschläge und Hinweise eines Reiters
function Inhalt({ k, wichtig }: { k: ReiterKarte; wichtig: string[] }) {
  const punkte: { text: string; ton?: "rot" | "grau" }[] = [];
  if (k.art === "liga") punkte.push({ text: "Schreibt die Seite nach jeder Spieltag-Analyse selbst (Aufstellung gegen den nächsten Gegner).", ton: "grau" });
  if (k.art === "jugend")
    punkte.push({
      text: `Eine Aufstellung für alles: nur Spieler im Alter, Nr. ${PRIO_NR.von} bis ${PRIO_NR.bis} zuerst aufs Feld (Spielpraxis).`,
      ton: "grau",
    });
  if (k.art === "freund")
    punkte.push({
      text: `Wichtigste Spieler auf die Bank (Form und Erfahrung ohne Verletzungsgefahr): ${wichtig.slice(0, 5).join(", ") || "Startelf unbekannt"}.`,
      ton: "grau",
    });
  if (k.doppelt && k.doppelt.art !== "gespiegelt") punkte.push({ text: `Kann weg: ${k.doppelt.art} wie ${k.doppelt.wie}.`, ton: "rot" });
  if (k.doppelt?.art === "gespiegelt") punkte.push({ text: `Seitenvariante zu ${k.doppelt.wie} (gewollt).`, ton: "grau" });
  for (const p of k.sinn?.probleme ?? []) punkte.push({ text: p, ton: "rot" });
  for (const p of k.sinn?.hinweise ?? []) punkte.push({ text: p });
  for (const p of k.freund?.probleme ?? []) punkte.push({ text: p, ton: "rot" });
  for (const p of k.freund?.hinweise ?? []) punkte.push({ text: p });
  if (k.check?.fehler) punkte.push({ text: `Check nicht möglich: ${k.check.fehler}`, ton: "grau" });
  const ok = !punkte.some((p) => p.ton !== "grau") && (!k.check || k.check.ok) && !k.portfolio;
  return (
    <>
      <ul className="space-y-1">
        {punkte.map((p) => (
          <li key={p.text} className={p.ton === "rot" ? "text-red" : p.ton === "grau" ? "text-label-3" : "text-label-2"}>
            • {p.text}
          </li>
        ))}
        {ok && <li className="text-green">✓ Besetzung, Wechsel und Name passen.</li>}
      </ul>
      {k.check && !k.check.ok && (
        <div className="-mx-4 border-t border-separator">
          <TaktikCheckKarte reiter={k.name} titel="Besetzung und Wechsel" punkte={k.checkPunkte} gewinn={k.check.gewinn} xml={k.check.xml} />
        </div>
      )}
      {k.portfolio && (
        <div className="-mx-4 border-t border-separator">
          <TaktikCheckKarte
            reiter={k.name}
            titel="Überschreiben"
            art="portfolio"
            neuerName={k.portfolio.name}
            punkte={
              k.portfolio.art === "seite"
                ? [vorschlagText(k.portfolio)]
                : [
                    vorschlagText(k.portfolio),
                    `Topteams: ${k.portfolio.teams.slice(0, 3).join(", ")}`,
                    `Mit deiner besten Elf: MZ-Wert ${komma(k.portfolio.summe)}`,
                  ]
            }
            gewinn={0}
            xml={k.portfolio.xml}
          />
        </div>
      )}
      {k.freund?.xml && (
        <div className="-mx-4 border-t border-separator">
          <TaktikCheckKarte reiter={k.name} titel="Wichtigste auf die Bank" art="freund-bank" punkte={k.freund.aenderungen} gewinn={0} xml={k.freund.xml} />
        </div>
      )}
      {k.freund?.stilVorschlag && (
        <div className="-mx-4 border-t border-separator">
          <TaktikCheckKarte
            reiter={k.name}
            titel="Anderer Stil"
            art="freund-stil"
            punkte={[`${stilDe(k.freund.stilVorschlag.stil)}: ${k.freund.stilVorschlag.grund}`, "Wichtigste Spieler auf der Bank, keine Einwechslung."]}
            gewinn={0}
            xml={k.freund.stilVorschlag.xml}
          />
        </div>
      )}
    </>
  );
}
