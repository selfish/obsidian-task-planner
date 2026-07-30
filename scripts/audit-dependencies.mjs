import { spawnSync } from "node:child_process";

const allowedAdvisories = new Map([
  [
    "https://github.com/advisories/GHSA-mh99-v99m-4gvg",
    {
      expires: "2026-08-30",
      reason: "Temporary development-only brace-expansion DoS exception; production dependency tree is clean.",
    },
  ],
]);

function audit(args) {
  const result = spawnSync("npm", ["audit", "--json", "--audit-level=high", ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    process.stderr.write(result.stderr);
    throw new Error("npm audit did not return valid JSON");
  }
  return { report, status: result.status ?? 1 };
}

function highOrCritical(report) {
  return Object.entries(report.vulnerabilities ?? {}).filter(([, vulnerability]) => ["high", "critical"].includes(vulnerability.severity));
}

function advisoryUrlsFor(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) return new Set();
  seen.add(name);

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return new Set();

  const urls = new Set();
  for (const cause of vulnerability.via ?? []) {
    if (typeof cause === "string") {
      for (const url of advisoryUrlsFor(cause, vulnerabilities, seen)) urls.add(url);
    } else if (["high", "critical"].includes(cause.severity) && cause.url) {
      urls.add(cause.url);
    }
  }
  return urls;
}

const production = audit(["--omit=dev"]);
if (production.status !== 0 || highOrCritical(production.report).length > 0) {
  console.error("Production dependency audit failed:");
  console.error(JSON.stringify(production.report.metadata?.vulnerabilities ?? {}, null, 2));
  process.exit(1);
}

const full = audit([]);
const affected = highOrCritical(full.report);
if (full.status === 0 && affected.length === 0) {
  console.log("Dependency audit passed with no high or critical vulnerabilities.");
  process.exit(0);
}
if (full.status !== 0 && affected.length === 0) {
  console.error("Full dependency audit failed without an attributable high/critical advisory:");
  console.error(JSON.stringify(full.report.error ?? full.report.metadata ?? full.report, null, 2));
  process.exit(1);
}

const now = new Date().toISOString().slice(0, 10);
const seenAdvisories = new Set();
const rejected = [];
for (const [name] of affected) {
  const urls = advisoryUrlsFor(name, full.report.vulnerabilities);
  if (urls.size === 0) {
    rejected.push(`${name}: no attributable high/critical advisory`);
    continue;
  }
  for (const url of urls) {
    seenAdvisories.add(url);
    const exception = allowedAdvisories.get(url);
    if (!exception) rejected.push(`${name}: ${url} is not allowlisted`);
    else if (now > exception.expires) rejected.push(`${name}: ${url} exception expired ${exception.expires}`);
  }
}

if (rejected.length > 0) {
  console.error("Dependency audit found unapproved high/critical vulnerabilities:");
  for (const reason of rejected) console.error(`- ${reason}`);
  process.exit(1);
}

console.warn("Dependency audit passed with a temporary, exact development-only exception:");
for (const url of [...seenAdvisories].sort()) {
  const exception = allowedAdvisories.get(url);
  console.warn(`- ${url} (expires ${exception.expires}): ${exception.reason}`);
}
console.warn(
  `Affected development packages reported by npm: ${affected
    .map(([name]) => name)
    .sort()
    .join(", ")}`
);
