#!/usr/bin/env node
/**
 * update-dashboard.mjs — Orchestrates: audit → build → validate.
 * Read-only against the project; writes only inside tools/project-dashboard/.
 * Pass through extra flags, e.g.: node update-dashboard.mjs --with-checks
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const passthrough = process.argv.slice(2);

function step(name, file, args = []) {
  console.log(`\n=== ${name} ===`);
  execFileSync(process.execPath, [join(__dirname, file), ...args], { stdio: "inherit" });
}

try {
  step("1/3 audit-project", "audit-project.mjs", passthrough);
  step("2/3 build-dashboard", "build-dashboard.mjs");
  step("3/3 validate-dashboard", "validate-dashboard.mjs");
  console.log("\n✓ update complete — audit + build + validate passed. لا commit/push/deploy.");
} catch (e) {
  console.error("\n✗ update failed:", e.message.split("\n")[0]);
  process.exit(1);
}
