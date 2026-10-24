// Erzeugt Logo und Favicons aus SVG (Chromium über Playwright).
// Aufruf: node scripts/make-icons.mjs
import { createRequire } from "node:module";
// Playwright ist global vorinstalliert, daher per require (berücksichtigt NODE_PATH)
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync } from "node:fs";

const icon = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#34c759"/><stop offset="1" stop-color="#1f8a3d"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round">
    <rect x="112" y="80" width="288" height="352" rx="18"/>
    <line x1="112" y1="256" x2="400" y2="256"/>
    <circle cx="256" cy="256" r="52"/>
    <path d="M196 80v52h120V80M196 432v-52h120v52"/>
    <circle cx="256" cy="256" r="9" fill="#fff" stroke="none"/>
  </g>
</svg>`;

const out = process.cwd() + "/public";
mkdirSync(out + "/icons", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, size, file, bg = null, w = size, h = size) {
  await page.setViewportSize({ width: w, height: h });
  const inner = bg
    ? `<div style="width:${w}px;height:${h}px;background:${bg};display:grid;place-items:center">
         <div style="width:${size}px;height:${size}px;border-radius:${size * 0.225}px;overflow:hidden">${svg}</div></div>`
    : `<div style="width:${w}px;height:${h}px">${svg}</div>`;
  await page.setContent(`<html><body style="margin:0">${inner}<style>svg{width:100%;height:100%;display:block}</style></body></html>`);
  await page.screenshot({ path: file, omitBackground: false });
}

await render(icon(), 192, out + "/icons/icon-192.png");
await render(icon(), 180, out + "/apple-touch-icon.png");
await render(icon(), 48, out + "/favicon.png");
await browser.close();
console.log("fertig");
