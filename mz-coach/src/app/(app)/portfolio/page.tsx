// Taktik-Portfolio: bewährte Stile je Gegnerklasse aus dem Top-10-Wissen, mit Taktik-Code und bester Besetzung.

import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Spielfeld } from "@/components/spielfeld";
import { Badge, Card, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { spielDatum } from "@/lib/format";
import { de } from "@/lib/mz/analyse/gegner";
import { MIN_QUOTE, MIN_SPIELE, portfolioAnalyse, type StilEintrag } from "@/lib/portfolio";
import { KopierKnopf } from "@/components/kopier-knopf";
import { ladeKader } from "@/lib/db/kader";
import { letzterLauf, ligaspieltag } from "@/lib/db/spieltag";
import { erzeugeTaktik } from "@/lib/mz/taktik/erzeugen";
import { erzeugeMitWechseln } from "@/lib/mz/taktik/mit-wechseln";
import { pruefeTaktik } from "@/lib/mz/taktik/pruefer";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { archivLaden } from "@/lib/taktik-archiv";
import { heuteInBerlin } from "@/lib/format";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

type Umfeld = { kader: SpielerDaten[]; spieltag: Date; kapitaenPid?: number; vorlagen?: { reiter: string; xml: string }[] };

// Plätze des Topteams, besetzt mit deiner besten aufstellbaren Elf (Heatmap = Marktwert); ohne genug Spieler die Koordinaten
function besetzt(s: StilEintrag, u: Umfeld) {
  try {
    const e = erzeugeTaktik({ feld: s.beispiel.feld, torwart: s.beispiel.torwart, kader: u.kader, spieltag: u.spieltag });
    return e.elf.map((b) => ({ x: b.platz.x, y: b.platz.y, label: b.spieler.name.split(" ").at(-1)!, wert: b.spieler.marktwert, torwart: b.platz.torwart }));
  } catch {
    return [
      ...s.beispiel.feld.map((p) => ({ x: p.x, y: p.y, label: `${p.x}/${p.y}` })),
      ...(s.beispiel.torwart ? [{ ...s.beispiel.torwart, label: "TW", torwart: true }] : []),
    ];
  }
}

// Taktik-Code des Stils mit deiner besten Besetzung (lib/mz/taktik/erzeugen.ts), geprüft nach der Prüfliste
function TaktikCode({ s, u }: { s: StilEintrag; u: Umfeld }) {
  const m = s.schluessel.match(/^\S+ (\S+)\/(\S+)$/);
  let t: ReturnType<typeof erzeugeMitWechseln>;
  try {
    t = erzeugeMitWechseln({
      feld: s.beispiel.feld,
      torwart: s.beispiel.torwart,
      tactics: m?.[1],
      playstyle: m?.[2],
      aggression: s.haerte[0]?.[0],
      kader: u.kader,
      spieltag: u.spieltag,
      kapitaenPid: u.kapitaenPid,
    }, "neu", u.vorlagen);
  } catch (e) {
    return <p className="mt-3 text-[13px] text-red">Kein Code möglich: {e instanceof Error ? e.message : String(e)}</p>;
  }
  const pruefung = pruefeTaktik(parseTaktikXml(t.xml), u.kader);
  return (
    <details className="mt-4 rounded-[8px] border border-separator">
      <summary className="cursor-pointer px-4 py-3 text-[14px] font-bold text-tint">Taktik-Code mit deiner besten Besetzung (MZ-Wert Elf {t.summe.toFixed(2).replace(".", ",")})</summary>
      <div className="border-t border-separator p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-label-3">
                <th className="py-1 pr-3 font-semibold">Platz</th>
                <th className="py-1 pr-3 font-semibold">Rolle</th>
                <th className="py-1 pr-3 font-semibold">Spieler</th>
                <th className="py-1 text-right font-semibold">MZ-Wert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {t.elf.map((e) => (
                <tr key={e.spieler.pid}>
                  <td className="py-1 pr-3 tabular-nums">{e.platz.x}/{e.platz.y}</td>
                  <td className="py-1 pr-3">{e.rolle}</td>
                  <td className="py-1 pr-3 font-medium">
                    {e.spieler.name}
                    {t.kapitaen?.pid === e.spieler.pid && " (K)"}
                  </td>
                  <td className="py-1 text-right tabular-nums">{e.wert.toFixed(2).replace(".", ",")}</td>
                </tr>
              ))}
              {t.bank.map((b) => (
                <tr key={b.spieler.pid} className="text-label-2">
                  <td className="py-1 pr-3">Bank {b.art === "subgoalie" ? "TW" : b.rolle === "beste" ? "X" : b.rolle}</td>
                  <td className="py-1 pr-3">{b.rolle === "beste" ? "beste übrige" : b.rolle}</td>
                  <td className="py-1 pr-3">{b.spieler.name}</td>
                  <td className="py-1 text-right tabular-nums">{b.wert.toFixed(2).replace(".", ",")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {t.ausgeschlossen.length > 0 && (
          <p className="mt-3 text-[12.5px] text-label-2">Nicht aufgestellt: {t.ausgeschlossen.map((a) => `${a.name} (${a.grund})`).join("; ")}</p>
        )}
        {pruefung.fehler.length > 0 && (
          <p className="mt-2 text-[13px] text-red">Prüfliste verletzt: {pruefung.fehler.map((f) => `Regel ${f.regel}: ${f.text}`).join(" ")}</p>
        )}
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12.5px] text-label-2">
          {[...t.hinweise, ...pruefung.hinweise.map((h) => `Regel ${h.regel}: ${h.text}`)].map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
        <pre className="mt-3 max-h-72 overflow-auto rounded-[6px] bg-card-2 p-3 text-[11.5px] leading-snug">{t.xml}</pre>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <KopierKnopf text={t.xml} />
          <span className="text-[12.5px] text-label-3">Im Taktik-Editor von ManagerZone als XML einfügen, so wie du deine Taktiken exportierst.</span>
        </div>
      </div>
    </details>
  );
}

const stilDe = (s: string) => s.replace(/(\S+)\/(\S+)$/, (_, t, p) => `${de(t)}/${de(p)}`);
const prozent = (q: number) => `${Math.round(q * 100)} %`;
const haerteDe = (h: [string, number][]) => h.map(([a, n]) => `${de(a)} ${n}×`).join(", ");

function Vorschlag({ klasse, s, u }: { klasse?: string; s: StilEintrag; u: Umfeld }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          {klasse && <div className="kapitaelchen">gegen {klasse}</div>}
          <div className="display mt-1 text-[20px] font-semibold">{stilDe(s.schluessel)}</div>
          <div className="mt-1 text-[13px] text-label-2">
            {s.spiele} Spiele · {s.S} S, {s.U} U, {s.N} N ({prozent(s.quote)} Punktquote) · {s.teams.join(", ")} · Härte {haerteDe(s.haerte)}
          </div>
        </div>
        {s.imArchiv.length ? <Badge tone="green">hast du: {s.imArchiv.join(", ")}</Badge> : <Badge tone="orange">fehlt</Badge>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
        <Spielfeld spieler={besetzt(s, u)} />
        <div className="text-[13px] leading-relaxed">
          <div>
            Beispiel: <Link href={`/spiele/${s.beispiel.mid}`} className="text-tint hover:underline">{s.beispiel.team} {s.beispiel.tore} gegen {s.beispiel.gegner}</Link> ({spielDatum(s.beispiel.datum)}).
            Plätze = Startaufstellung des Topteams (aus der Stats-XML, ±1 Punkt), besetzt mit deiner besten Elf.
          </div>
          <div className="mt-2">
            Regel-Kurzcheck: {s.beispiel.check.stuermer} Stürmer, vorderster y {s.beispiel.check.minY}, kleinster Abstand {s.beispiel.check.minAbstand}
            {s.beispiel.check.verstoesse.length ? <span className="text-red"> · verletzt: {s.beispiel.check.verstoesse.join(", ")}</span> : <span className="text-green"> · Regeln 1 und 2 eingehalten</span>}
          </div>
          <div className="mt-2 text-label-2">
            Code unten in einen freien Reiter einfügen, speichern und unter „Taktik“ ins Archiv legen.
          </div>
        </div>
      </div>
      <TaktikCode s={s} u={u} />
    </Card>
  );
}

// Seite Taktik-Portfolio
export default async function Portfolio() {
  await connection();
  const db = getDb();
  const p = portfolioAnalyse(db);
  const lauf = letzterLauf(db, true);
  const u: Umfeld = {
    kader: ladeKader(db),
    spieltag: lauf?.anstoss ? new Date(new Date(lauf.anstoss).toLocaleString("en-US", { timeZone: "Europe/Berlin" })) : ligaspieltag(db),
    kapitaenPid: Number(archivLaden(db).find((a) => a.taktik?.team.captain)?.taktik?.team.captain) || undefined,
    vorlagen: archivLaden(db).map((a) => ({ reiter: a.reiter, xml: a.xml })),
  };
  return (
    <>
      <PageHeader title="Taktik-Portfolio" subtitle={`Was bei den Top 10 gegen welchen Gegnertyp gewinnt · ${p.spiele} Spiele · ${p.archiv.length} Reiter im Archiv`} />
      <div className="seite">
        {p.spiele === 0 ? (
          <Section title="Portfolio">
            <Unavailable title="Taktik-Portfolio" reason="Noch keine Spiele der Top 10 gespeichert. Der wöchentliche Abruf (Top 10) liefert sie, danach steht hier, welche Stile sich bewährt haben und welche dir fehlen." />
          </Section>
        ) : (
          <>
            <Section
              title="Fehlt in deinem Portfolio"
              footer={`Bewährt = mindestens ${MIN_SPIELE} Spiele und mindestens ${prozent(MIN_QUOTE)} Punktquote (Sieg 1, Remis 0,5) gegen diese Gegnerklasse. Stil = Formation, Taktik und Spielweise zu Spielbeginn. Abgleich mit deinem Taktik-Archiv.`}
            >
              {p.fehlend.length ? (
                <div className="space-y-5">
                  {p.fehlend.map((s) => (
                    <Vorschlag key={`${s.klasse}|${s.schluessel}`} klasse={s.klasse} s={s} u={u} />
                  ))}
                </div>
              ) : (
                <Card className="p-5 text-[14px] text-label-2">Jeder bewährte Stil der Top 10 ist in deinem Archiv vertreten, oder es gibt noch keinen bewährten Stil.</Card>
              )}
            </Section>

            {p.klassen.map((k) => (
              <Section key={k.klasse} title={`Gegen ${k.klasse}`} footer={`${k.spiele} Spiele der Top 10 gegen diese Gegnerklasse.`}>
                <Card>
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="border-b border-separator bg-card-2 text-left text-[11px] uppercase tracking-wider text-label-3">
                        <th className="py-2.5 pl-5 font-medium">Stil</th>
                        <th className="py-2.5 text-right font-medium">Spiele</th>
                        <th className="py-2.5 text-right font-medium">S / U / N</th>
                        <th className="py-2.5 text-right font-medium">Quote</th>
                        <th className="py-2.5 pl-4 font-medium">Teams</th>
                        <th className="py-2.5 pr-5 font-medium">Dein Archiv</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-separator">
                      {k.stile.map((s) => (
                        <tr key={s.schluessel} className="zeile-hover">
                          <td className="py-2.5 pl-5">
                            {stilDe(s.schluessel)} {s.bewaehrt && <Badge tone="tint">bewährt</Badge>}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{s.spiele}</td>
                          <td className="py-2.5 text-right tabular-nums">{s.S} / {s.U} / {s.N}</td>
                          <td className="py-2.5 text-right tabular-nums">{prozent(s.quote)}</td>
                          <td className="py-2.5 pl-4 text-label-2">{s.teams.join(", ")}</td>
                          <td className="py-2.5 pr-5">{s.imArchiv.length ? s.imArchiv.join(", ") : <span className="text-label-3">fehlt</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                {k.stile
                  .filter((s) => s.bewaehrt && s.imArchiv.length > 0)
                  .slice(0, 2)
                  .map((s) => (
                    <div key={s.schluessel} className="mt-4">
                      <Vorschlag klasse={k.klasse} s={s} u={u} />
                    </div>
                  ))}
              </Section>
            ))}

            {p.ungenutzt.length > 0 && (
              <Section title="Deine Reiter ohne Beleg bei den Top 10" footer="Diese Stile kommen in den gespeicherten Spielen der Top 10 nicht vor. Das heißt nicht, dass sie schlecht sind, nur dass es keinen Vergleich gibt.">
                <p className="text-[14px]">{p.ungenutzt.map((u) => `${u.reiter} (${stilDe(u.schluessel)})`).join(" · ")}</p>
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}
