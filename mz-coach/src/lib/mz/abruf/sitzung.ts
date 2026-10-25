import "server-only";
import type Database from "better-sqlite3";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { entschluesseln, tresorSchluessel, verschluesseln } from "@/lib/crypto/tresor";
import { ladeZugang } from "@/lib/mz/zugang";
import { erzeugeDrossel } from "./drossel";
import { istAbmeldeSeite, istEingeloggt, LOGIN_FEHLER } from "./erkennung";

// ManagerZone-Sitzung im echten Browser (Playwright). Login über die sichtbaren Felder,
// damit das Seiten-JavaScript (safeLogin) selbst läuft (docs/mz-seiten.md).
// Cookies werden verschlüsselt gespeichert und beim nächsten Abruf wiederverwendet,
// ein neuer Login passiert nur, wenn die Sitzung abgelaufen ist.

// Nur für Tests gegen einen lokalen Nachbau überschreibbar.
export const MZ_BASIS = process.env.MZ_BASIS_URL ?? "https://www.managerzone.com";
const MZ_HOST = new URL(MZ_BASIS).hostname.replace(/^www\./, "");
const COOKIE_KEY = "mz_cookies";
const LOGIN_FEHLER_KEY = "mz_login_fehler";

export class MzFehler extends Error {}

export type Seite = {
  url: string;
  status: number | null;
  htmlRoh: string | null;
  htmlDom: string | null;
  // Skripte, die die Seite selbst geladen hat und die auf `skripte` passen (nur auf Wunsch)
  skripte?: { url: string; text: string }[];
};

type Cookie = Awaited<ReturnType<BrowserContext["cookies"]>>[number];

function ladeCookies(db: Database.Database): Cookie[] {
  const row = db.prepare("SELECT wert FROM einstellung WHERE schluessel = ?").get(COOKIE_KEY) as
    | { wert: string }
    | undefined;
  if (!row) return [];
  try {
    return JSON.parse(entschluesseln(row.wert, tresorSchluessel()));
  } catch {
    return [];
  }
}

function speichereCookies(db: Database.Database, cookies: Cookie[]) {
  const mz = cookies.filter((c) => c.domain.replace(/^\./, "").endsWith(MZ_HOST));
  const wert = verschluesseln(JSON.stringify(mz), tresorSchluessel());
  db.prepare(
    `INSERT INTO einstellung (schluessel, wert, geaendert) VALUES (?, ?, ?)
     ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert`,
  ).run(COOKIE_KEY, wert, new Date().toISOString());
}

export function loescheSitzung(db: Database.Database) {
  db.prepare("DELETE FROM einstellung WHERE schluessel IN (?, ?)").run(COOKIE_KEY, LOGIN_FEHLER_KEY);
}

// Ein fehlgeschlagener Login wird gemerkt. Nach "falsches Passwort" gibt es keinen weiteren
// Versuch, bis der Zugang neu gespeichert wurde (sonst droht die IP-Sperre von ManagerZone).
type LoginFehler = { grund: "falsch" | "gesperrt" | "unbestaetigt"; zeit: string };

export function loginFehler(db: Database.Database): LoginFehler | null {
  const row = db.prepare("SELECT wert FROM einstellung WHERE schluessel = ?").get(LOGIN_FEHLER_KEY) as
    | { wert: string }
    | undefined;
  return row ? JSON.parse(row.wert) : null;
}

function merkeLoginFehler(db: Database.Database, grund: LoginFehler["grund"]) {
  const zeit = new Date().toISOString();
  db.prepare(
    `INSERT INTO einstellung (schluessel, wert, geaendert) VALUES (?, ?, ?)
     ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert`,
  ).run(LOGIN_FEHLER_KEY, JSON.stringify({ grund, zeit }), zeit);
}

const MELDUNG: Record<LoginFehler["grund"], string> = {
  falsch: "ManagerZone meldet: Benutzername oder Passwort falsch. Bitte den Zugang neu speichern.",
  gesperrt: "ManagerZone hat Logins von dieser IP vorübergehend gesperrt (zu viele Fehlversuche). Später erneut versuchen.",
  unbestaetigt:
    "Login nicht bestätigt: ManagerZone hat weder weitergeleitet noch eine Fehlermeldung gezeigt. Möglicherweise verlangt die Seite ein Captcha (reCAPTCHA ist eingebunden).",
};

