#!/usr/bin/env node
/**
 * Frontend <-> API route contract checker.
 *
 * Walks app/ and components/ for fetch("/api/...") calls (template-literal
 * ${} segments are treated as wildcards), walks app/api/ for every route.ts
 * and derives its URL path ([param] folders as wildcards, [...catchall] as
 * a greedy wildcard), then reports:
 *
 *   (a) frontend calls with no matching route           -> FAIL (exit 1)
 *   (b) matched call/route pairs where the route doesn't
 *       export a handler for the HTTP method used        -> FAIL (exit 1)
 *   (c) routes with no frontend caller                   -> WARN only
 *       (server components may query the DB directly instead of using fetch,
 *       so an unguarded route isn't necessarily dead — see step 0 of the
 *       access-control review for that judgment call)
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DYNAMIC = { type: "dynamic" };
const CATCHALL = { type: "catchall" };

function walk(dir, exts, skipDirs = new Set(["node_modules", ".next", ".git"])) {
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
    if (entry.isDirectory()) out.push(...walk(full, exts, skipDirs));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function segmentsOf(urlPath) {
  const segs = urlPath
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map((seg) => (seg === "__DYNAMIC__" ? DYNAMIC : seg));
  // route segments (from deriveRoutePath) are relative to app/api, so the
  // call's leading "api" segment (from "/api/...") has no counterpart there.
  if (segs[0] === "api") segs.shift();
  return segs;
}

// ── 1. Derive every route's path + exported methods from app/api/**/route.ts ──
const HTTP_METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";
const ROUTE_METHOD_RE = new RegExp(
  `export\\s+(?:async\\s+)?function\\s+(${HTTP_METHODS})\\b|` +
    `export\\s+const\\s+(${HTTP_METHODS})\\s*=`,
  "g",
);
// Route files sometimes re-export a handler from elsewhere, e.g.
//   export { GET } from "@/app/api/onboarding/match/route";
const ROUTE_REEXPORT_RE = /export\s*\{\s*([^}]+)\s*\}\s*from/g;
// ...or alias a local const to the method name without a `from` clause, e.g.
//   const handler = NextAuth(authOptions);
//   export { handler as GET, handler as POST };
const ROUTE_LOCAL_ALIAS_RE = /export\s*\{\s*([^}]+)\s*\}\s*;/g;

function deriveRoutePath(routeFile) {
  const rel = path.relative(path.join(ROOT, "app", "api"), path.dirname(routeFile));
  const parts = rel.split(path.sep).filter(Boolean);
  return parts.map((part) => {
    const catchall = part.match(/^\[\.\.\.(.+)\]$/);
    if (catchall) return CATCHALL;
    const dynamic = part.match(/^\[(.+)\]$/);
    if (dynamic) return DYNAMIC;
    return part;
  });
}

const routeFiles = walk(path.join(ROOT, "app", "api"), ["route.ts", "route.tsx"]).filter(
  (f) => path.basename(f) === "route.ts" || path.basename(f) === "route.tsx",
);

const HTTP_METHOD_SET = new Set(HTTP_METHODS.split("|"));

const routes = routeFiles.map((file) => {
  const text = readFileSync(file, "utf8");
  const methods = new Set();
  let m;
  ROUTE_METHOD_RE.lastIndex = 0;
  while ((m = ROUTE_METHOD_RE.exec(text))) methods.add(m[1] || m[2]);
  // For both "export { X } from ..." and "export { X as GET };" the externally
  // visible name is whatever comes AFTER "as" (or X itself if there's no alias).
  for (const re of [ROUTE_REEXPORT_RE, ROUTE_LOCAL_ALIAS_RE]) {
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      for (const name of m[1].split(",")) {
        const parts = name.trim().split(/\s+as\s+/);
        const exported = parts[parts.length - 1].trim();
        if (HTTP_METHOD_SET.has(exported)) methods.add(exported);
      }
    }
  }
  return { file, segments: deriveRoutePath(file), methods, called: false };
});

// ── 2. Find every fetch("/api/...") call in app/ and components/ ─────────────
const FETCH_RE = /\bfetch\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g;
// A literal method ("POST") resolves directly. A non-literal expression
// (e.g. `method: isOn ? "DELETE" : "POST"`) can't be resolved by regex without
// a real parser — we detect that a `method:` key exists but isn't a plain
// string literal, and skip the method-mismatch check for that call rather
// than guessing (silently asserting GET would be a false failure).
const METHOD_LITERAL_RE = /method\s*:\s*["']([A-Za-z]+)["']/;
const METHOD_KEY_RE = /method\s*:/;
const WINDOW_SIZE = 400;

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function templateToSegments(literal) {
  // Strip quotes/backticks, replace each ${...} with a single placeholder token
  // (we already confirmed no codebase usage mixes literal text with ${} in the
  // same path segment, so a whole-segment placeholder is accurate here).
  const inner = literal.slice(1, -1).replace(/\$\{[^}]*\}/g, "__DYNAMIC__");
  return inner;
}

const callFiles = [
  ...walk(path.join(ROOT, "app"), [".ts", ".tsx"]),
  ...walk(path.join(ROOT, "components"), [".ts", ".tsx"]),
];

