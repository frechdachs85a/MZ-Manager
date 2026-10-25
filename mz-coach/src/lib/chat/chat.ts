import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type Database from "better-sqlite3";
import { TEAM } from "@/lib/wissen/startbasis";
import { WERKZEUG_DEFS, werkzeugAusfuehren } from "./werkzeuge";

// Chat mit Claude über die eigenen Daten. Der Verlauf wird vollständig (inklusive der Inhaltsblöcke
// der Antworten) gespeichert und unverändert wieder mitgeschickt.
export const MODELL = "claude-opus-5-5";
const MAX_RUNDEN = 12;

const SYSTEM = `Du bist der Assistent von Marcus für sein ManagerZone-Team ${TEAM.name} (tid ${TEAM.tid}, ${TEAM.liga}). Antworte auf Deutsch, kurz und konkret.

Grundregel von Marcus: nur absolut richtige Inhalte, nichts erfinden oder zusammenreimen. Deshalb:
- Hole Fakten immer über die Werkzeuge (Kader, Spieler, Spiele, Gegner, Taktiken, Markt, Top 10, Saison, Jugend, Wissen). Rate nie Werte, Namen, Ergebnisse oder Regeln.
- Fehlt etwas in den Daten, sag genau das ("nicht verfügbar") und warum, statt es zu schätzen.
- Trenne klar zwischen dem, was in den Daten steht, und deiner Einschätzung. Kennzeichne Einschätzungen als solche.
- Nenne bei Zahlen die Quelle (z. B. "laut Kaderabruf vom …", "aus 7 Ligaspielen").
- Die Regeln und Faustregeln von Marcus stehen in der Wissensbasis (Werkzeug wissen); halte dich daran.
- Für Taktikvorschläge: Gegneranalyse (gegner) plus was bei den Top 10 gegen diesen Gegnertyp gewinnt (portfolio, top10), abgeglichen mit seinen Reitern (taktiken). Schlage neue Taktiken nur mit einem belegten Beispiel aus den Daten vor.

Du kannst nichts auf ManagerZone ausführen, nichts kaufen, bieten oder Taktiken ändern. Du gibst Auskunft und Empfehlungen.`;

export type ChatVerlauf = Anthropic.Beta.Messages.BetaMessageParam[];
export type ChatAntwort = { text: string; werkzeuge: string[]; verweigert?: boolean };

export function chatVerfuegbar(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function chatFrage(db: Database.Database, verlauf: ChatVerlauf, frage: string): Promise<{ verlauf: ChatVerlauf; antwort: ChatAntwort }> {
  const client = new Anthropic();
  const messages: ChatVerlauf = [...verlauf, { role: "user", content: frage }];
  const benutzt: string[] = [];

  for (let runde = 0; runde < MAX_RUNDEN; runde++) {
    const r = await client.beta.messages.create({
      model: MODELL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // Bei einer Ablehnung durch die Sicherheitsfilter beantwortet ein anderes Modell dieselbe Anfrage
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: WERKZEUG_DEFS,
      messages,
    });
    messages.push({ role: "assistant", content: r.content });

    if (r.stop_reason === "refusal") {
      return { verlauf: messages, antwort: { text: "Diese Anfrage wurde abgelehnt. Bitte anders formulieren.", werkzeuge: benutzt, verweigert: true } };
    }
    if (r.stop_reason === "pause_turn") continue;
    if (r.stop_reason !== "tool_use") {
      const text = r.content
        .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n\n");
      const hinweis = r.stop_reason === "max_tokens" ? "\n\n(Antwort wurde an der Längengrenze abgeschnitten.)" : "";
      return { verlauf: messages, antwort: { text: text + hinweis, werkzeuge: benutzt } };
    }

    const ergebnisse: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
    for (const b of r.content) {
      if (b.type !== "tool_use") continue;
      benutzt.push(b.name);
      const e = werkzeugAusfuehren(db, b.name, b.input);
      ergebnisse.push({ type: "tool_result", tool_use_id: b.id, content: e.text, is_error: e.fehler || undefined });
    }
    messages.push({ role: "user", content: ergebnisse });
  }
  // Ohne Abschluss den alten Verlauf behalten, damit keine offene Werkzeug-Runde gespeichert wird
  return { verlauf, antwort: { text: "Zu viele Werkzeug-Runden ohne Antwort. Bitte die Frage enger stellen.", werkzeuge: benutzt } };
}
