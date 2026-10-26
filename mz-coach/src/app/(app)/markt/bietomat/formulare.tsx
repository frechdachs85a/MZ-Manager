"use client";

import { useActionState } from "react";
import { SpielerProfil } from "@/components/spieler-profil";
import { auftragSpeichern, spielerLadenAktion, type AuftragState, type LadeState } from "./actions";

const KNOPF = "pressable min-h-[46px] w-full knopf text-[16px] font-bold disabled:opacity-50";
const zahl = (n?: number) => (n === undefined ? "–" : `${new Intl.NumberFormat("de-DE").format(n)} EUR`);
// ISO (UTC) -> Wert für datetime-local in Berliner Zeit
const alsLokal = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Berlin",
        dateStyle: "short",
        timeStyle: "short",
      })
        .format(new Date(iso))
        .replace(" ", "T")
    : "";

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-3 border-b border-separator px-4 last:border-b-0">
      <span className="w-36 shrink-0 text-[14.5px]">{label}</span>
      {children}
    </label>
  );
}
const EINGABE = "min-w-0 flex-1 bg-transparent py-3 text-right text-[16px] tabular-nums outline-none placeholder:text-label-3";

export function Bietomat({ saldo }: { saldo?: number }) {
  const [geladen, laden, laedt] = useActionState<LadeState, FormData>(spielerLadenAktion, {});
  const [auftrag, speichern, speichert] = useActionState<AuftragState, FormData>(auftragSpeichern, {});
  const s = geladen.spieler;
  return (
    <div className="space-y-4">
      <form action={laden}>
        <div className="karte overflow-hidden rounded-[10px] bg-card">
          <Feld label="Nummer oder Name">
            <input name="suche" required placeholder="z. B. 234751241 oder Arhenius" className={EINGABE} />
          </Feld>
        </div>
        <button type="submit" disabled={laedt} className={`${KNOPF} mt-3`}>
          {laedt ? "Lädt vom Transfermarkt (bis ca. 1 Minute) …" : "Spieler laden"}
        </button>
        {geladen.meldung && (
          <p role="status" className={`mt-2 px-1 text-[13px] ${geladen.auswahl ? "text-label-2" : "text-red"}`}>
            {geladen.meldung}
          </p>
        )}
      </form>
      {geladen.auswahl && (
        <div className="karte overflow-hidden rounded-[10px] bg-card">
          {geladen.auswahl.map((x) => (
            <form key={x.pid} action={laden} className="border-b border-separator last:border-b-0">
              <input type="hidden" name="gewaehlt" value={JSON.stringify(x)} />
              <button type="submit" className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left">
                <span>
                  <span className="text-[14.5px] font-semibold">{x.name}</span>
                  <span className="block text-[12px] text-label-2">
                    {x.pid} · {x.alter ?? "?"} Jahre · Wert {zahl(x.wert)} · Ende {x.markt.ende ?? "?"}
                  </span>
                  <span className="mt-1 block">
                    <SpielerProfil skills={x.skills} />
                  </span>
                </span>
                <span className="text-[13px] font-semibold text-tint">Wählen</span>
              </button>
            </form>
          ))}
        </div>
      )}

      {s && (
        <form action={speichern} key={s.pid}>
          <input type="hidden" name="pid" value={s.pid} />
          <input type="hidden" name="spieler" value={JSON.stringify(s)} />
          <input type="hidden" name="ende" value={geladen.endeUtc ?? ""} />
          <div className="karte overflow-hidden rounded-[10px] bg-card">
            <div className="border-b border-separator px-4 py-3">
              <div className="text-[16px] font-bold">{s.name}</div>
              <div className="mt-0.5 text-[12.5px] text-label-2">
                {s.pid} · {s.alter ?? "?"} Jahre
                {s.nationalitaet ? ` · ${s.nationalitaet}` : ""} · Wert {zahl(s.wert)}
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-[12.5px]">
                <span>
                  Gefordert
                  <br />
                  <b>{zahl(s.markt.gefordert)}</b>
                </span>
                <span>
                  Höchstgebot
                  <br />
                  <b>{zahl(s.markt.hoechstgebot)}</b>
                </span>
                <span>
                  Ende
                  <br />
                  <b>{s.markt.ende ?? "–"}</b>
                </span>
              </div>
              <div className="mt-3">
                <SpielerProfil skills={s.skills} />
              </div>
            </div>
            <Feld label="Maximalgebot (EUR)">
              <input name="maximum" id="maximum" inputMode="numeric" required placeholder="dein Höchstbetrag" className={EINGABE} />
              {saldo !== undefined && (
                <button
                  type="button"
                  className="shrink-0 rounded-md bg-fill px-2 py-1 text-[12px] font-semibold"
                  onClick={() => {
                    const el = document.getElementById("maximum") as HTMLInputElement | null;
                    if (el) el.value = String(saldo);
                  }}
                >
                  Max = Saldo
                </button>
              )}
            </Feld>
            <Feld label="Bieten bis">
              <input name="bis" type="datetime-local" defaultValue={alsLokal(geladen.endeUtc)} className={EINGABE} />
            </Feld>
          </div>
          <button type="submit" disabled={speichert} className={`${KNOPF} mt-3`}>
            {speichert ? "Speichern …" : "Auftrag speichern"}
          </button>
          {auftrag.meldung && (
            <p role="status" className={`mt-2 px-1 text-[13px] ${auftrag.ok ? "text-green" : "text-red"}`}>
              {auftrag.meldung}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
