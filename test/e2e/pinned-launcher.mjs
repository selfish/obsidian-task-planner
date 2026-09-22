import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import ObsidianLauncher from "obsidian-launcher";

// Preparation rehashes the locked archives and rebuilds these paths on every run.
// Do not let the launcher's cache-miss behavior fetch an unverified replacement.
export class PinnedLauncher extends ObsidianLauncher {
  constructor({ root, appVersion, installerVersion }) {
    const cacheDir = path.join(root, ".obsidian-cache");
    super({ cacheDir, versionsUrl: pathToFileURL(path.join(cacheDir, "pinned-versions.json")).href });
    this.root = root;
    this.appVersion = appVersion;
    this.installerVersion = installerVersion;
  }

  async preparedPath(kind, version) {
    const runtimeKey = `${this.appVersion}/${this.installerVersion}`;
    const lock = JSON.parse(await fs.readFile(path.join(this.root, "test/e2e/runtime-lock.json"), "utf8"));
    const report = JSON.parse(await fs.readFile(path.join(this.root, "artifacts/e2e/runtime-preparation.json"), "utf8"));
    const runtime = lock.runtimes[runtimeKey];
    if (
      !runtime ||
      lock.platform !== "linux-x64" ||
      process.platform !== "linux" ||
      process.arch !== "x64" ||
      report.status !== "verified" ||
      report.runtime !== runtimeKey ||
      report.platform !== lock.platform ||
      ["app", "installer"].some((key) => report[key]?.version !== runtime[key].version || report[key]?.sha256 !== runtime[key].sha256) ||
      version !== runtime[kind].version
    ) {
      throw new Error(`Runtime ${runtimeKey} was not prepared from the current lock`);
    }
    const file = kind === "app" ? path.join(this.cacheDir, "obsidian-app", `obsidian-${version}.asar`) : path.join(this.cacheDir, "obsidian-installer/linux-x64", `Obsidian-${version}`, "obsidian");
    if (!(await fs.stat(file)).isFile()) throw new Error(`Prepared runtime is not a file: ${file}`);
    return file;
  }

  async downloadApp(version) {
    return this.preparedPath("app", version);
  }

  async downloadInstaller(version, { platform = process.platform, arch = process.arch } = {}) {
    if (platform !== "linux" || arch !== "x64") throw new Error("Pinned runtime supports linux-x64 only");
    return this.preparedPath("installer", version);
  }
}
