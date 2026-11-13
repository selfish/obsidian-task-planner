import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { versionMetadata } from "./e2e-runtime-metadata.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const lockPath = path.join(root, "test/e2e/runtime-lock.json");
const downloadDir = path.join(root, ".obsidian-downloads");
const runtimeCacheDir = path.join(root, ".obsidian-cache");
const artifactDir = path.join(root, "artifacts/e2e");
const metadataPath = path.join(runtimeCacheDir, "pinned-versions.json");

const appVersion = process.env.OBSIDIAN_VERSION ?? "1.15.1";
const installerVersion = process.env.OBSIDIAN_INSTALLER_VERSION ?? "1.15.1";
const runtimeKey = `${appVersion}/${installerVersion}`;

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function verifiedDownload(artifact) {
  const filename = path.basename(new URL(artifact.url).pathname);
  const destination = path.join(downloadDir, `${artifact.sha256}-${filename}`);

  try {
    const actual = await sha256(destination);
    if (actual === artifact.sha256) return destination;
    await fs.rm(destination, { force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const temporary = `${destination}.${process.pid}.tmp`;
  await fs.rm(temporary, { force: true });
  const response = await fetch(artifact.url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`Download failed for ${artifact.url}: HTTP ${response.status}`);

  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: "wx" }));
    const actual = await sha256(temporary);
    if (actual !== artifact.sha256) throw new Error(`SHA-256 mismatch for ${filename}: expected ${artifact.sha256}, received ${actual}`);
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }

  return destination;
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
  });
}

async function materializeRuntime(runtime, appArchive, installerArchive) {
  const appPath = path.join(runtimeCacheDir, "obsidian-app", `obsidian-${runtime.app.version}.asar`);
  const installerDir = path.join(runtimeCacheDir, "obsidian-installer/linux-x64", `Obsidian-${runtime.installer.version}`);
  await fs.mkdir(path.dirname(appPath), { recursive: true });
  await fs.mkdir(installerDir, { recursive: true });

  await pipeline(createReadStream(appArchive), createGunzip(), createWriteStream(appPath, { flags: "wx" }));

  const sevenZipScript = path.join(root, "node_modules/obsidian-launcher/dist/7z.js");
  await run(process.execPath, [sevenZipScript, "x", "-o.", path.relative(installerDir, installerArchive)], { cwd: installerDir });

  const installerExecutable = path.join(installerDir, "obsidian");
  await Promise.all([fs.access(installerExecutable), fs.access(appPath)]);
  await fs.chmod(installerExecutable, 0o755);
}

async function writeReport(report) {
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(path.join(artifactDir, "runtime-preparation.json"), `${JSON.stringify(report, null, 2)}\n`);
}

async function main() {
  await fs.rm(artifactDir, { recursive: true, force: true });
  await fs.mkdir(downloadDir, { recursive: true });
  await writeReport({ status: "preparing", runtime: runtimeKey });

  if (process.platform !== "linux" || process.arch !== "x64") throw new Error(`Pinned E2E runtimes support linux-x64, not ${process.platform}-${process.arch}`);

  const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
  if (lock.schemaVersion !== 1 || lock.platform !== "linux-x64") throw new Error("Unsupported E2E runtime lock format");
  const runtime = lock.runtimes[runtimeKey];
  if (!runtime) throw new Error(`Runtime ${runtimeKey} is not pinned in ${path.relative(root, lockPath)}`);

  const [appArchive, installerArchive] = await Promise.all([verifiedDownload(runtime.app), verifiedDownload(runtime.installer)]);

  // Never execute restored cache contents. Rebuild executable runtime paths from
  // the independently verified archives on every invocation.
  await fs.rm(runtimeCacheDir, { recursive: true, force: true });
  await fs.mkdir(runtimeCacheDir, { recursive: true });
  await materializeRuntime(runtime, appArchive, installerArchive);
  await fs.writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        metadata: {
          schemaVersion: "2.2.0",
          commitDate: "1970-01-01T00:00:00Z",
          commitSha: lock.provenance.sourceCommit,
          timestamp: "1970-01-01T00:00:00.000Z",
        },
        versions: versionMetadata(runtime),
      },
      null,
      2
    )}\n`
  );

  await writeReport({
    status: "verified",
    runtime: runtimeKey,
    platform: lock.platform,
    app: { version: runtime.app.version, sha256: runtime.app.sha256 },
    installer: { version: runtime.installer.version, sha256: runtime.installer.sha256 },
  });
}

try {
  await main();
} catch (error) {
  await writeReport({ status: "failed", runtime: runtimeKey, error: error instanceof Error ? error.message : String(error) });
  throw error;
}
