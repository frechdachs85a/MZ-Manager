import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Card, Kachel, List, Row, Section, Unavailable } from "@/components/ui";
import { startelfAusLetztemSpiel } from "@/lib/db/markt";
import { spieltagLage } from "@/lib/spieltag";
import { Matchplan } from "@/components/matchplan";
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
  const st = spieltagLage(db);
  const check = spieltagCheckliste(db);
  const tabRoh = letzteRohseite(db, "tabelle");
  const tabHtml = tabRoh ? ladeRohseite(db, tabRoh.id, "dom") ?? ladeRohseite(db, tabRoh.id, "roh") : null;
  const tabelle = tabHtml ? tabelleAus(tabHtml.html, TEAM.name) : null;
  const schwach = start ? schwachstellen(start.elf, kader).liste[0] : undefined;
  const nichtDabei = new Set([...fehlen.map((x) => x.s.pid), ...gesperrt.map((s) => s.pid)]).size;
  const kurzDatum = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(spieltag);

  return (
    <>
      <PageHeader title="Zentrale" subtitle={`${TEAM.name} · ${TEAM.liga}`} />

      {/* Herzstück: Taktikvorschlag für das nächste Ligaspiel */}
      <div className="seite mt-6">
        <Matchplan l={st} mitLink />
      </div>
      <div className="seite mt-4 grid grid-cols-2 gap-4">
          <Kachel
            titel="Fehlen oder unklar"
            ton={taktikStand && nichtDabei > 0 ? "red" : "tint"}
            wert={taktikStand ? nichtDabei : "n. v."}
            unten={taktikStand ? `${zurueck.length} kommen rechtzeitig zurück` : "Taktikseite noch nicht eingelesen"}
          />
          <Kachel
            titel="Größte Schwachstelle"
            ton="gold"
            wert={schwach ? schwach.wert.toFixed(2).replace(".", ",") : "n. v."}
            unten={schwach ? `${schwach.spieler.name} als ${schwach.rolle}` : "kein eigenes Spiel gespeichert"}
            href="/markt"
          />
      </div>

      <div className="seite grid gap-x-6 lg:grid-cols-2">
        <Section title="Aufgaben vor dem Spieltag" footer="Aus den gespeicherten Daten. Gelb: veraltet oder mit Fehlern, grau: noch offen.">
          <Card>
            <ul className="divide-y divide-separator">
              {check.map((c) => (
                <li key={c.titel}>
                  <Link href={c.href ?? "/"} className="zeile-hover flex items-start gap-3 px-4 py-3">
                    <span
                      aria-label={c.status === "ok" ? "erledigt" : c.status === "warnung" ? "prüfen" : "offen"}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[11px] font-bold ${
                        c.status === "ok" ? "bg-tint text-auf-akzent" : c.status === "warnung" ? "bg-yellow text-ink" : "border border-label-3 text-label-3"
                      }`}
                    >
                      {c.status === "ok" ? "✓" : c.status === "warnung" ? "!" : ""}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold">{c.titel}</span>
                      <span className="block text-[12.5px] leading-relaxed text-label-2">{c.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section
          title={`Verfügbarkeit am ${kurzDatum}`}
          aktion={<Link href="/kader" className="text-[12.5px] font-semibold uppercase tracking-wider text-tint hover:text-tint-hell">Kader ({kader.length}) →</Link>}
          footer={
            taktikStand
              ? `Kegel laut Taktikseite (Stand ${datumZeit(taktikStand)}) plus Enddatum aus dem Trainingslager. Ob ein Spieler am Enddatum selbst schon frei ist, ist nicht belegt. Sperren stehen auf ManagerZone je Wettbewerb.`
              : undefined
          }
        >
          {!taktikStand ? (
            <Unavailable title="Wer ist aufstellbar?" reason="Taktikseite noch nicht eingelesen (Einstellungen, Kader jetzt abrufen)." />
          ) : (
            <List>
              {fehlen.length === 0 && zurueck.length === 0 && gesperrt.length === 0 && (
                <Row title="Alle aufstellbar" detail="Laut Taktikseite hat kein Spieler einen Kegel." />
              )}
              {fehlen.map(({ s, e }) => (
                <Row key={s.pid} title={<span className="flex flex-wrap items-center gap-1.5">{s.name} <StatusBadges s={s} /></span>} detail={e.text} />
              ))}
              {zurueck.map(({ s, e }) => (
                <Row key={s.pid} title={<span className="flex flex-wrap items-center gap-1.5">{s.name} <span className="text-[12px] font-semibold uppercase tracking-wider text-green">wieder dabei</span></span>} detail={e.text} />
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
              <table className="w-full text-[13.5px]">
                {tabelle.kopf.length > 0 && (
                  <thead>
                    <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                      {tabelle.kopf.map((k, i) => (
                        <th key={i} className="px-3 py-2 font-semibold first:pl-4 last:pr-4">{k}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-separator">
                  {tabelle.zeilen.map((z, i) => (
                    <tr key={i} className={z.eigen ? "bg-tint/[0.12] font-semibold text-label" : "text-label-2"}>
                      {z.zellen.map((c, j) => (
                        <td key={j} className="px-3 py-1.5 tabular-nums first:pl-4 last:pr-4">{c}</td>
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
                  value={<span className="display text-[17px] font-bold tabular-nums text-label">{a.alt ?? "?"} → {a.neu ?? "?"}</span>}
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
