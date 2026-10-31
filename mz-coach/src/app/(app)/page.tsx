// Zentrale (Startseite): alles Wichtige kurz gebündelt (Marcus, 30.10.2026): Warnungen, nächstes Spiel in einer
// Zeile (Details im Reiter Spieltag), Verfügbarkeit, Aufgaben, Ball-Bilanz, Tabelle.

import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Card, Kachel, List, Row, Section, Unavailable } from "@/components/ui";
import { startelfAusLetztemSpiel } from "@/lib/db/markt";
import { spieltagLage } from "@/lib/spieltag";
import { WertDiff } from "@/components/elf-wert";
import { skillBilanz, AUSDAUER_GRENZE } from "@/lib/skill-bilanz";
import { spieltagCheckliste } from "@/lib/checkliste";
import { ladeRohseite, letzteRohseite } from "@/lib/db/abruf";
import { tabelleAus } from "@/lib/mz/parser/tabelle";
import { schwachstellen } from "@/lib/mz/analyse/markt";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { einsatzImLigaspiel } from "@/lib/mz/einsatz";
import { StatusBadges } from "@/components/status";
import { datumZeit, heuteInBerlin } from "@/lib/format";
import { naechsterLigaspieltag, TEAM } from "@/lib/wissen/startbasis";

// Seite Zentrale
export default async function Uebersicht() {
  await connection(); // Datum pro Anfrage, nicht beim Build
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const db = getDb();
  const { bilanz, warnungen: verlust } = skillBilanz(db, 14);
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
  // Warnungen: Ausdauer unter die Grenze gefallen, und Startspieler mit Ausdauer unter der Grenze (halten keine 90 Minuten)
  const nachPid = new Map(kader.map((s) => [s.pid, s]));
  const schwacheAusdauer = (start?.elf ?? [])
    .map((p) => nachPid.get(p.pid))
    .filter((s): s is NonNullable<typeof s> => !!s && (s.skills.ausdauer?.wert ?? 10) < AUSDAUER_GRENZE && !verlust.some((v) => v.pid === s.pid));
  const warnungen = [
    ...verlust.map((v) => ({ name: v.name, text: v.text })),
    ...schwacheAusdauer.map((s) => ({ name: s.name, text: `Startspieler mit Ausdauer ${s.skills.ausdauer?.wert}: hält keine 90 Minuten durch, Wechsel einplanen` })),
  ];
  const anstoss = st.lauf?.anstoss ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(st.lauf.anstoss)) : null;

  return (
    <>
      <PageHeader title="Zentrale" subtitle={`${TEAM.name} · ${TEAM.liga}`} />

      {warnungen.length > 0 && (
        <div className="seite mt-6">
          <Card className="border-l-4 border-l-red p-4">
            <div className="text-[13px] font-bold uppercase tracking-wider text-red">Achtung</div>
            <ul className="mt-1.5 space-y-1 text-[14px]">
              {warnungen.map((w) => (
                <li key={w.name + w.text}>
                  <b>{w.name}</b>: {w.text}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Nächstes Spiel kurz; Taktik und Analyse im Reiter Spieltag */}
      <div className="seite mt-6">
        <Link href="/spieltag" className="zeile-hover block">
          <Card className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-label-3">Nächstes Ligaspiel{anstoss ? ` · ${anstoss}` : ""}</div>
                <div className="text-[18px] font-bold">
                  {st.lauf?.gegnerName ? `${st.lauf.heim ? "gegen" : "bei"} ${st.lauf.gegnerName}` : "Spielplan noch nicht abgerufen"}
                </div>
              </div>
              <span className="text-[12.5px] font-semibold uppercase tracking-wider text-tint">Taktik und Analyse →</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px]">
              {st.vorschlag && (
                <span>
                  <span className="text-label-3">Vorschlag </span>
                  <b>{st.vorschlag.taktik}</b>
                </span>
              )}
              {st.teamwert && (
                <WertDiff eigen={st.teamwert.eigen} gegner={st.teamwert.gegner} klein />
              )}
              {st.liga && (
                <span className={st.ligaStatus?.ok ? "text-green" : "text-label-2"}>
                  Formation Liga {st.ligaStatus?.ok ? "✓ in ManagerZone" : st.ligaStatus ? "✗ nicht gespeichert" : "noch nicht gespeichert"}
                </span>
              )}
            </div>
          </Card>
        </Link>
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

        <Section title="Bälle der letzten 14 Tage" footer="Aus den Kaderabrufen: gewonnene und verlorene Skill-Bälle je Spieler (ohne Form). Rot = Verlust.">
          {bilanz.length ? (
            <List>
              {bilanz.map((b) => (
                <Row
                  key={b.pid}
                  title={b.name}
                  detail={b.aenderungen.map((a) => `${a.skill} ${a.alt}→${a.neu}`).join(" · ")}
                  value={
                    <span className="display text-[16px] font-bold tabular-nums">
                      {b.plus > 0 && <span className="text-green">+{b.plus}</span>}
                      {b.plus > 0 && b.minus > 0 && " "}
                      {b.minus > 0 && <span className="text-red">−{b.minus}</span>}
                    </span>
                  }
                />
              ))}
            </List>
          ) : (
            <Unavailable title="Bälle" reason="In den letzten 14 Tagen keine Skill-Änderung in den Kaderabrufen." />
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

      </div>
    </>
  );
}
