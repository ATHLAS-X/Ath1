#!/usr/bin/env node
/**
 * Cross-platform wrapper so `npm run audit:py` works the same on Windows/macOS/Linux
 * (avoids relying on `cd x && y` shell chaining, which differs across shells).
 * Requires pip-audit to be installed (it's pinned in Backend/AI/requirements.txt).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "Backend", "AI");

const pythonBin = process.platform === "win32" ? "python" : "python3";
const result = spawnSync(pythonBin, ["-m", "pip_audit", "-r", "requirements.txt"], {
  cwd: backendDir,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Could not run pip-audit: ${result.error.message}`);
  console.error("Install it with: pip install -r Backend/AI/requirements.txt");
  process.exit(1);
}
process.exit(result.status ?? 1);
