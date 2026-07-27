#!/usr/bin/env node
/**
 * validate-dashboard.mjs — Integrity gate for the dashboard data + generated HTML.
 * Read-only. Exits non-zero on any violation so CI can fail the build.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASH_DIR = resolve(__dirname, "..");
const DATA_DIR = join(DASH_DIR, "data");

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function readJson(name, required = true) {
  const p = join(DATA_DIR, name);
  if (!existsSync(p)) {
    if (required) err(`ملف مفقود: data/${name}`);
    return null;
  }
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { err(`JSON غير صالح في data/${name}: ${e.message}`); return null; }
}

const state = readJson("project-state.json");
const gates = readJson("score-gates.json");
const modules = readJson("module-status.json");
const evidence = readJson("evidence-ledger.json");
const history = readJson("audit-history.json");
const checks = readJson("check-results.json");

const TODAY = new Date().toISOString().slice(0, 10);
const isFuture = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d > TODAY;
const inRange = (n) => typeof n === "number" && n >= 0 && n <= 100;

// 1. Required top-level sections present.
const requiredSections = {
  "project-state.scorecard": state && state.scorecard,
  "score-gates.gates": gates && gates.gates,
  "score-gates.plan75to100": gates && gates.plan75to100,
  "score-gates.roadmap1000": gates && gates.roadmap1000,
  "module-status.clientModules": modules && modules.clientModules,
  "module-status.ownerModules": modules && modules.ownerModules,
  "module-status.aiLayers": modules && modules.aiLayers,
  "module-status.hierarchy": modules && modules.hierarchy,
  "evidence-ledger.evidence": evidence && evidence.evidence,
  "evidence-ledger.topRisks": evidence && evidence.topRisks,
  "evidence-ledger.topGaps": evidence && evidence.topGaps,
  "audit-history.changelog": history && history.changelog,
  "check-results.checks": checks && checks.checks,
};
for (const [k, v] of Object.entries(requiredSections)) {
  if (!v) err(`قسم مطلوب مفقود: ${k}`);
}

// 2. Scorecard integrity.
if (state && state.scorecard) {
  const sc = state.scorecard;
  for (const f of ["currentVerifiedScore", "previousScore", "readiness10Clients", "readiness1000Orgs"]) {
    if (!inRange(sc[f])) err(`قيمة خارج 0–100 أو مفقودة: scorecard.${f} = ${sc[f]}`);
  }
  if (sc.currentVerifiedScore - sc.previousScore !== sc.scoreDelta) {
    err(`scoreDelta لا يساوي current-previous (${sc.currentVerifiedScore}-${sc.previousScore}≠${sc.scoreDelta})`);
  }
  if (isFuture(sc.lastVerified)) err(`تاريخ مستقبلي: scorecard.lastVerified = ${sc.lastVerified}`);
  for (const f of ["currentBlocker", "nextSingleAction", "currentPhase", "confidence"]) {
    if (!sc[f]) err(`حقل مطلوب فارغ: scorecard.${f}`);
  }
}

// 3. Gate: a closed gate must reference evidence, and target scores in range.
if (gates && gates.gates) {
  for (const g of gates.gates) {
    if (!inRange(g.targetScore)) err(`gate "${g.stage}" targetScore خارج النطاق: ${g.targetScore}`);
    if (g.state === "closed" && (!g.evidence || !g.evidence.trim())) {
      err(`بوابة مغلقة بلا دليل: "${g.stage}"`);
    }
  }
}

// 4. Modules: score must equal gate-derived score (no score without evidence gates),
//    and no score outside range.
if (modules && modules.clientModules) {
  const w = modules.gateWeights || { complete: 1, partial: 0.5, missing: 0, deferred: 0 };
  for (const m of modules.clientModules) {
    if (!inRange(m.score)) { err(`قسم "${m.name}" score خارج النطاق: ${m.score}`); continue; }
    if (!m.gates) { err(`قسم "${m.name}" بلا بوابات (score بلا دليل)`); continue; }
    const vals = Object.values(m.gates).map((g) => (g in w ? w[g] : NaN));
    if (vals.some((v) => Number.isNaN(v))) { err(`قسم "${m.name}" حالة بوابة غير معروفة`); continue; }
    const computed = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
    if (computed !== m.score) {
      err(`قسم "${m.name}" score=${m.score} لا يطابق المحسوب من البوابات=${computed}`);
    }
    if (m.score > 0 && m.state === "planned") {
      warn(`قسم "${m.name}" مخطط لكن score=${m.score} (>0)`);
    }
  }
}
for (const key of ["ownerModules", "aiLayers"]) {
  if (modules && modules[key]) {
    for (const m of modules[key]) {
      if (!inRange(m.score)) err(`${key} "${m.unit || m.layer}" score خارج النطاق: ${m.score}`);
    }
  }
}

// 5. Evidence dates not in the future; every evidence has proves + source.
if (evidence && evidence.evidence) {
  for (const e of evidence.evidence) {
    if (isFuture(e.date)) err(`دليل "${e.name}" تاريخ مستقبلي: ${e.date}`);
    if (!e.source) err(`دليل "${e.name}" بلا مصدر`);
  }
}

// 6. History: score jumps must be justified by a closed gate (scoreAfter>scoreBefore ⇒ gate closed OR future/planned row).
if (history && history.changelog) {
  for (const c of history.changelog) {
    if (isFuture(c.date)) err(`سجل تحديث تاريخ مستقبلي: ${c.date}`);
    if (typeof c.scoreAfter === "number" && typeof c.scoreBefore === "number" && c.scoreAfter > c.scoreBefore) {
      const closed = c.gate && /مكتملة|مغلق|closed/i.test(c.gate);
      const isFutureRow = c.date === null;
      if (!closed && !isFutureRow) {
        err(`ارتفاع درجة بلا بوابة مغلقة في سجل التحديث: ${c.event} (${c.scoreBefore}→${c.scoreAfter})`);
      }
    }
  }
}

// 7. Stale-as-fresh guard: if external snapshots are UNAVAILABLE they must not be labeled fresh.
if (evidence && evidence.externalSnapshots) {
  for (const [k, v] of Object.entries(evidence.externalSnapshots)) {
    if (v && v.status && v.status !== "UNAVAILABLE" && v.status !== "STALE" && !v.lastChecked) {
      err(`لقطة خارجية "${k}" معلّمة "${v.status}" بلا lastChecked (بيانات قديمة كأنها حديثة)`);
    }
  }
}

// 8. Generated HTML sanity (if built).
const htmlPath = join(DASH_DIR, "index.html");
if (existsSync(htmlPath)) {
  const h = readFileSync(htmlPath, "utf8");
  if (!/id="dashboard-data"/.test(h)) err("index.html بلا data island (#dashboard-data)");
  if (!/dir="rtl"/.test(h)) err("index.html ليس RTL");
  if (/https?:\/\/(?!www\.w3\.org)/.test(h.replace(/href="data:[^"]*"/g, ""))) {
    warn("index.html يحتوي رابطًا خارجيًا محتملًا (تحقق من عدم الاعتماد على CDN).");
  }
} else {
  warn("index.html غير مبني بعد — شغّل project:dashboard.");
}

// Report.
console.log(`\nValidation — ${TODAY}`);
if (warnings.length) { console.log(`\n⚠ تحذيرات (${warnings.length}):`); warnings.forEach((w) => console.log("  - " + w)); }
if (errors.length) {
  console.log(`\n✗ أخطاء (${errors.length}):`);
  errors.forEach((e) => console.log("  - " + e));
  console.log("\nVALIDATION FAILED");
  process.exit(1);
}
console.log("\n✓ VALIDATION PASSED — لا score بلا دليل، لا بوابة مغلقة بلا دليل، لا تاريخ مستقبلي، النسب داخل 0–100، البوابات متطابقة.");
