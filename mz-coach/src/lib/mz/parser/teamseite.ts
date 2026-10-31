// Weltrang auf der Teamseite ?p=team&tid= (gesehen 31.10.2026, Marcus: „der Rang hier ist der Weltranglistenplatz“):
// <span class="teamExpText …">Rang:</span> <span title="1910 Punkte" …><strong>727</strong></span>
// Weiter unten steht ein zweites „Rang:“ für den Verband (<strong>Rang:</strong>), das wird bewusst nicht gelesen.
export function weltrangAus(html: string): number | null {
  const m = html.match(/class="teamExpText[^"]*"[^>]*>\s*Rang:\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/);
  if (!m) return null;
  const zahl = m[1].replace(/<[^>]*>/g, "").replace(/[.\s ]/g, "");
  return /^\d+$/.test(zahl) ? Number(zahl) : null;
}
