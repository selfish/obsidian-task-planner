import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const siblingLock = JSON.parse(await fs.readFile(new URL("./sibling-plugins-lock.json", import.meta.url), "utf8"));
export const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// Download into non-executable quarantine; promote only digest-matching files.
export async function verifiedAsset(file, url, expected, fetchAsset = fetch) {
  try {
    if (digest(await fs.readFile(file)) === expected) return file;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const response = await fetchAsset(url);
  if (!response.ok || !response.body) throw new Error(`Sibling asset download failed: ${response.status} ${url}`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: "wx", mode: 0o600 }));
    assert.equal(digest(await fs.readFile(temporary)), expected, `Sibling asset digest mismatch: ${url}`);
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return file;
}

export async function prepareSiblingPlugins() {
  const stage = path.join(ROOT, "artifacts/e2e/sibling-plugins");
  // Rebuild executable staging on every run; only archive bytes can be reused.
  await fs.rm(stage, { recursive: true, force: true });
  const directories = [];
  for (const [id, lock] of Object.entries(siblingLock)) {
    const directory = path.join(stage, id);
    await fs.mkdir(directory, { recursive: true });
    for (const [name, sha256] of Object.entries(lock.assets)) {
      const url = `https://github.com/${lock.repository}/releases/download/${lock.releaseTag}/${name}`;
      const archive = path.join(ROOT, ".obsidian-downloads/siblings", sha256);
      const destination = path.join(directory, name);
      await fs.copyFile(await verifiedAsset(archive, url, sha256), destination);
      assert.equal(digest(await fs.readFile(destination)), sha256);
    }
    const manifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8"));
    assert.equal(manifest.id, id);
    assert.equal(manifest.version, lock.manifestVersion);
    if (id === "obsidian-tasks-plugin") {
      await fs.writeFile(path.join(directory, "data.json"), JSON.stringify({ taskFormat: "dataview", globalFilter: "#task", setDoneDate: true }));
    }
    directories.push(directory);
  }
  return directories;
}
