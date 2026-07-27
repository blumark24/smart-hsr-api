#!/usr/bin/env node
/**
 * build-dashboard.mjs — Generates index.html from the data/*.json source of truth.
 *
 * The dashboard is data-driven: every number and status comes from JSON. This script
 * inlines the JSON as a <script type="application/json"> island so the page renders
 * fully offline (no fetch, no CDN, works over file://). Editing JSON + re-running this
 * script regenerates the HTML. This script writes ONLY inside tools/project-dashboard/.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASH_DIR = resolve(__dirname, "..");
const DATA_DIR = join(DASH_DIR, "data");
const REPORTS_DIR = join(DASH_DIR, "reports");

function readJson(name, fallback = null) {
  const p = join(DATA_DIR, name);
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, "utf8"));
}

const bundle = {
  state: readJson("project-state.json"),
  gates: readJson("score-gates.json"),
  modules: readJson("module-status.json"),
  evidence: readJson("evidence-ledger.json"),
  history: readJson("audit-history.json"),
  checks: readJson("check-results.json"),
  live: readJson("live-snapshot.json", { generatedAt: null, git: null, filesystem: null, external: null }),
  builtAt: new Date().toISOString(),
};

if (!bundle.state) {
  console.error("✗ data/project-state.json missing — run cannot build.");
  process.exit(1);
}

// Escape only what breaks a <script type="application/json"> island.
const island = JSON.stringify(bundle).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

const s = bundle.state.scorecard;
const html = `<!doctype html>
<html lang="ar" dir="rtl" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <title>Blumark24 OS — لوحة المتابعة التنفيذية</title>
  <meta name="description" content="لوحة متابعة حقيقية مبنية على بوابات إثبات — النسبة الحالية ${s.currentVerifiedScore}/100." />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230b1a34'/%3E%3Ctext x='16' y='22' font-size='16' text-anchor='middle' fill='%2338bdf8' font-family='sans-serif'%3EB%3C/text%3E%3C/svg%3E" />
  <link rel="stylesheet" href="./assets/dashboard.css" />
</head>
<body>
  <a class="skip-link" href="#main">تخطَّ إلى المحتوى</a>
  <div id="app" aria-busy="true">
    <noscript><p style="padding:2rem;color:#e2e8f0;background:#0b1a34">هذه اللوحة تحتاج JavaScript لعرض البيانات المضمّنة. البيانات كاملة داخل الصفحة (data island) ولا تتطلب إنترنت.</p></noscript>
  </div>
  <script type="application/json" id="dashboard-data">${island}</script>
  <script src="./assets/dashboard.js" defer></script>
</body>
</html>
`;

writeFileSync(join(DASH_DIR, "index.html"), html);
console.log("✓ index.html generated from data/*.json");

// Regenerate SCORE_CHANGELOG.md from audit history (human-readable).
if (bundle.history && Array.isArray(bundle.history.changelog)) {
  const rows = bundle.history.changelog
    .map((c) => `| ${c.date || "—"} | ${c.phase} | ${c.event} | ${c.gate} | ${c.scoreBefore} → ${c.scoreAfter} | ${c.decision} |`)
    .join("\n");
  const md = `# Blumark24 OS — SCORE CHANGELOG\n\n> النسبة تتغير فقط بعد إغلاق بوابة موثقة. القاعدة: إضافة نطاق لا تخفض النسبة.\n\n| التاريخ | المرحلة | الحدث | البوابة | الدرجة | القرار |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n`;
  writeFileSync(join(REPORTS_DIR, "SCORE_CHANGELOG.md"), md);
  console.log("✓ reports/SCORE_CHANGELOG.md generated");
}
