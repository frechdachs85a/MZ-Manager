import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { gebotImBrowser } = await import("./bietomat-lauf");

// Lokaler Nachbau des Gebotsfensters von ManagerZone (Aufbau wie die echte Antwort vom 26.10.2026: Feld
// #buyform_bid_player_currency mit vorausgefülltem Mindestgebot in der Verkäuferwährung, exchange_rates, Warnhinweis
// mit Häkchen #transferBidConfirm, Knopf #transfer_place_bid_button, Rückfrage "Bist Du sicher??" per confirm(),
// Formular an ajax.php?p=transfer&sub=bid). Werte erfunden. Echtes ManagerZone wird nie aufgerufen, es fließt kein Geld.
const formular = (warnung: boolean) => `
<form id="buyform" action="/ajax.php?p=transfer&sub=bid&confirmvalue=1&sport=soccer" method="post">
  <div class="transfer_bid_error_container form_error_content clearfix"></div>
  <input type="hidden" name="pid" id="buyform_pid" value="4711">
  <input type="text" name="bid_user_currency" id="buyform_bid_user_currency" onkeyup="javascript: updateExchange('EUR', 2, 3 , 1, 1, 1, 1)">
  <input type="text" value="500000" onkeyup="javascript: updateExchange('EUR', 3, 2 , 2, 3158754, 35121, 5291); updateBidWarning(3, 3158754, 0)" name="bid_player_currency" id="buyform_bid_player_currency"> USD
  <a href="#" onclick="window.bieten(); return false;" id="transfer_place_bid_button">Gebot</a>
  <div id="transferBidWarning" class="input_warning" ${warnung ? "" : "hidden"}><input type="checkbox" id="transferBidConfirm"></div>
</form>`;
const MARKT = (warnung: boolean) => `<!DOCTYPE html><html><head><title>Transfer</title><script>
  window.exchange_rates = [[3, 2, 0.80886952], [2, 3, 1.23629334]];
  function buy(pid) { document.getElementById("box").innerHTML = ${JSON.stringify(formular(warnung))}; }
  window.bieten = function () {
    var w = document.getElementById("transferBidWarning");
    if (!w.hasAttribute("hidden") && !document.getElementById("transferBidConfirm").checked) return; // Knopf gesperrt
    if (!confirm("Bist Du sicher??")) return;
    var f = document.getElementById("buyform");
    fetch(f.getAttribute("action"), { method: "POST", body: new URLSearchParams(new FormData(f)) });
  };
</script></head><body><div id="box"></div></body></html>`;

const browserDa = existsSync(chromium.executablePath());

describe.skipIf(!browserDa)("Bietomat im Browser gegen Nachbau des Gebotsfensters", () => {
  let server: Server;
  let browser: Browser;
  let warnung = false;
  const gebote: URLSearchParams[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      if (req.method === "POST" && url.searchParams.get("sub") === "bid") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          gebote.push(new URLSearchParams(body));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end('["true"]');
        });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(MARKT(warnung));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  async function lauf(maximumEur: number) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/?p=transfer`);
    const r = await gebotImBrowser(4711, maximumEur)(page);
    await page.close();
    return r;
  }

  it("bietet genau die vorausgefüllte Stufe, bestätigt die Rückfrage und rechnet in Euro um", async () => {
    const vorher = gebote.length;
    const r = await lauf(500_000);
    // 500.000 USD * 0,80886952 = 404.434,76 -> aufgerundet 404.435 EUR
    expect(r).toMatchObject({ geboten: true, betrag: 500_000, eur: 404_435 });
    expect(gebote.length).toBe(vorher + 1);
    expect(gebote.at(-1)!.get("pid")).toBe("4711");
    expect(gebote.at(-1)!.get("bid_player_currency")).toBe("500000");
  });

  it("bietet nicht, wenn die Stufe auch nur 1 Euro über dem Endpreis liegt", async () => {
    const vorher = gebote.length;
    const r = await lauf(404_434);
    expect(r).toMatchObject({ geboten: false, stop: true });
    expect(gebote.length).toBe(vorher);
  });

  it("setzt bei Warnhinweis das Häkchen und bietet", async () => {
    warnung = true;
    const vorher = gebote.length;
    const r = await lauf(1_000_000);
    warnung = false;
    expect(r).toMatchObject({ geboten: true });
    expect(gebote.length).toBe(vorher + 1);
  });
}, 60_000);
