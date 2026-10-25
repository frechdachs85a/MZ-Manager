// Beim Serverstart: Zeitplan für automatische Abrufe (nur Node.js, nicht im Edge-Runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Ersteinrichtung: Schlüssel anlegen und, solange kein App-Passwort gesetzt ist, den Einrichtungscode ins Protokoll
  const { einrichtungscode, ladeGeheimnisse } = await import("./lib/auth/geheimnisse");
  ladeGeheimnisse();
  const code = einrichtungscode();
  if (code) console.log(`MZ Coach noch nicht eingerichtet. Einrichtungscode: ${code} (auf /einrichtung eingeben)`);
  if (process.env.MZ_ZEITPLAN === "aus") return;
  const { starteZeitplan } = await import("./lib/zeitplan");
  starteZeitplan();
}
