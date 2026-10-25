import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Card, Hero, Kachel, List, Row, Section, Unavailable } from "@/components/ui";
import { startelfAusLetztemSpiel } from "@/lib/db/markt";
import { letzterGegner } from "@/lib/gegner-analyse";
import { spieltagCheckliste } from "@/lib/checkliste";
import { ladeRohseite, letzteRohseite } from "@/lib/db/abruf";
import { tabelleAus } from "@/lib/mz/parser/tabelle";
import { schwachstellen } from "@/lib/mz/analyse/markt";
import { getDb } from "@/lib/db";
import { ladeKader, letzteAenderungen } from "@/lib/db/kader";
import { einsatzImLigaspiel } from "@/lib/mz/einsatz";
import { StatusBadges } from "@/components/status";
import { datumZeit, heuteInBerlin } from "@/lib/format";
import { naechsterLigaspieltag, TEAM } from "@/lib/wissen/startbasis";

export default async function Uebersicht() {
  await connection(); // Datum pro Anfrage, nicht beim Build
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const db = getDb();
  const aenderungen = letzteAenderungen(db, 8);
  const kader = ladeKader(db);
  const einsatz = kader.map((s) => ({ s, e: einsatzImLigaspiel(s, spieltag) }));
  const taktikStand = kader.map((s) => s.statusStand?.aufstellbar).filter(Boolean).sort().at(-1);
  const fehlen = einsatz.filter((x) => x.e.lage === "nicht_bereit" || x.e.lage === "unklar" || x.s.status?.verletzt);
  const zurueck = einsatz.filter((x) => x.e.lage === "wieder_bereit");
  const gesperrt = kader.filter((s) => s.status?.gesperrt);
  const start = startelfAusLetztemSpiel(db);
  const gegner = letzterGegner(db);
  const check = spieltagCheckliste(db);
  const tabRoh = letzteRohseite(db, "tabelle");
  const tabHtml = tabRoh ? ladeRohseite(db, tabRoh.id, "dom") ?? ladeRohseite(db, tabRoh.id, "roh") : null;
  const tabelle = tabHtml ? tabelleAus(tabHtml.html, TEAM.name) : null;
  const schwach = start ? schwachstellen(start.elf, kader).liste[0] : undefined;
  const nichtDabei = new Set([...fehlen.map((x) => x.s.pid), ...gesperrt.map((s) => s.pid)]).size;
  const kurzDatum = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(spieltag);
  const datum = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(spieltag);

  return (
    <>
      <PageHeader
        title="Übersicht"
        subtitle={`${TEAM.name} · ${TEAM.liga}`}
        action={
          <Link href="/einstellungen" aria-label="Einstellungen" className="pressable -mr-2 flex h-11 w-11 items-center justify-center text-tint">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        }
      />
      <div className="seite mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <Kachel titel="Nächstes Ligaspiel" wert={kurzDatum} unten="Mittwochs und sonntags. Gegner und Anstoß: noch nicht verfügbar" />
        <Kachel
         
          titel="Fehlen oder unklar"
          wert={taktikStand ? nichtDabei : "n. v."}
          unten={taktikStand ? `${zurueck.length} kommen rechtzeitig zurück` : "Taktikseite noch nicht eingelesen"}
        />
        <Kachel titel="Kader" wert={kader.length || "n. v."} unten={kader.length ? "Spieler im Kader" : "noch kein Kaderabruf"} href="/kader" />
        <Kachel
         
          titel="Größte Schwachstelle"
          wert={schwach ? schwach.wert.toFixed(2).replace(".", ",") : "n. v."}
          unten={schwach ? `${schwach.spieler.name} als ${schwach.rolle}` : "kein eigenes Spiel gespeichert"}
          href="/markt"
        />
      </div>
      <div className="seite">
        <Section title="Spieltag-Checkliste" footer="Aus den gespeicherten Daten. Gelb: veraltet oder mit Fehlern, grau: noch offen.">
          <Card>
            <ul className="grid divide-y divide-separator lg:grid-cols-2 lg:divide-y-0">
              {check.map((c) => (
                <li key={c.titel} className="lg:border-b lg:border-separator lg:odd:border-r">
                  <Link href={c.href ?? "/"} className="zeile-hover flex items-start gap-3 px-5 py-4">
                    <span
                      aria-label={c.status === "ok" ? "erledigt" : c.status === "warnung" ? "prüfen" : "offen"}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        c.status === "ok" ? "bg-tint text-white" : c.status === "warnung" ? "bg-yellow text-ink" : "border border-label-3 text-label-3"
                      }`}
                    >
                      {c.status === "ok" ? "✓" : c.status === "warnung" ? "!" : ""}
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium">{c.titel}</span>
                      <span className="block text-[13px] leading-relaxed text-label-2">{c.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      </div>
      <div className="seite lg:grid lg:grid-cols-2 lg:gap-x-10">

        <Section
          title="Empfohlene Taktik"
          footer={
            gegner
              ? `Zuletzt eingelesener Gegner (Stand ${datumZeit(gegner.stand)}). Ob er der nächste Ligagegner ist, prüft die Seite erst mit dem Spielplan-Abruf.`
              : undefined
          }
        >
          {gegner?.analyse ? (
            <Link href={`/gegner/${gegner.tid}`} className="block">
              <Hero className="transition-shadow hover:shadow-[0_16px_40px_-18px_rgba(18,41,31,0.6)]">
                <div className="kapitaelchen !text-gold-hell">Gegen {gegner.name}</div>
                <div className="display mt-2 text-[40px] font-semibold leading-none">{gegner.analyse.empfehlung.taktik}</div>
                <div className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-[#f5f2ea]/80">{gegner.analyse.urteilText}</div>
                <div className="mt-4 text-[13px] text-gold-hell">
                  {gegner.stats.length} von {gegner.liga.length} Ligaspielen ausgewertet · Analyse öffnen →
                </div>
              </Hero>
            </Link>
          ) : (
            <Unavailable title="Taktik fürs nächste Spiel" reason="Noch kein Gegner mit ausgewerteten Ligaspielen. Unter „Gegner“ eine Spielliste einlesen." />
          )}
        </Section>

        <Section
          title={`Einsatz am ${datum}`}
          footer={
            taktikStand
              ? `Kegel laut Taktikseite (Stand ${datumZeit(taktikStand)}) plus Enddatum aus dem Trainingslager. Ob ein Spieler am Enddatum selbst schon frei ist, ist nicht belegt. Sperren stehen auf ManagerZone je Wettbewerb.`
              : undefined
          }
        >
          {!taktikStand ? (
            <Unavailable title="Wer ist aufstellbar?" reason="Taktikseite noch nicht eingelesen (Einstellungen, Seiten hochladen)." />
          ) : (
            <List>
              {fehlen.length === 0 && zurueck.length === 0 && gesperrt.length === 0 && (
                <Row title="Alle aufstellbar" detail="Laut Taktikseite hat kein Spieler einen Kegel." />
              )}
              {fehlen.map(({ s, e }) => (
                <Row key={s.pid} title={<span className="flex flex-wrap items-center gap-1.5">{s.name} <StatusBadges s={s} /></span>} detail={e.text} />
              ))}
              {zurueck.map(({ s, e }) => (
                <Row key={s.pid} title={<span className="flex flex-wrap items-center gap-1.5">{s.name} <span className="text-[13px] text-green">wieder dabei</span></span>} detail={e.text} />
              ))}
              {gesperrt.map((s) => (
                <Row
                  key={`g${s.pid}`}
                  title={`${s.name}: Sperre`}
                  detail={(s.sperren ?? [])
                    .map((x) => `${x.karte}, ${x.spiele} Spiel(e), gilt laut Seite für ${x.art}: ${x.wettbewerb}`)
                    .join(" · ")}
                />
              ))}
            </List>
          )}
        </Section>

        <Section title="Tabelle" footer={tabRoh ? `Stand ${datumZeit(tabRoh.abgerufen)}, so wie ManagerZone sie zeigt.` : undefined}>
          {tabelle ? (
            <Card>
              <table className="w-full text-[14px]">
                {tabelle.kopf.length > 0 && (
                  <thead>
                    <tr className="border-b border-separator text-left text-[12px] text-label-2">
                      {tabelle.kopf.map((k, i) => (
                        <th key={i} className="px-3 py-2 font-medium first:pl-5 last:pr-5">{k}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-separator">
                  {tabelle.zeilen.map((z, i) => (
                    <tr key={i} className={z.eigen ? "bg-gold-hell/30 font-semibold" : ""}>
                      {z.zellen.map((c, j) => (
                        <td key={j} className="px-3 py-2 tabular-nums first:pl-5 last:pr-5">{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <Unavailable
              title={TEAM.liga}
              reason={tabRoh ? `Tabellenseite vom ${datumZeit(tabRoh.abgerufen)} gespeichert, aber keine Tabelle mit ${TEAM.name} darin erkannt.` : "Wird beim täglichen Abruf (ab 4 Uhr, mit Login) geholt."}
            />
          )}
        </Section>

        <Section title="Letzte Skill-Änderungen">
          {aenderungen.length ? (
            <List>
              {aenderungen.map((a, i) => (
                <Row
                  key={i}
                  title={`${a.name}: ${a.feld}`}
                  detail={datumZeit(a.datum)}
                  value={<span className="tabular-nums">{a.alt ?? "?"} → {a.neu ?? "?"}</span>}
                />
              ))}
            </List>
          ) : (
            <Unavailable title="Änderungsliste" reason="Entsteht ab dem zweiten Kaderabruf, jede Änderung wird mit Datum gespeichert." />
          )}
        </Section>
      </div>
    </>
  );
}
