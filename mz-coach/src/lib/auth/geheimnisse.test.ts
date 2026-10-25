import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { einrichtungscode, istEingerichtet, ladeGeheimnisse, passwortHash, speicherePasswortHash } from "./geheimnisse";

const pfad = () => join(mkdtempSync(join(tmpdir(), "mzc-")), "geheimnisse.json");
const env = process.env.APP_PASSWORD_HASH;
afterEach(() => {
  if (env === undefined) delete process.env.APP_PASSWORD_HASH;
  else process.env.APP_PASSWORD_HASH = env;
});

describe("Ersteinrichtung: Geheimnisse auf dem Laufwerk", () => {
  it("legt Schlüssel einmal an (Rechte 600) und erzeugt sie danach nie neu", () => {
    const p = pfad();
    const a = ladeGeheimnisse(p);
    expect(a.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(Buffer.from(a.tresorKey, "base64")).toHaveLength(32);
    expect(statSync(p).mode & 0o777).toBe(0o600);
    expect(ladeGeheimnisse(p)).toEqual(a);
  });

  it("Einrichtungscode bleibt gleich, bis ein Passwort gesetzt ist; Schlüssel bleiben dabei unverändert", () => {
    delete process.env.APP_PASSWORD_HASH;
    const p = pfad();
    const vorher = ladeGeheimnisse(p);
    const code = einrichtungscode(p)!;
    expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(einrichtungscode(p)).toBe(code);
    expect(istEingerichtet(p)).toBe(false);
    speicherePasswortHash("scrypt:1:1:1:x:y", p);
    expect(istEingerichtet(p)).toBe(true);
    expect(einrichtungscode(p)).toBeUndefined();
    const nachher = JSON.parse(readFileSync(p, "utf8"));
    expect(nachher).toMatchObject({ sessionSecret: vorher.sessionSecret, tresorKey: vorher.tresorKey, passwortHash: "scrypt:1:1:1:x:y" });
    expect(nachher.einrichtungscode).toBeUndefined();
  });

  it("Umgebungsvariable hat Vorrang", () => {
    process.env.APP_PASSWORD_HASH = "scrypt:aus:der:umgebung:x:y";
    expect(passwortHash(pfad())).toBe("scrypt:aus:der:umgebung:x:y");
  });
});
