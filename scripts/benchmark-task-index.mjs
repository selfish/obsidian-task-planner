// Run: node scripts/benchmark-task-index.mjs [baseline git ref]
// Synthetic cold-cache flattening, not end-to-end vault or UI latency.
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import assert from "node:assert/strict";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const source = "src/core/index/task-index.ts";
const baseline = process.argv[2];
function load(ref) {
  const options = ref ? { stdin: { contents: execFileSync("git", ["show", `${ref}:${source}`], { cwd: root, encoding: "utf8" }), resolveDir: path.join(root, "src/core/index"), loader: "ts" } } : { entryPoints: [path.join(root, source)] };
  const output = buildSync({ ...options, bundle: true, platform: "node", format: "cjs", write: false }).outputFiles[0].text;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, createRequire(import.meta.url));
  return module.exports.TaskIndex;
}
const versions = [...(baseline ? [[baseline, load(baseline)]] : []), ["working-tree", load()]];
for (const [files, perFile] of [
  [1000, 5],
  [5000, 5],
  [10000, 5],
  [1, 150000],
]) {
  const fixture = Array.from({ length: files }, (_, i) => ({ file: { id: String(i) }, tasks: Array.from({ length: perFile }, (_, j) => ({ id: i * perFile + j })) }));
  for (const [version, Index] of versions) {
    const index = new Index({}, {});
    index.files = fixture;
    const times = [];
    for (let trial = 0; trial < 9; trial++) {
      index._tasksCache = null;
      const start = performance.now();
      const tasks = index.tasks;
      const elapsed = performance.now() - start;
      assert.equal(tasks.length, files * perFile);
      assert.equal(tasks[0], fixture[0].tasks[0]);
      assert.equal(index.tasks, tasks);
      if (trial >= 2) times.push(elapsed);
    }
    times.sort((a, b) => a - b);
    console.log(JSON.stringify({ version, files, tasks: files * perFile, medianMs: Number(times[3].toFixed(3)) }));
  }
}
