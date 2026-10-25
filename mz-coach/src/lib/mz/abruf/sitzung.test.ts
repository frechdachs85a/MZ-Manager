import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { migrieren } from "@/lib/db/schema";

vi.mock("server-only", () => ({}));

// Lokaler Nachbau von ManagerZone mit den beobachteten Merkmalen (docs/mz-seiten.md):
// sichtbares Formular #logindata mit Enter-Handler, Fehlerklassen, Abmeldeseite für
// nicht eingeloggte Aufrufe der Kaderseite. Wie ManagerZone intern einloggt (safeLogin),
// ist nicht bekannt und hier bewusst vereinfacht. Echtes ManagerZone wird nie aufgerufen.
const START = (fehler: string) => `<!DOCTYPE html><html><head><title>Start</title>
<style>.form_error_content{display:none}</style>${fehler ? `<style>.${fehler}{display:block}</style>` : ""}
<script>function safeLogin(f){var h=document.forms.login;h['logindata[username]'].value=f.login_username.value;
h['logindata[md5]'].value=f.login_password.value;h.submit();return false;}</script></head><body>
<form action="" method="post" name="logindata" id="logindata" onsubmit="return safeLogin(this);">
<input type="submit" value="submit" style="position: absolute; top: -9999px">
<input class="input" type="text" id="login_username" name="login_username" value="">
<input class="input" type="password" id="login_password" name="login_password" value="" onkeypress="if(event.keyCode==13) {document.getElementById('logindata').requestSubmit();}">
<div class="form_error_content wrong_username_or_password"><p>Incorrect username or password</p></div>
<div class="form_error_content too_many_failed_login_attempts"><p>Access has been temporarily blocked</p></div>
</form>
<form action="/?p=login" method="post" name="login"><input type="hidden" name="logindata[md5]" value="">
<input type="hidden" name="logindata[username]" value=""></form></body></html>`;

const ABMELDUNG = `<!DOCTYPE html><HTML><HEAD>
<META HTTP-EQUIV="Refresh" CONTENT="0;URL=/?changesport=soccer">
<title>Logout - Managerzone</title></HEAD><BODY></BODY></HTML>`;

const browserDa = existsSync(chromium.executablePath());

describe.skipIf(!browserDa)("MZ-Sitzung gegen lokalen Nachbau", () => {
  let server: Server;
  let logins = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      const p = url.searchParams.get("p");
      const eingeloggt = (req.headers.cookie ?? "").includes("PHPSESSID=gut");
      if (req.method === "POST" && p === "login") {
        logins++;
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const f = new URLSearchParams(body);
          const ok = f.get("logindata[username]") === "marcus" && f.get("logindata[md5]") === "geheim";
          res.writeHead(302, ok ? { Location: "/?p=home", "Set-Cookie": "PHPSESSID=gut; Path=/" } : { Location: "/?fehler=1" });
          res.end();
        });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (p === "players") return res.end(eingeloggt ? "<html><title>Spieler</title><body>Kader</body></html>" : ABMELDUNG);
      if (p === "home" && eingeloggt) return res.end("<html><title>Home</title></html>");
      if (url.pathname === "/js/transfer.js") return res.end("function buy(pid) { /* Nachbau */ }");
      if (p === "transfer" && eingeloggt) return res.end('<html><title>Transfer</title><script src="/js/transfer.js"></script></html>');
      res.end(START(url.searchParams.get("fehler") ? "wrong_username_or_password" : ""));
    }).listen(0);
    process.env.MZ_BASIS_URL = `http://localhost:${(server.address() as AddressInfo).port}`;
    process.env.MZ_TRESOR_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterAll(() => {
    server.close();
  });

  async function module() {
    vi.resetModules();
    const sitzung = await import("./sitzung");
    const zugang = await import("@/lib/mz/zugang");
    return { ...sitzung, ...zugang };
  }

  it("loggt ein, holt die Kaderseite und nutzt beim nächsten Mal das gespeicherte Cookie", async () => {
    const { mitMzSitzung, speichereZugang } = await module();
    const db = new Database(":memory:");
    migrieren(db);
    speichereZugang(db, { benutzer: "marcus", passwort: "geheim" });
    logins = 0;

    const seite = await mitMzSitzung(db, (s) => s.holeSeite("/?p=players"));
    expect(seite.htmlDom).toContain("Kader");
    expect(logins).toBe(1);

    // Diagnose: Login-Ergebnis, Bildschirmfoto und Antwortverlauf gespeichert, das Passwort nirgends
    const diag = db.prepare("SELECT art, html_roh FROM rohseite WHERE art LIKE 'login-%'").all() as { art: string; html_roh: string }[];
    expect(diag.map((d) => d.art).sort()).toEqual(["login-bild", "login-ergebnis", "login-verlauf"]);
    expect(diag.find((d) => d.art === "login-bild")!.html_roh.startsWith("data:image/png;base64,")).toBe(true);
    expect(JSON.parse(diag.find((d) => d.art === "login-verlauf")!.html_roh).verlauf.some((v: { methode: string }) => v.methode === "POST")).toBe(true);
    for (const d of diag.filter((x) => x.art !== "login-bild")) expect(d.html_roh).not.toContain("geheim");

    const nochmal = await mitMzSitzung(db, (s) => s.holeSeite("/?p=players"));
    expect(nochmal.htmlDom).toContain("Kader");
    expect(logins).toBe(1);
  }, 60_000);

  it("liest Skripte mit, die die Seite selbst lädt (transfer.js)", async () => {
    const { mitMzSitzung, speichereZugang } = await module();
    const db = new Database(":memory:");
    migrieren(db);
    speichereZugang(db, { benutzer: "marcus", passwort: "geheim" });
    const seite = await mitMzSitzung(db, (s) => s.holeSeite("/?p=transfer", { skripte: /\/transfer[^/]*\.js/ }));
    expect(seite.skripte).toHaveLength(1);
    expect(seite.skripte?.[0].text).toContain("function buy");
  }, 60_000);

  it("falsches Passwort: Fehler gemerkt, kein weiterer Versuch bis zum neuen Zugang", async () => {
    const { mitMzSitzung, speichereZugang, loginFehler } = await module();
    const db = new Database(":memory:");
    migrieren(db);
    speichereZugang(db, { benutzer: "marcus", passwort: "falsch" });
    logins = 0;

    await expect(mitMzSitzung(db, (s) => s.holeSeite("/?p=players"), { manuell: true })).rejects.toThrow(
      "Benutzername oder Passwort falsch",
    );
    expect(loginFehler(db)?.grund).toBe("falsch");
    await expect(mitMzSitzung(db, (s) => s.holeSeite("/?p=players"), { manuell: true })).rejects.toThrow();
    expect(logins).toBe(1);

    speichereZugang(db, { benutzer: "marcus", passwort: "geheim" });
    expect(loginFehler(db)).toBeNull();
    const seite = await mitMzSitzung(db, (s) => s.holeSeite("/?p=players"));
    expect(seite.htmlDom).toContain("Kader");
  }, 60_000);
});
