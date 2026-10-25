import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { Section, Unavailable } from "@/components/ui";
import { getDb } from "@/lib/db";
import { ladeChat } from "@/lib/db/chat";
import { datumZeit } from "@/lib/format";
import { chatVerfuegbar, MODELL } from "@/lib/chat/chat";
import { neuesGespraech } from "./actions";
import { ChatForm } from "./chat-form";
import { Antwort } from "./antwort";

export default async function Chat() {
  await connection();
  const { eintraege } = ladeChat(getDb());
  const bereit = chatVerfuegbar();
  return (
    <>
      <PageHeader title="Chat" subtitle={`Fragen an deine Daten · ${MODELL}`} />
      <div className="seite">
        <div className="lg:max-w-4xl">
          {!bereit ? (
            <Section>
              <Unavailable title="Chat mit Claude" reason="Auf dem Server ist kein ANTHROPIC_API_KEY gesetzt. Schlüssel in der Anthropic Console anlegen und beim Hosting als Umgebungsvariable eintragen." />
            </Section>
          ) : (
            <>
              <Section
                title="Gespräch"
                aktion={
                  eintraege.length > 0 ? (
                    <form action={neuesGespraech}>
                      <button className="pressable text-[13px] text-tint">Neues Gespräch</button>
                    </form>
                  ) : undefined
                }
              >
                {eintraege.length === 0 ? (
                  <p className="text-[15px] text-label-2">
                    Frag nach Kader, Ausfällen, Gegnern, Taktiken, Markt, Top 10, Saison oder Jugend. Claude holt die Antworten über Werkzeuge aus deiner Datenbank und sagt, wenn etwas fehlt.
                  </p>
                ) : (
                  <ol className="space-y-6">
                    {eintraege.map((e, i) => (
                      <li key={i} className="space-y-3">
                        <div className="ml-auto max-w-[85%] rounded-[12px] bg-tint px-4 py-3 text-[15px] text-[#fffdf8]">{e.frage}</div>
                        <div className="karte max-w-[92%] rounded-[12px] bg-card px-5 py-4">
                          <Antwort text={e.antwort} />
                          <div className="mt-3 border-t border-separator pt-2 text-[12px] text-label-3">
                            {datumZeit(e.zeit)}
                            {e.werkzeuge.length > 0 && ` · gelesen: ${[...new Set(e.werkzeuge)].join(", ")}`}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
              <div className="mt-6">
                <ChatForm />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
