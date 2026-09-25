// Builds the QR poster: Letter and 11x17 PDFs, plus the QR used by the website.
// Edit poster.config.json, then run: npm install && npm run build
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { ecg, toPath } from "../../docs/js/ecg.js";
import { LAKE } from "../../docs/js/lake.js";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "../../docs");
const cfg = JSON.parse(readFileSync(join(here, "poster.config.json"), "utf8"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// QR: error correction Q, navy on white, 4-module quiet zone.
const qr = await QRCode.toString(cfg.url, { type: "svg", errorCorrectionLevel: "Q", margin: 4, color: { dark: "#03173eff", light: "#ffffffff" } });
writeFileSync(join(here, "qr.svg"), qr);
writeFileSync(join(docs, "assets/join-qr.svg"), await QRCode.toString(cfg.url, { type: "svg", errorCorrectionLevel: "Q", margin: 2, color: { dark: "#03173eff", light: "#ffffffff" } }));

const trace = ecg({ width: 1000, height: 100, bpm: 66, pxPerSec: 150, seed: 11, amp: 0.95, step: 2 });
let water = "";
for (let x = 0; x <= 1000; x += 8) water += (x ? "L" : "M") + x + " " + (84 + 2.2 * Math.sin(x / 34) + 1.2 * Math.sin(x / 13)).toFixed(1);
const [hx, hy] = LAKE.hospital;
const lake = LAKE.contours.map((d, i) => `<path class="iso" d="${d}" opacity="${(0.6 - i * 0.055).toFixed(2)}"/>`).join("") +
  `<path class="shore" d="${LAKE.shore}"/><circle cx="${hx}" cy="${hy}" r="6" fill="#ff5a3c"/><text x="${hx + 13}" y="${hy + 5}">LMH</text>`;
const mark = `<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#03173e"/><rect x="1" y="1" width="46" height="46" rx="11" fill="none" stroke="#4fd6e6" stroke-opacity=".25"/><path d="M6 26h9l3-5 3.5 12L26 11l3.5 19 2.5-4h10" fill="none" stroke="#3dfc9a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M7 38c3-2 6-2 9 0s6 2 9 0 6-2 9 0 5 2 7 1" fill="none" stroke="#4fd6e6" stroke-width="2.4" stroke-linecap="round"/><circle cx="26" cy="11" r="2.2" fill="#ff5a3c"/></svg>`;
const tokens = readFileSync(join(docs, "css/tokens.css"), "utf8");

const SIZES = [
  { name: "letter", w: "8.5in", h: "11in", unit: "1in", band: "1.25" },
  { name: "11x17", w: "11in", h: "17in", unit: "1.294in", band: "1.4" },
];
const tpl = readFileSync(join(here, "poster.html"), "utf8");
mkdirSync(join(here, "build"), { recursive: true });

for (const s of SIZES) {
  const html = tpl
    .replace("/*{{TOKENS}}*/", tokens)
    .replace("{{SIZE}}", "page-" + s.name).replaceAll("{{PAGE_W}}", s.w).replaceAll("{{PAGE_H}}", s.h).replace("{{UNIT}}", s.unit).replace("{{BAND_FLEX}}", s.band)
    .replace("{{LAKE_VIEWBOX}}", LAKE.viewBox).replace("{{LAKE}}", lake)
    .replaceAll("{{MARK}}", mark)
    .replace("{{H1A}}", esc(cfg.headline[0])).replace("{{H1B}}", esc(cfg.headline[1]))
    .replace("{{SUB}}", esc(cfg.sub)).replace("{{DATES}}", esc(cfg.dates)).replace("{{PRIZE}}", esc(cfg.prize))
    .replace("{{ECG}}", toPath(trace.points)).replace("{{WATER}}", water)
    .replace("{{QR}}", qr).replace("{{URL_SHORT}}", esc(cfg.url.replace(/^https?:\/\//, "").replace(/\/$/, "")));
  const htmlPath = join(here, "build", `poster-${s.name}.html`);
  writeFileSync(htmlPath, html);
  const pdf = join(here, `poster-${s.name}.pdf`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=8000",
    `--print-to-pdf=${pdf}`, "file://" + htmlPath], { stdio: "pipe" });

  // Check: rasterize page 1 and decode the QR from the PDF itself.
  const png = join(here, "build", `poster-${s.name}.png`);
  execFileSync("sips", ["-s", "format", "png", "-s", "dpiWidth", "150", "-s", "dpiHeight", "150", pdf, "--out", png], { stdio: "pipe" });
  const img = PNG.sync.read(readFileSync(png));
  const found = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
  if (!found || found.data !== cfg.url) {
    console.error(`FAIL ${s.name}: QR decoded as ${found ? JSON.stringify(found.data) : "nothing"}`);
    process.exit(1);
  }
  const pages = (readFileSync(pdf, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`ok  poster-${s.name}.pdf  (${pages} page, QR scans as ${found.data}, image ${img.width}x${img.height})`);
}
rmSync(join(here, "qr.svg"));
