"use client";

// Ein Eintrag des Taktik-Checks auf der Zentrale: Änderungen kurz, XML zum Herunterladen, Knopf zum Übernehmen in
// ManagerZone (erst auf Klick, mit Rückfrage).

import { useActionState } from "react";
import { DateiKnopf } from "@/components/datei-knopf";
import {
  freundVorschlagUebernehmen,
  portfolioVorschlagUebernehmen,
  reiterFreiUmbenennen,
  reiterLoeschenAktion,
  reiterUmbenennenAktion,
  vorschlagUebernehmen,
  type UebernahmeState,
} from "@/app/(app)/taktik-check-actions";

// art portfolio: Reiter wird mit einem neuen Stil überschrieben (anderer Knopf-Text, andere Aktion)
// art freund-bank / freund-stil: Vorschläge für den Reiter freund (wichtigste auf die Bank, anderer Stil)
export function TaktikCheckKarte({
  reiter,
  punkte,
  gewinn,
  xml,
  art = "check",
  neuerName,
  titel,
}: {
  reiter: string;
  punkte: string[];
  gewinn: number;
  xml: string;
  art?: "check" | "portfolio" | "freund-bank" | "freund-stil";
  neuerName?: string;
  titel?: string;
}) {
  const [state, action, pending] = useActionState<UebernahmeState, FormData>(
    art === "portfolio" ? portfolioVorschlagUebernehmen : art.startsWith("freund") ? freundVorschlagUebernehmen : vorschlagUebernehmen,
    {},
  );
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold">{titel ?? reiter}</span>
        {art === "check" && gewinn !== 0 && (
          <span className={`text-[12.5px] font-semibold ${gewinn > 0 ? "text-green" : "text-red"}`}>
            {gewinn > 0 ? "+" : ""}
            {gewinn.toFixed(2).replace(".", ",")} MZ-Wert in der Elf
          </span>
        )}
      </div>
      <ul className="mt-1 space-y-0.5 text-[13px] text-label-2">
        {punkte.map((p) => (
          <li key={p}>• {p}</li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DateiKnopf text={xml} dateiname={`${reiter}-angepasst.xml`.replace(/[^\w.-]+/g, "_")} label="XML" />
        <form
          action={action}
          onSubmit={(e) => {
            if (
              !confirm(
                art === "portfolio"
                  ? `Reiter „${reiter}“ in ManagerZone mit dem neuen Stil überschreiben${neuerName && neuerName !== reiter ? ` und in „${neuerName}“ umbenennen` : ""}? Die bisherige Taktik in diesem Reiter geht verloren.`
                  : `Vorschlag für „${reiter}“ in ManagerZone in den gleichnamigen Reiter schreiben?`,
              )
            )
              e.preventDefault();
          }}
        >
          <input type="hidden" name="reiter" value={reiter} />
          {art.startsWith("freund") && <input type="hidden" name="was" value={art === "freund-stil" ? "stil" : "bank"} />}
          <button
            type="submit"
            disabled={pending}
            className="pressable rounded-md bg-tint px-3 py-1.5 text-[13px] font-semibold text-auf-akzent disabled:opacity-50"
          >
            {pending
              ? "Wird übernommen …"
              : art === "portfolio"
                ? `${reiter} überschreiben${neuerName && neuerName !== reiter ? ` → ${neuerName}` : ""}`
                : "In ManagerZone übernehmen"}
          </button>
        </form>
      </div>
      {state.meldung && <p className={`mt-1 text-[12.5px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
    </div>
  );
}

// Nur den Namen eines Reiters ändern (Name passt nicht zum Inhalt), erst auf Klick mit Rückfrage
export function ReiterNameKnopf({ reiter, name }: { reiter: string; name: string }) {
  const [state, action, pending] = useActionState<UebernahmeState, FormData>(reiterUmbenennenAktion, {});
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`Reiter „${reiter}“ in ManagerZone in „${name}“ umbenennen? Der Inhalt bleibt gleich.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="reiter" value={reiter} />
        <button
          type="submit"
          disabled={pending}
          className="pressable rounded-md bg-tint px-2.5 py-1 text-[12.5px] font-semibold text-auf-akzent disabled:opacity-50"
        >
          {pending ? "Wird umbenannt …" : `In „${name}“ umbenennen`}
        </button>
      </form>
      {state.meldung && <span className={`text-[12.5px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</span>}
    </span>
  );
}

// Reiter umbenennen mit eigenem Namen (höchstens 6 Zeichen, Grenze des Editors), vorbelegt mit dem Vorschlag
export function ReiterNameForm({ reiter, vorschlag }: { reiter: string; vorschlag?: string }) {
  const [state, action, pending] = useActionState<UebernahmeState, FormData>(reiterFreiUmbenennen, {});
  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        const neu = String(new FormData(e.currentTarget).get("name") ?? "");
        if (!confirm(`Reiter „${reiter}“ in ManagerZone in „${neu}“ umbenennen? Der Inhalt bleibt gleich.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="reiter" value={reiter} />
      <input
        name="name"
        defaultValue={vorschlag ?? reiter}
        maxLength={6}
        required
        className="w-24 rounded-md border border-separator bg-white px-2 py-1 text-[13px]"
        aria-label={`Neuer Name für ${reiter}`}
      />
      <button
        type="submit"
        disabled={pending}
        className="pressable rounded-md border border-separator px-2.5 py-1 text-[12.5px] font-semibold disabled:opacity-50"
      >
        {pending ? "Wird umbenannt …" : "Umbenennen"}
      </button>
      {vorschlag && <span className="text-[12px] text-label-3">Vorschlag: {vorschlag}</span>}
      {state.meldung && <span className={`text-[12.5px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</span>}
    </form>
  );
}

// Reiter löschen: im Editor „Alles zurücksetzen“, speichern, Namen entfernen (erst auf Klick, mit Rückfrage)
export function ReiterLoeschenKnopf({ reiter }: { reiter: string }) {
  const [state, action, pending] = useActionState<UebernahmeState, FormData>(reiterLoeschenAktion, {});
  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        if (
          !confirm(
            `Reiter „${reiter}“ in ManagerZone löschen? Aufstellung und Regeln werden zurückgesetzt, der Name entfernt. Die XML bleibt hier als Sicherung.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="reiter" value={reiter} />
      <button
        type="submit"
        disabled={pending}
        className="pressable rounded-md border border-red/40 px-2.5 py-1 text-[12.5px] font-semibold text-red disabled:opacity-50"
      >
        {pending ? "Wird gelöscht …" : "Löschen"}
      </button>
      {state.meldung && <span className={`text-[12.5px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</span>}
    </form>
  );
}
