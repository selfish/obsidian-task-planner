import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const read = (file) => fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const lock = JSON.parse(read("test/e2e/runtime-lock.json"));

test("gates the unchanged public floor and current public installer/app pair", () => {
  const current = lock.runtimes["1.14.5/1.14.5"];
  assert.ok(current, "The current-public app must use its current installer, not Electron 28");
  assert.equal(current.app.sha256, "20544378d99335bd54f4f03d9bb4b8ba8e4dc68ac4b5072eed81cde53d33503b");
  assert.equal(current.installer.sha256, "306815f60d15dea8610d72886ef5e50ef4b7e7185e952ffc3bb21bee1582d952");
  assert.equal(current.installer.electron, "43.8.3");
  assert.equal(current.installer.chrome, "150.0.7871.250");
  assert.ok(lock.runtimes["1.13.4/1.5.8"]);
  assert.equal(lock.runtimes["1.14.4/1.14.4"].installer.sha256, "6362ddbeeeebb7bbccb48fae009572cf2284ef92f5c919c1332aba48de6ffeaa", "Previous current-public installer remains reproducible");
  assert.equal(lock.runtimes["1.14.4/1.14.4"].app.sha256, "d1ed428c363968774f0f3906e67d8a53a058ece0b6cdd924b07865977b2ada21");
  assert.ok(lock.runtimes["1.8.7/1.5.8"], "Historical reproduction pins remain available");
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /obsidian: '1\.13\.4'\s+installer: '1\.5\.8'/);
  assert.match(ci, /obsidian: '1\.14\.5'\s+installer: '1\.14\.5'/);
  assert.equal(JSON.parse(read("manifest.json")).minAppVersion, "1.13.4");
});

test("preparation, launch and identity defaults select the same current public pair", () => {
  for (const file of ["scripts/prepare-e2e-runtime.mjs", "test/e2e/cdp-harness.mjs", "test/e2e/real-obsidian.e2e.mjs", "test/e2e/completion-coexistence.e2e.mjs"]) {
    const source = read(file);
    assert.match(source, /OBSIDIAN_VERSION \?\? "1\.14\.5"/);
    assert.match(source, /OBSIDIAN_INSTALLER_VERSION \?\? "1\.14\.5"/);
  }
  for (const file of ["test/e2e/real-obsidian.e2e.mjs", "test/e2e/completion-coexistence.e2e.mjs", "test/e2e/rtl.e2e.mjs"]) {
    assert.match(read(file), /artifacts\/calendar-\$\{process\.env\.OBSIDIAN_VERSION \?\? "1\.14\.5"\}/);
  }
  assert.match(JSON.parse(read("package.json")).scripts["test:e2e"], /current-runtime\.test\.mjs/);
});
