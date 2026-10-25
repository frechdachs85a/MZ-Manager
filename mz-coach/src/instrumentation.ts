// Beim Serverstart: Zeitplan für automatische Abrufe (nur Node.js, nicht im Edge-Runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MZ_ZEITPLAN === "aus") return;
  const { starteZeitplan } = await import("./lib/zeitplan");
  starteZeitplan();
}
