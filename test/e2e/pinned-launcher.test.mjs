import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { PinnedLauncher } from "./pinned-launcher.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pinned-launcher-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const appVersion = "1.13.7",
    installerVersion = "1.5.8";
  const runtime = { app: { version: appVersion, sha256: "app-digest" }, installer: { version: installerVersion, sha256: "installer-digest" } };
  const report = { status: "verified", platform: "linux-x64", runtime: `${appVersion}/${installerVersion}`, ...runtime };
  const reportPath = path.join(root, "artifacts/e2e/runtime-preparation.json");
  const appPath = path.join(root, ".obsidian-cache/obsidian-app", `obsidian-${appVersion}.asar`);
  const installerPath = path.join(root, ".obsidian-cache/obsidian-installer/linux-x64", `Obsidian-${installerVersion}`, "obsidian");
  for (const [file, data] of [
    [path.join(root, "test/e2e/runtime-lock.json"), JSON.stringify({ platform: "linux-x64", runtimes: { [report.runtime]: runtime } })],
    [reportPath, JSON.stringify(report)],
    [appPath, "test app"],
    [installerPath, "test installer"],
  ]) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected network fallback");
  });
  return { launcher: new PinnedLauncher({ root, appVersion, installerVersion }), report, reportPath, appVersion, installerVersion, appPath, installerPath };
}

test("uses prepared app and installer without network access", async (t) => {
  const f = await fixture(t);
  assert.equal(await f.launcher.downloadApp(f.appVersion), f.appPath);
  assert.equal(await f.launcher.downloadInstaller(f.installerVersion), f.installerPath);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

for (const kind of ["app", "installer"]) {
  test(`missing ${kind} fails closed without download`, async (t) => {
    const f = await fixture(t);
    await fs.rm(f[`${kind}Path`]);
    await assert.rejects(() => (kind === "app" ? f.launcher.downloadApp(f.appVersion) : f.launcher.downloadInstaller(f.installerVersion)), { code: "ENOENT" });
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}

for (const change of ["status", "runtime", "digest", "missing-report"]) {
  test(`rejects ${change} preparation`, async (t) => {
    const f = await fixture(t);
    if (change === "status") f.report.status = "preparing";
    if (change === "runtime") f.report.runtime = "1.13.4/1.5.8";
    if (change === "digest") f.report.app.sha256 = "stale-digest";
    if (change === "missing-report") await fs.rm(f.reportPath);
    else await fs.writeFile(f.reportPath, JSON.stringify(f.report));
    await assert.rejects(() => f.launcher.downloadApp(f.appVersion));
    await assert.rejects(() => f.launcher.downloadInstaller(f.installerVersion));
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}

test("rejects unpinned versions and unsupported platforms", async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.launcher.downloadApp("latest"));
  await assert.rejects(() => f.launcher.downloadInstaller("1.6.0"));
  await assert.rejects(() => f.launcher.downloadInstaller(f.installerVersion, { platform: "darwin" }));
  await assert.rejects(() => f.launcher.downloadInstaller(f.installerVersion, { arch: "arm64" }));
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test("upstream asset URL protection remains enabled", async (t) => {
  const f = await fixture(t);
  assert.throws(() => f.launcher.verifyUrl("https://invalid.invalid/untrusted.asar.gz"), /Invalid Obsidian asset url/);
  assert.doesNotThrow(() => f.launcher.verifyUrl("https://github.com/obsidianmd/obsidian-releases/releases/download/v1.13.7/obsidian-1.13.7.asar.gz"));
});
