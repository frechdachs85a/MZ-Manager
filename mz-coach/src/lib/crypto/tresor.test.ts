import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { entschluesseln, verschluesseln } from "./tresor";

describe("Tresor", () => {
  const key = randomBytes(32);

  it("verschlüsselt und entschlüsselt", () => {
    const g = verschluesseln("geheim äöü", key);
    expect(g).not.toContain("geheim");
    expect(entschluesseln(g, key)).toBe("geheim äöü");
  });

  it("gleicher Klartext ergibt jedes Mal anderen Geheimtext", () => {
    expect(verschluesseln("x", key)).not.toBe(verschluesseln("x", key));
  });

  it("falscher Schlüssel oder veränderte Daten scheitern", () => {
    const g = verschluesseln("geheim", key);
    expect(() => entschluesseln(g, randomBytes(32))).toThrow();
    const teile = g.split(".");
    teile[3] = Buffer.from("anders").toString("base64url");
    expect(() => entschluesseln(teile.join("."), key)).toThrow();
  });
});
