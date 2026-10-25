"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { ladeChat, loescheChat, speichereChat } from "@/lib/db/chat";

export type ChatState = { fehler?: string };

export async function frageSenden(_prev: ChatState, formData: FormData): Promise<ChatState> {
  const frage = String(formData.get("frage") ?? "").trim();
  if (!frage) return {};
  const { chatFrage, chatVerfuegbar } = await import("@/lib/chat/chat");
  if (!chatVerfuegbar()) return { fehler: "ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt." };
  const db = getDb();
  const stand = ladeChat(db);
  try {
    const r = await chatFrage(db, stand.verlauf as Parameters<typeof chatFrage>[1], frage);
    speichereChat(db, {
      verlauf: r.verlauf,
      eintraege: [...stand.eintraege, { frage, antwort: r.antwort.text, werkzeuge: r.antwort.werkzeuge, zeit: new Date().toISOString(), verweigert: r.antwort.verweigert }],
    });
  } catch (e) {
    // Verlauf bleibt unverändert; Meldung ohne Schlüssel oder Anfrageinhalt
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    if (e instanceof Anthropic.RateLimitError) return { fehler: "Zu viele Anfragen, bitte kurz warten." };
    if (e instanceof Anthropic.AuthenticationError) return { fehler: "Der API-Schlüssel wurde abgelehnt." };
    if (e instanceof Anthropic.APIError) return { fehler: `Claude-API: ${e.status ?? ""} ${e.message}`.trim() };
    return { fehler: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/chat");
  return {};
}

export async function neuesGespraech() {
  loescheChat(getDb());
  revalidatePath("/chat");
}
