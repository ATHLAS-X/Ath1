#!/usr/bin/env node
/**
 * Injection sweep — regression guard, not a one-off audit.
 *
 * TypeScript (app/, lib/): every DB call must go through the sql`...` tagged
 * template from @/lib/db. Flags:
 *   - sql(...) called without an immediately-following backtick (i.e. not sql`...`)
 *   - .query(...) usage outside lib/db.ts's own definition (the raw escape hatch)
 *   - dynamic identifiers interpolated into a sql`` literal (FROM/JOIN/ORDER BY/
 *     GROUP BY/INTO/UPDATE/TABLE ${...}) — tagged templates parameterize VALUES
 *     safely, but never identifiers, so this pattern is unsafe even with sql``
 *   - a sql`` result concatenated with another string via `+`
 *
 * Python (Backend/AI/app/): every raw SQL call must avoid f-strings/%-formatting
 * inside text()/execute(). Flags:
 *   - text(f"...") / text(f'...')
 *   - text("..." % ...) / text('...' % ...)
 *   - text("...".format(...))
 *   - .execute(f"...") with a SQL-shaped string (best-effort)
 *
 * Exits 1 with a file:line list if anything is found. Exits 0 (silently
 * informative) if clean — run this in CI as a regression gate.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, exts, skipDirs = new Set(["node_modules", ".next", ".git", "__pycache__"])) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, exts, skipDirs));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function scanFile(file, patterns) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    for (const { name, regex } of patterns) {
      if (regex.test(line)) hits.push({ file, line: i + 1, name, text: line.trim() });
    }
  });
  return hits;
}

// ── TypeScript sweep ─────────────────────────────────────────────────────────
const TS_PATTERNS = [
  { name: "sql() called without a tagged template", regex: /\bsql\s*\(\s*[^`)]/ },
  { name: "sql`` result concatenated with a string", regex: /sql`[^`]*`\s*\+|\+\s*sql`/ },
];

const tsFiles = [...walk(path.join(ROOT, "app"), [".ts", ".tsx"]), ...walk(path.join(ROOT, "lib"), [".ts", ".tsx"])];
let tsHits = [];
for (const file of tsFiles) {
  const hits = scanFile(file, TS_PATTERNS);
  tsHits.push(...hits);
}

// Dynamic identifier interpolation — scoped to the *contents* of actual
// sql`...` blocks (multiline), not just any line containing "from ${" (which
// matches plain-English template strings too, e.g. SMS/email bodies).
const IDENTIFIER_RE = /\b(FROM|JOIN|ORDER BY|GROUP BY|INTO|UPDATE|TABLE)\s+\$\{/i;
for (const file of tsFiles) {
  const text = readFileSync(file, "utf8");
  const blockRe = /\bsql`([^`]*)`/gs;
  let match;
  while ((match = blockRe.exec(text))) {
    if (IDENTIFIER_RE.test(match[1])) {
      const startLine = text.slice(0, match.index).split("\n").length;
      tsHits.push({
        file,
        line: startLine,
        name: "dynamic identifier interpolated into a sql`` literal",
        text: match[1].trim().split("\n")[0],
      });
    }
  }
}

// .query( usage outside lib/db.ts's own definition line
const dbTsPath = path.join(ROOT, "lib", "db.ts");
for (const file of tsFiles) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (/\.query\s*\(/.test(line)) {
      const isDefinitionLine = file === dbTsPath && line.includes("getSql()");
      if (!isDefinitionLine) {
        tsHits.push({ file, line: i + 1, name: ".query() raw call (bypasses sql`` parameterization)", text: line.trim() });
      }
    }
  });
}

// ── Python sweep (Backend/AI/app) ────────────────────────────────────────────
const PY_PATTERNS = [
  { name: "text() with an f-string", regex: /\btext\s*\(\s*f["']/ },
  { name: "text() with %-formatting", regex: /\btext\s*\([^)]*["'][^"']*%[^)]*\)/ },
  { name: "text() with .format()", regex: /\btext\s*\([^)]*\.format\s*\(/ },
  { name: ".execute() with an f-string containing SQL keywords", regex: /\.execute\s*\(\s*f["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b/i },
];

const pyDir = path.join(ROOT, "Backend", "AI", "app");
const pyFiles = walk(pyDir, [".py"]);
let pyHits = [];
for (const file of pyFiles) {
  pyHits.push(...scanFile(file, PY_PATTERNS));
}

// ── Report ───────────────────────────────────────────────────────────────────
const allHits = [...tsHits, ...pyHits];
if (allHits.length === 0) {
  console.log(`Injection sweep: clean. Scanned ${tsFiles.length} TS files (app/, lib/) and ${pyFiles.length} Python files (Backend/AI/app/).`);
  console.log("No sql() calls bypassing the tagged template, no .query() raw escapes outside lib/db.ts, no dynamic identifier interpolation, no string-built SQL in text()/execute().");
  process.exit(0);
}

console.error(`Injection sweep: ${allHits.length} finding(s):\n`);
for (const hit of allHits) {
  console.error(`  ${path.relative(ROOT, hit.file)}:${hit.line}  [${hit.name}]`);
  console.error(`    ${hit.text}`);
}
process.exit(1);
