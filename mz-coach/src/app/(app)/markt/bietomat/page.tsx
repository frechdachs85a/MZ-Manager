// Reiter Gebote des Transfermarkts (Bietomat-Seite): neuer Auftrag, Regeln des automatischen Bietens, Aufträge mit Gebotskarte und Spielerprofil, Protokoll.

import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, List, Row, Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeAuftraege, ladeProtokoll } from "@/lib/db/gebot";
import { ladeMarktRahmen } from "@/lib/db/markt";
import { datumZeit, euro } from "@/lib/format";
import { auktionsErgebnis } from "@/lib/auktionsbericht";
import { auftragLoeschen } from "./actions";
import { Bietomat, GebotKarte } from "./formulare";
import { ladeVerkaeufe } from "@/lib/db/verkauf";
import { MarktReiter } from "@/components/markt-reiter";
import { vorschlagAnzahl, watchlistAktuell } from "@/lib/watchlist";
import { marktErgebnis, verbesserungFuer } from "@/lib/markt-ergebnis";
import { SpielerKarte } from "@/components/vorschlag-karte";

// Seite Bietomat
export default async function BietomatSeite() {
  await connection();
  const db = getDb();
  const alleAuftraege = ladeAuftraege(db);
  // Aktive Gebote oben; beendete Auktionen in einem eigenen Unterpunkt mit Auswertung (Marcus, 31.10.2026)
  const auftraege = alleAuftraege.filter((a) => a.status === "aktiv");
  const beendet = alleAuftraege
    .filter((a) => a.status !== "aktiv")
    .sort((a, b) => (b.auktionEnde ?? b.geaendert).localeCompare(a.auktionEnde ?? a.geaendert));
  const log = ladeProtokoll(db, undefined, 30);
  const saldo = ladeMarktRahmen(db)?.werte.kapital;
  const verkaeufe = ladeVerkaeufe(db);
  const namen = new Map(alleAuftraege.map((a) => [a.pid, a.name ?? String(a.pid)]));
  const watch = watchlistAktuell(db).liste;
  const watchAnzahl = watch.length;
  const vorschlaege = vorschlagAnzahl(db, marktErgebnis(db).ergebnis?.alle ?? []);
  return (
    <>
      <PageHeader
        title="Transfermarkt"
        subtitle={`Gebote · ${auftraege.filter((a) => a.status === "aktiv").length} aktiv · Bietomat bietet bis höchstens zum Endpreis`}
      />
      <MarktReiter
        aktiv="/markt/bietomat"
        anzahl={{ "/markt": vorschlaege, "/markt/watchlist": watchAnzahl, "/markt/bietomat": auftraege.filter((a) => a.status === "aktiv").length }}
      />
      <div className="seite">
        {/* Deine Gebote als Spielerkarten wie in Vorschläge und Watchlist, dazu dein Gebot (Marcus, 31.10.2026) */}
        <Section title="Deine Gebote" footer="Der Bietomat bietet kurz vor Schluss Stufe für Stufe bis höchstens zum Endpreis, auch bei Verlängerung.">
          {auftraege.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {auftraege.map((a) =>
                a.spieler ? (
                  <SpielerKarte
                    key={a.pid}
                    k={a.spieler}
                    v={verbesserungFuer(db, a.spieler)}
                    verkauf={verkaeufe.get(a.pid)}
                    ende={a.auktionEnde}
                    badge={a.status}
                    hinweise={a.auktionEnde ? [] : ["Auktionsende unbekannt: Spieler neu laden und Auftrag erneut speichern, sonst wird nicht geboten."]}
                    zusatz={
                      <GebotKarte
                        pid={a.pid}
                        maximum={a.maximum}
                        auktionEnde={a.auktionEnde}
                        eigenesGebot={ladeProtokoll(db, a.pid, 50).find((l) => l.text.startsWith("Geboten:"))?.betrag ?? undefined}
                      />
                    }
                    fuss={
                      <form action={auftragLoeschen} className="grid grid-cols-2 gap-2">
                        <input type="hidden" name="pid" value={a.pid} />
                        <button
                          type="submit"
                          name="danach"
                          value="watchlist"
                          className="pressable min-h-[40px] rounded-[10px] border border-tint/40 text-[13.5px] font-semibold text-tint"
                        >
                          Zurück auf Watchlist
                        </button>
                        <button
                          type="submit"
                          name="danach"
                          value="weg"
                          className="pressable min-h-[40px] rounded-[10px] border border-red/40 text-[13.5px] font-semibold text-red"
                        >
                          Verwerfen
                        </button>
                      </form>
                    }
                  />
                ) : (
                  <Card key={a.pid} className="p-4 text-[14px]">
                    {a.name ?? a.pid}: keine Spielerdaten gespeichert.
                  </Card>
                ),
              )}
            </div>
          ) : (
            <Unavailable
              title="Gebote"
              reason="Noch kein Gebot. Spieler auf der Watchlist mit einem Endpreis in den Bietomat geben oder unten per Nummer laden."
            />
          )}
        </Section>
      </div>
      <div className="seite">
        <div id="beendet" className="scroll-mt-20">
          <Section
            title={`Beendete Auktionen${beendet.length ? ` · ${beendet.length}` : ""}`}
            footer="Endpreis, Mannschaft und Arbeitsbewilligung aus der Gebotsübersicht von ManagerZone (direkt nach Auktionsende gelesen); fehlt sie, das, was der Bietomat am Ende gesehen hat."
          >
            {beendet.length ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {beendet.map((a) => {
                  const e = auktionsErgebnis(db, a);
                  const kopf =
                    e.art === "bekommen"
                      ? { cls: "bg-green/12 text-green", text: `✅ Bekommen${e.preis !== undefined ? ` für ${euro(e.preis)}` : ""}` }
                      : e.art === "nicht-bekommen"
                        ? { cls: "bg-red/12 text-red", text: `❌ Nicht bekommen${e.kaeufer ? ` (an ${e.kaeufer}${e.preis !== undefined ? ` für ${euro(e.preis)}` : ""})` : ""}` }
                        : { cls: "bg-orange/12 text-orange", text: `⚠️ Beendet (${a.status})` };
                  const info = (
                    <div className="space-y-1 text-[13px]">
                      <div className={`rounded-[10px] px-3 py-2 text-[15px] font-bold ${kopf.cls}`}>{kopf.text}</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-label-2">
                        {e.preis !== undefined && (
                          <>
                            <span>Endpreis</span>
                            <span className="text-right font-semibold tabular-nums text-label">{euro(e.preis)}</span>
                          </>
                        )}
                        {e.kaeufer && (
                          <>
                            <span>Geht an</span>
                            <span className="text-right text-label">{e.kaeufer}</span>
                          </>
                        )}
                        {e.arbeitsbewilligung !== undefined && (
                          <>
                            <span>Arbeitsbewilligung</span>
                            <span className="text-right tabular-nums text-label">{euro(e.arbeitsbewilligung)}</span>
                          </>
                        )}
                        <span>Auktionsende</span>
                        <span className="text-right tabular-nums text-label">{a.auktionEnde ? datumZeit(a.auktionEnde) : "unbekannt"}</span>
                        <span>Deine Gebote</span>
                        <span className="text-right tabular-nums text-label">{e.gebote}</span>
                        <span>Dein höchstes Gebot</span>
                        <span className="text-right tabular-nums text-label">{e.hoechstes !== undefined ? euro(e.hoechstes) : "–"}</span>
                        <span>Dein Maximum</span>
                        <span className="text-right tabular-nums text-label">{euro(e.maximum)}</span>
                      </div>
                      <p className="text-[12px] text-label-3">
                        {e.quelle === "gebotsuebersicht" && a.ende ? `Endstand laut Gebotsübersicht von ManagerZone, gelesen ${datumZeit(a.ende.stand)}. ` : ""}
                        {e.grund}
                      </p>
                    </div>
                  );
                  return a.spieler ? (
                    <SpielerKarte
                      key={a.pid}
                      k={a.spieler}
                      v={verbesserungFuer(db, a.spieler)}
                      verkauf={verkaeufe.get(a.pid)}
                      ende={a.auktionEnde}
                      zusatz={info}
                      fuss={
                        <form action={auftragLoeschen}>
                          <input type="hidden" name="pid" value={a.pid} />
                          <button
                            type="submit"
                            name="danach"
                            value="weg"
                            className="pressable min-h-[40px] w-full rounded-[10px] border border-separator text-[13.5px] font-semibold text-label-2"
                          >
                            Aus der Liste entfernen
                          </button>
                        </form>
                      }
                    />
                  ) : (
                    <Card key={a.pid} className="p-4">
                      <div className="mb-2 text-[16px] font-bold">{a.name ?? a.pid}</div>
                      {info}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Unavailable title="Beendete Auktionen" reason="Noch keine Auktion des Bietomats beendet." />
            )}
          </Section>
        </div>
      </div>
      <div className="seite flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-8">
        <div className="order-2 lg:order-2">
          <Section
            title="Neuer Auftrag"
            footer="Spielernummer oder Name eintippen: Suche über das Feld Name/ID von ManagerZone, sonst mit den Standardfiltern der Marktseite. Mehrere Treffer: aus der Liste wählen."
          >
            <Bietomat saldo={saldo} />
          </Section>
          <Section title="Automatisches Bieten">
            <List>
              <Row
                title={<Badge tone="green">aktiv</Badge>}
                detail="Ab 3 Minuten vor Ende: nur wenn ein anderer vorne liegt, immer nur die kleinste zulässige Stufe (Vorschlag von ManagerZone), nie über deinem Endpreis (in Euro umgerechnet, aufgerundet). Verlängerungen werden verfolgt, bis die Auktion vorbei ist."
              />
              <Row title="Vorrang" detail="45 Minuten vor bis 60 Minuten nach einem Auktionsende starten keine anderen Abrufe." />
            </List>
          </Section>
        </div>
        <div className="order-1 lg:order-1">
          <Section title="Protokoll">
            {log.length ? (
              <List>
                {log.map((l, i) => (
                  <Row key={i} title={l.text} detail={`${namen.get(l.pid) ?? l.pid} · ${datumZeit(l.zeit)}`} />
                ))}
              </List>
            ) : (
              <Unavailable title="Protokoll" reason="Noch keine Einträge." />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