async function login(db: Database.Database, ctx: BrowserContext) {
  const zugang = ladeZugang(db);
  if (!zugang) throw new MzFehler("Kein ManagerZone-Zugang gespeichert (Einstellungen).");
  const page = await ctx.newPage();
  try {
    await page.goto(`${MZ_BASIS}/`, { waitUntil: "domcontentloaded" });
    // Fehler von Playwright nie weiterreichen: Meldungen könnten Eingaben enthalten.
    const ergebnis = await (async () => {
      try {
        await page.fill("#login_username", zugang.benutzer);
        await page.fill("#login_password", zugang.passwort);
        const bis = 25_000;
        const nav = page
          .waitForEvent("framenavigated", { predicate: (f) => f === page.mainFrame(), timeout: bis })
          .then(() => "weiter" as const);
        const falsch = page
          .locator(LOGIN_FEHLER.falsch)
          .waitFor({ state: "visible", timeout: bis })
          .then(() => "falsch" as const);
        const gesperrt = page
          .locator(LOGIN_FEHLER.gesperrt)
          .waitFor({ state: "visible", timeout: bis })
          .then(() => "gesperrt" as const);
        // Enter im Passwortfeld schickt laut Seiten-HTML #logindata ab (onkeypress, keyCode 13).
        await page.press("#login_password", "Enter");
        return await Promise.any([nav, falsch, gesperrt]).catch(() => "unbestaetigt" as const);
      } catch {
        return "technisch" as const;
      }
    })();
    if (ergebnis === "technisch") throw new MzFehler("Loginformular von ManagerZone nicht bedienbar (Seitenaufbau geändert?).");
    let grund: LoginFehler["grund"] | null = ergebnis === "weiter" ? null : ergebnis;
    if (!grund) {
      // Ob ManagerZone den Fehler erst nach einem Seitenwechsel zeigt, ist nicht beobachtet,
      // deshalb auf der neuen Seite noch einmal nachsehen.
      await page.waitForLoadState("load").catch(() => {});
      if (await page.locator(LOGIN_FEHLER.gesperrt).isVisible().catch(() => false)) grund = "gesperrt";
      else if (await page.locator(LOGIN_FEHLER.falsch).isVisible().catch(() => false)) grund = "falsch";
    }
    if (grund) {
      merkeLoginFehler(db, grund);
      throw new MzFehler(MELDUNG[grund]);
    }
  } finally {
    await page.close();
  }
}

export type MzSitzung = {
  holeSeite: (pfad: string, opt?: { skripte?: RegExp }) => Promise<Seite>;
  // Antworttext ohne Browserseite (z. B. ajax.php), mit den Cookies der Sitzung. Loggt nicht
  // selbst ein: vorher eine Seite mit holeSeite laden.
  holeText: (pfad: string) => Promise<{ url: string; status: number; text: string }>;
  // Formular abschicken wie die Seite selbst (POST, Felder als application/x-www-form-urlencoded)
  sendeForm: (pfad: string, felder: Record<string, string>) => Promise<{ url: string; status: number; text: string }>;
};

let laeuft = false;

