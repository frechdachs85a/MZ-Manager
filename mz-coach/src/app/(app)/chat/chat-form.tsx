"use client";

import { useActionState, useRef } from "react";
import { frageSenden, type ChatState } from "./actions";

const BEISPIELE = [
  "Wer fällt am nächsten Ligaspieltag aus und wer ersetzt ihn?",
  "Welche Taktik empfiehlst du gegen den zuletzt analysierten Gegner und warum?",
  "Wo ist meine größte Schwachstelle in der Startelf?",
  "Welche Jugendspieler sollte ich am Dienstag zuerst ersetzen?",
];

export function ChatForm() {
  const [state, action, pending] = useActionState<ChatState, FormData>(frageSenden, {});
  const form = useRef<HTMLFormElement>(null);
  const feld = useRef<HTMLTextAreaElement>(null);
  return (
    <form ref={form} action={action} className="space-y-3">
      <div className="karte rounded-[12px] bg-card p-2">
        <textarea
          ref={feld}
          name="frage"
          rows={3}
          disabled={pending}
          placeholder="Frag den MZ Coach … (Enter sendet, Umschalt+Enter neue Zeile)"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              form.current?.requestSubmit();
            }
          }}
          className="block w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-label-3"
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-1">
          <span className="text-[12px] text-label-3">{pending ? "Claude liest deine Daten …" : "Antworten nur aus deinen gespeicherten Daten"}</span>
          <button disabled={pending} className="pressable knopf min-h-10 px-5 text-[14px] font-medium disabled:opacity-50">
            {pending ? "…" : "Senden"}
          </button>
        </div>
      </div>
      {state.fehler && <p role="alert" className="text-[13px] text-red">{state.fehler}</p>}
      <div className="flex flex-wrap gap-2">
        {BEISPIELE.map((b) => (
          <button
            key={b}
            type="button"
            disabled={pending}
            onClick={() => {
              if (feld.current) feld.current.value = b;
              form.current?.requestSubmit();
            }}
            className="pressable rounded-full border border-separator bg-card px-3 py-1.5 text-[13px] text-label-2 hover:text-label"
          >
            {b}
          </button>
        ))}
      </div>
    </form>
  );
}
