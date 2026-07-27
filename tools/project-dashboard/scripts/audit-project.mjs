#!/usr/bin/env node
/**
 * audit-project.mjs — Read-only project audit collector for the Blumark24 OS dashboard.
 *
 * SAFETY: read-only. Runs only git read commands, filesystem reads, and (optionally,
 * with --with-checks) the project's own npm verify/lint/build/typecheck/audit scripts.
 * It NEVER writes to Production/Staging, applies migrations, deploys, commits, or pushes.
 * It only writes inside tools/project-dashboard/ (data/ and reports/).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASH_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(DASH_DIR, "..", "..");
const DATA_DIR = join(DASH_DIR, "data");
const REPORTS_DIR = join(DASH_DIR, "reports");

const withChecks = process.argv.includes("--with-checks");

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch (e) {
    return `ERROR: ${e.message.split("\n")[0]}`;
  }
}

function countFiles(dir, matcher) {
  let n = 0;
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (matcher(e.name, p)) n++;
    }
  };
  walk(dir);
  return n;
}

function readJson(p, fallback) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
}

console.log("● audit-project (read-only) — collecting git + filesystem snapshot…");

const git = {
  branch: sh("git branch --show-current"),
  head: sh("git rev-parse HEAD"),
  originMain: sh("git rev-parse origin/main"),
  status: sh("git status -sb"),
  clean: sh("git status --porcelain") === "",
  lastCommits: sh("git log -5 --oneline").split("\n").filter(Boolean),
  diffCheck: sh("git diff --check") === "" ? "clean" : "issues",
};
git.headMatchesOrigin = git.head === git.originMain;

const routesDir = join(REPO_ROOT, "src", "app");
const routeCount = countFiles(routesDir, (n) => n === "page.tsx");
const apiCount = countFiles(join(routesDir, "api"), (n) => n === "route.ts");
const migCount = countFiles(join(REPO_ROOT, "supabase", "migrations"), (n) => n.endsWith(".sql"));
const hasMeetings = existsSync(join(routesDir, "meetings", "page.tsx"));

const pkg = readJson(join(REPO_ROOT, "package.json"), {});

// Optionally refresh the quality checks. Off by default to keep audit fast/safe.
let checkResults = readJson(join(DATA_DIR, "check-results.json"), { checks: [] });
if (withChecks) {
  console.log("● --with-checks: running verify:isolation / lint / build / tsc / audit …");
  const runCheck = (id, label, cmd, blocksProduction) => {
    let result = "FAIL";
    let evidence = "";
    try {
      const out = execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      result = "PASS";
      evidence = out.trim().split("\n").slice(-1)[0] || "";
    } catch (e) {
      const out = `${e.stdout || ""}${e.stderr || ""}`;
      // npm audit exits non-zero when vulns exist; treat as WARN not FAIL.
      result = id.startsWith("npm-audit") ? "WARN" : "FAIL";
      evidence = out.trim().split("\n").slice(-1)[0] || e.message;
    }
    return { id, label, result, blocksProduction, warnings: 0, note: "", evidence };
  };
  checkResults = {
    schemaVersion: 1,
    lastRun: new Date().toISOString().slice(0, 10),
    runContext: "Refreshed via project:audit --with-checks",
    checks: [
      runCheck("verify:isolation", "verify:isolation (static)", "npm run verify:isolation", false),
      runCheck("lint", "next lint", "npm run lint", false),
      runCheck("build", "next build", "npm run build", false),
      runCheck("typecheck", "tsc --noEmit", "npx tsc --noEmit && echo ok", false),
      runCheck("npm-audit", "npm audit (all)", "npm audit", false),
      runCheck("npm-audit-prod", "npm audit --omit=dev", "npm audit --omit=dev", true),
    ],
  };
  writeFileSync(join(DATA_DIR, "check-results.json"), JSON.stringify(checkResults, null, 2) + "\n");
  console.log("  ✓ check-results.json refreshed");
}

const now = new Date().toISOString();
const liveSnapshot = {
  schemaVersion: 1,
  generatedAt: now,
  git,
  filesystem: {
    routeCount,
    apiCount,
    migrationCount: migCount,
    hasMeetingsRoute: hasMeetings,
    packageName: pkg.name || null,
    packageVersion: pkg.version || null,
    nextVersion: (pkg.dependencies && pkg.dependencies.next) || null,
  },
  external: {
    github: { status: "UNAVAILABLE", lastChecked: null },
    vercel: { status: "UNAVAILABLE", lastChecked: null },
    supabase: { status: "UNAVAILABLE", lastChecked: null },
    note: "لقطات المصادر الخارجية غير مأخوذة تلقائيًا (read-only، بلا أسرار). عرّفها يدويًا عبر snapshot مخصص.",
  },
};
writeFileSync(join(DATA_DIR, "live-snapshot.json"), JSON.stringify(liveSnapshot, null, 2) + "\n");
console.log("  ✓ data/live-snapshot.json written");

// Stamp generatedAt into project-state.json (dynamic field only).
const statePath = join(DATA_DIR, "project-state.json");
const state = readJson(statePath, null);
if (state && state.meta) {
  state.meta.generatedAt = now;
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
  console.log("  ✓ project-state.json meta.generatedAt stamped");
}

// Produce LATEST_FULL_AUDIT.json (machine) and .md (human) snapshots.
const auditJson = {
  generatedAt: now,
  git,
  filesystem: liveSnapshot.filesystem,
  checks: checkResults.checks,
  state: state ? state.scorecard : null,
};
writeFileSync(join(REPORTS_DIR, "LATEST_FULL_AUDIT.json"), JSON.stringify(auditJson, null, 2) + "\n");

const md = [
  "# Blumark24 OS — LATEST FULL AUDIT (auto-generated)",
  "",
  `- Generated: ${now}`,
  `- Branch: \`${git.branch}\` — HEAD \`${git.head.slice(0, 7)}\` — origin/main \`${git.originMain.slice(0, 7)}\` — ${git.headMatchesOrigin ? "in sync" : "DIVERGED"}`,
  `- Working tree: ${git.clean ? "clean" : "dirty"} — diff --check: ${git.diffCheck}`,
  `- Routes: ${routeCount} pages, ${apiCount} API handlers — Migrations: ${migCount} — /meetings route: ${hasMeetings ? "present" : "MISSING"}`,
  "",
  "## Quality checks",
  "",
  "| Check | Result | Blocks Prod | Note |",
  "| --- | --- | --- | --- |",
  ...checkResults.checks.map((c) => `| ${c.label} | ${c.result} | ${c.blocksProduction ? "yes" : "no"} | ${(c.note || c.evidence || "").replace(/\|/g, "/")} |`),
  "",
  `> Verified score is held in \`data/project-state.json\` (gate-based, not recomputed here). Current: ${state ? state.scorecard.currentVerifiedScore : "?"}/100.`,
  "",
].join("\n");
writeFileSync(join(REPORTS_DIR, "LATEST_FULL_AUDIT.md"), md + "\n");
console.log("  ✓ reports/LATEST_FULL_AUDIT.{json,md} written");
console.log("● audit-project done (no writes outside tools/project-dashboard).");
