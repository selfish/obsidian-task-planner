import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { versionMetadata } from "../../scripts/e2e-runtime-metadata.mjs";
import { PinnedLauncher } from "./pinned-launcher.mjs";

const read = (file) => fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const lock = JSON.parse(read("test/e2e/runtime-lock.json"));

for (const [pair, runtime] of Object.entries(lock.runtimes)) {
  test(`pinned metadata resolves ${pair} without duplicate version records or network access`, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pinned-metadata-test-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const versions = versionMetadata(runtime);
    assert.equal(new Set(versions.map((record) => record.version)).size, versions.length);
    const app = versions.find((record) => record.version === runtime.app.version);
    const installer = versions.find((record) => record.version === runtime.installer.version);
    assert.ok(app.downloads.asar);
    assert.ok(installer.downloads.appImage);
    assert.equal(app.minInstallerVersion, runtime.app.minInstallerVersion);
    assert.equal(app.maxInstallerVersion, runtime.app.maxInstallerVersion);
    assert.equal(installer.installers.appImage.digest, `sha256:${runtime.installer.sha256}`);
    assert.equal(installer.electronVersion, runtime.installer.electron);
    assert.equal(installer.chromeVersion, runtime.installer.chrome);
    const metadataPath = path.join(root, ".obsidian-cache/pinned-versions.json");
    fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
    fs.writeFileSync(metadataPath, JSON.stringify({ metadata: { schemaVersion: "2.2.0" }, versions }));
    t.mock.method(globalThis, "fetch", () => {
      throw new Error("Unexpected network fallback");
    });
    const launcher = new PinnedLauncher({ root, appVersion: runtime.app.version, installerVersion: runtime.installer.version });
    assert.deepEqual(await launcher.resolveVersion(runtime.app.version, runtime.installer.version), [runtime.app.version, runtime.installer.version]);
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}

test("gates the unchanged public floor and current public installer/app pair", () => {
  const current = lock.runtimes["1.15.1/1.15.1"];
  assert.ok(current, "The current-public app must use its current installer, not Electron 28");
  assert.equal(current.app.sha256, "3f6808c14204063349d5a7a59b9f2f637958063fa85eeebe767e13e06d314c0f");
  assert.equal(current.installer.sha256, "515ff49bb263d08841069adc46002dae94562e5041fb7762b3a1dcb7be10a51a");
  assert.equal(current.installer.electron, "43.8.9");
  assert.equal(current.app.minInstallerVersion, "1.15.1", "The lock admits only the independently tested current pair");
  assert.equal(current.app.maxInstallerVersion, "1.15.1");
  assert.equal(lock.runtimes["1.15.0/1.15.0"].app.sha256, "011c70f176e44f0b215597cf0d420bae424be73583f2cb0205d3e63a26a0aa40");
  assert.equal(lock.runtimes["1.15.0/1.15.0"].installer.sha256, "1dd8cfb593deaa644101bdb4df65b159ed7985993b6572dd25fd1363459e91cc");
  assert.equal(lock.runtimes["1.14.5/1.14.5"].app.sha256, "20544378d99335bd54f4f03d9bb4b8ba8e4dc68ac4b5072eed81cde53d33503b");
  assert.equal(lock.runtimes["1.14.5/1.14.5"].installer.sha256, "306815f60d15dea8610d72886ef5e50ef4b7e7185e952ffc3bb21bee1582d952");
  assert.equal(current.installer.chrome, "150.0.7871.250");
  assert.ok(lock.runtimes["1.13.4/1.5.8"]);
  assert.equal(lock.runtimes["1.14.4/1.14.4"].installer.sha256, "6362ddbeeeebb7bbccb48fae009572cf2284ef92f5c919c1332aba48de6ffeaa", "Previous current-public installer remains reproducible");
  assert.equal(lock.runtimes["1.14.4/1.14.4"].app.sha256, "d1ed428c363968774f0f3906e67d8a53a058ece0b6cdd924b07865977b2ada21");
  assert.ok(lock.runtimes["1.8.7/1.5.8"], "Historical reproduction pins remain available");
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /obsidian: '1\.13\.4'\s+installer: '1\.5\.8'/);
  assert.match(ci, /obsidian: '1\.15\.1'\s+installer: '1\.15\.1'/);
  assert.equal(JSON.parse(read("manifest.json")).minAppVersion, "1.13.4");
});

test("preparation, launch and identity defaults select the same current public pair", () => {
  for (const file of ["scripts/prepare-e2e-runtime.mjs", "test/e2e/cdp-harness.mjs", "test/e2e/real-obsidian.e2e.mjs", "test/e2e/completion-coexistence.e2e.mjs"]) {
    const source = read(file);
    assert.match(source, /OBSIDIAN_VERSION \?\? "1\.15\.1"/);
    assert.match(source, /OBSIDIAN_INSTALLER_VERSION \?\? "1\.15\.1"/);
  }
  for (const file of ["test/e2e/real-obsidian.e2e.mjs", "test/e2e/completion-coexistence.e2e.mjs", "test/e2e/rtl.e2e.mjs"]) {
    assert.match(read(file), /artifacts\/calendar-\$\{process\.env\.OBSIDIAN_VERSION \?\? "1\.15\.1"\}/);
  }
  assert.match(JSON.parse(read("package.json")).scripts["test:e2e"], /current-runtime\.test\.mjs/);
});
