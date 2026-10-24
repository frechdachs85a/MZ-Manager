import { describe, expect, it } from "vitest";
import { hatLoginFormular, istAbmeldeSeite, istEingeloggt } from "./erkennung";

// Auszüge aus echten Antworten von managerzone.com (24.10.2026, docs/mz-seiten.md).
const ABMELDESEITE = `<!DOCTYPE html>
<HTML>
<HEAD>
<META HTTP-EQUIV="Refresh" CONTENT="0;URL=https://www.managerzone.com/?changesport=soccer">
<title>Logout - Managerzone</title>
<meta name="description" content="Logging out from Managerzone.">`;

const STARTSEITE_LOGIN = `<form action="" method="post" name="logindata" id="logindata" onsubmit="return safeLogin(this);">
<input class="input" type="text" autofocus="true" tabindex="1" id="login_username" name="login_username" value="" placeholder="Username">
<input class="input" type="password" tabindex="2" id="login_password" name="login_password" value="" placeholder="Password">`;

describe("Seitenerkennung", () => {
  it("erkennt die Abmeldeseite (nicht eingeloggt aufgerufene Kaderseite)", () => {
    expect(istAbmeldeSeite(ABMELDESEITE)).toBe(true);
    expect(istEingeloggt(ABMELDESEITE)).toBe(false);
  });

  it("erkennt das Loginformular der Startseite", () => {
    expect(hatLoginFormular(STARTSEITE_LOGIN)).toBe(true);
    expect(istEingeloggt(STARTSEITE_LOGIN)).toBe(false);
  });

  it("andere Seiten gelten als eingeloggt", () => {
    expect(istEingeloggt("<html><title>Spieler</title><div>...</div></html>")).toBe(true);
  });
});
