import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken, SESSION_MAX_AGE, verifySessionToken } from "./session";

const SECRET = "x".repeat(40);

describe("Passwort", () => {
  it("akzeptiert das richtige und lehnt ein falsches Passwort ab", async () => {
    const stored = await hashPassword("geheim123");
    expect(await verifyPassword("geheim123", stored)).toBe(true);
    expect(await verifyPassword("geheim124", stored)).toBe(false);
  });

  it("lehnt kaputte Hash-Formate ab", async () => {
    expect(await verifyPassword("a", "")).toBe(false);
    expect(await verifyPassword("a", "bcrypt:1:2:3:4:5")).toBe(false);
  });
});

describe("Session-Token", () => {
  it("ist gültig direkt nach dem Erstellen", () => {
    const t = createSessionToken(SECRET);
    expect(verifySessionToken(t, SECRET)).toBe(true);
  });

  it("ist nach Ablauf ungültig", () => {
    const now = Date.now();
    const t = createSessionToken(SECRET, now);
    expect(verifySessionToken(t, SECRET, now + (SESSION_MAX_AGE + 1) * 1000)).toBe(false);
  });

  it("ist mit anderem Schlüssel oder verändertem Inhalt ungültig", () => {
    const t = createSessionToken(SECRET);
    expect(verifySessionToken(t, "y".repeat(40))).toBe(false);
    const [v, exp, sig] = t.split(".");
    expect(verifySessionToken(`${v}.${Number(exp) + 999999}.${sig}`, SECRET)).toBe(false);
    expect(verifySessionToken(undefined, SECRET)).toBe(false);
    expect(verifySessionToken("quatsch", SECRET)).toBe(false);
  });
});