// Öffnet Browser und Sitzung, führt `arbeit` aus, speichert die Cookies und schließt alles.
// Es läuft immer nur ein Abruf gleichzeitig.
export async function mitMzSitzung<T>(
  db: Database.Database,
  arbeit: (s: MzSitzung) => Promise<T>,
  opt: { manuell: boolean } = { manuell: false },
): Promise<T> {
  if (laeuft) throw new MzFehler("Es läuft bereits ein Abruf.");
  const vorher = loginFehler(db);
  if (vorher?.grund === "falsch") throw new MzFehler(MELDUNG.falsch);
  if (vorher && !opt.manuell) throw new MzFehler(`Letzter Login fehlgeschlagen (${vorher.zeit}). ${MELDUNG[vorher.grund]}`);

  laeuft = true;
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ locale: "de-DE", timezoneId: "Europe/Berlin" });
    const cookies = ladeCookies(db);
    if (cookies.length) await ctx.addCookies(cookies);
    const drossel = erzeugeDrossel();
    // Ein gemeinsamer Login je Sitzung, auch wenn zwei Abrufe gleichzeitig laufen.
    let loginLauf: Promise<void> | null = null;

    async function lade(url: string, skriptMuster?: RegExp): Promise<Seite> {
      const page = await ctx.newPage();
      // Was der Browser beim Laden ohnehin holt, mitlesen; keine zusätzliche Anfrage
      const skripte: Promise<{ url: string; text: string } | null>[] = [];
      if (skriptMuster) {
        page.on("response", (r) => {
          if (skriptMuster.test(r.url())) skripte.push(r.text().then((text) => ({ url: r.url(), text })).catch(() => null));
        });
      }
      try {
        // Die Serverantwort beim Laden mitschneiden (eine Anfrage). Nachträglich ist sie nicht
        // mehr sicher lesbar, wenn die Seite sofort weiterleitet (Abmeldeseite mit Meta-Refresh 0).
        let htmlRoh: string | null = null;
        let status: number | null = null;
        const ziel = new URL(url).href;
        const nurZiel = (u: URL) => u.href === ziel;
        await page.route(nurZiel, async (route) => {
          const antwort = await route.fetch();
          status = antwort.status();
          htmlRoh = await antwort.text();
          // Die Abmeldeseite nicht ausführen: ihre Sofort-Weiterleitung kollidiert mit dem
          // Schließen des Tabs (beobachtet: nächster Tab hängt). Der Inhalt ist schon gesichert.
          if (istAbmeldeSeite(htmlRoh)) {
            await route.fulfill({ status, contentType: "text/html", body: "<!doctype html><title>abgemeldet</title>" });
          } else {
            await route.fulfill({ response: antwort, body: htmlRoh });
          }
        });
        await page.goto(url, { waitUntil: "commit", timeout: 60_000 });
        await page.unroute(nurZiel);
        if (htmlRoh !== null && istAbmeldeSeite(htmlRoh)) return { url, status, htmlRoh, htmlDom: null };
        await page.waitForLoadState("load", { timeout: 60_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const htmlDom = await page.content();
        const gelesen = (await Promise.all(skripte)).filter((x): x is { url: string; text: string } => x !== null);
        return { url, status, htmlRoh, htmlDom, ...(skriptMuster ? { skripte: gelesen } : {}) };
      } finally {
        await page.close();
      }
    }

    const sitzung: MzSitzung = {
      holeSeite: (pfad, opt) =>
        drossel(async () => {
          const url = pfad.startsWith("http") ? pfad : `${MZ_BASIS}${pfad}`;
          let seite = await lade(url, opt?.skripte);
          if (!istEingeloggt(seite.htmlDom ?? seite.htmlRoh ?? "")) {
            // Höchstens ein Login je Sitzung: Läuft die Sitzung später erneut ab, wird nicht
            // noch einmal eingeloggt, die Prüfung unten meldet dann den Fehler.
            loginLauf ??= login(db, ctx);
            await loginLauf;
            seite = await lade(url, opt?.skripte);
          }
          if (!istEingeloggt(seite.htmlDom ?? seite.htmlRoh ?? "")) {
            merkeLoginFehler(db, "unbestaetigt");
            throw new MzFehler(
              `Login abgeschickt, aber ${url} zeigt weiterhin nicht eingeloggt. Möglicherweise verlangt ManagerZone ein Captcha.`,
            );
          }
          return seite;
        }),
      holeText: (pfad) =>
        drossel(async () => {
          const url = pfad.startsWith("http") ? pfad : `${MZ_BASIS}${pfad}`;
          const r = await ctx.request.get(url, { timeout: 60_000 });
          return { url, status: r.status(), text: await r.text() };
        }),
      sendeForm: (pfad, felder) =>
        drossel(async () => {
          const url = pfad.startsWith("http") ? pfad : `${MZ_BASIS}${pfad}`;
          const r = await ctx.request.post(url, { form: felder, timeout: 60_000 });
          return { url, status: r.status(), text: await r.text() };
        }),
    };

    const ergebnis = await arbeit(sitzung);
    db.prepare("DELETE FROM einstellung WHERE schluessel = ?").run(LOGIN_FEHLER_KEY);
    speichereCookies(db, await ctx.cookies());
    return ergebnis;
  } finally {
    laeuft = false;
    await browser?.close().catch(() => {});
  }
}