const calls = [];
for (const file of callFiles) {
  const text = readFileSync(file, "utf8");
  const matches = [];
  let m;
  FETCH_RE.lastIndex = 0;
  while ((m = FETCH_RE.exec(text))) matches.push(m);

  matches.forEach((match, idx) => {
    const urlPath = templateToSegments(match[1]);
    if (!urlPath.startsWith("/api")) return;
    // Bound the method-detection window at the next fetch() call (or a flat
    // cap), so a method on a LATER unrelated call never bleeds into this one
    // (the bug that produced a false POST on a method-less GET call).
    const nextCallStart = matches[idx + 1]?.index ?? text.length;
    const windowEnd = Math.min(match.index + WINDOW_SIZE, nextCallStart);
    const window = text.slice(match.index, windowEnd);
    const literalMatch = window.match(METHOD_LITERAL_RE);
    let method;
    if (literalMatch) {
      method = literalMatch[1].toUpperCase();
    } else if (METHOD_KEY_RE.test(window)) {
      method = "DYNAMIC"; // a method: key exists but isn't a string literal — can't verify
    } else {
      method = "GET"; // no method key at all -> fetch's real default
    }
    calls.push({
      file,
      line: lineOf(text, match.index),
      urlPath,
      segments: segmentsOf(urlPath),
      method,
    });
  });
}

// ── 3. Match each call against the route table ────────────────────────────────
function segmentsMatch(callSegs, routeSegs) {
  let i = 0;
  let j = 0;
  while (j < routeSegs.length) {
    const routeSeg = routeSegs[j];
    if (routeSeg === CATCHALL) {
      return i < callSegs.length; // catch-all needs >=1 remaining segment, consumes the rest
    }
    if (i >= callSegs.length) return false;
    const callSeg = callSegs[i];
    if (routeSeg === DYNAMIC) {
      // matches any call segment, dynamic or static
    } else if (callSeg !== DYNAMIC && callSeg !== routeSeg) {
      return false;
    }
    i++;
    j++;
  }
  return i === callSegs.length;
}

const unmatchedCalls = [];
const methodMismatches = [];
const unverifiedMethodCalls = [];

for (const call of calls) {
  const matchingRoutes = routes.filter((r) => segmentsMatch(call.segments, r.segments));
  if (matchingRoutes.length === 0) {
    unmatchedCalls.push(call);
    continue;
  }
  matchingRoutes.forEach((r) => (r.called = true));
  if (call.method === "DYNAMIC") {
    unverifiedMethodCalls.push({ call, routes: matchingRoutes });
    continue;
  }
  const hasMethod = matchingRoutes.some((r) => r.methods.has(call.method));
  if (!hasMethod) {
    methodMismatches.push({ call, routes: matchingRoutes });
  }
}

const uncalledRoutes = routes.filter((r) => !r.called);

// ── 4. Report ──────────────────────────────────────────────────────────────────
function relRoute(r) {
  return "/" + r.segments.map((s) => (s === DYNAMIC ? ":param" : s === CATCHALL ? "*" : s)).join("/");
}

console.log(`Scanned ${routeFiles.length} routes under app/api/, ${calls.length} fetch("/api/...") calls in app/+components/.\n`);

let failed = false;

if (unmatchedCalls.length) {
  failed = true;
  console.error(`FAIL — ${unmatchedCalls.length} frontend call(s) with no matching route:\n`);
  for (const c of unmatchedCalls) {
    console.error(`  ${path.relative(ROOT, c.file)}:${c.line}  ${c.method} ${c.urlPath}`);
  }
  console.error("");
}

if (methodMismatches.length) {
  failed = true;
  console.error(`FAIL — ${methodMismatches.length} call(s) using a method the matched route doesn't export:\n`);
  for (const { call, routes: rs } of methodMismatches) {
    console.error(
      `  ${path.relative(ROOT, call.file)}:${call.line}  ${call.method} ${call.urlPath}  ` +
        `(route exports: [${rs.flatMap((r) => [...r.methods]).join(", ") || "none"}] at ${rs
          .map((r) => path.relative(ROOT, r.file))
          .join(", ")})`,
    );
  }
  console.error("");
}

if (unverifiedMethodCalls.length) {
  console.warn(`WARN — ${unverifiedMethodCalls.length} call(s) with a non-literal method expression (e.g. a ternary) — can't verify the method without a real parser, so these are matched on path only:\n`);
  for (const { call, routes: rs } of unverifiedMethodCalls) {
    console.warn(
      `  ${path.relative(ROOT, call.file)}:${call.line}  ${call.urlPath}  ` +
        `(route exports: [${rs.flatMap((r) => [...r.methods]).join(", ") || "none"}])`,
    );
  }
  console.warn("");
}

if (uncalledRoutes.length) {
  console.warn(`WARN — ${uncalledRoutes.length} route(s) with no frontend fetch() caller (may be called via server-side DB access, a mobile client, or be dead code):\n`);
  for (const r of uncalledRoutes) {
    console.warn(`  ${path.relative(ROOT, r.file)}  [${[...r.methods].join(", ") || "no exported handler found"}]  ${relRoute(r)}`);
  }
  console.warn("");
}

if (!failed) {
  console.log("No broken frontend->route contracts found.");
}

process.exit(failed ? 1 : 0);
