import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const siblingLock = JSON.parse(await fs.readFile(new URL("./sibling-plugins-lock.json", import.meta.url), "utf8"));
export const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// Never execute a cached or downloaded sibling bundle without the committed digest.
export async function verifiedAsset(file, url, expected, fetchAsset = fetch) {
  let bytes;
  try {
    bytes = await fs.readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (bytes && digest(bytes) === expected) return bytes;
  const response = await fetchAsset(url);
  if (!response.ok) throw new Error(`Sibling asset download failed: ${response.status} ${url}`);
  bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(digest(bytes), expected, `Sibling asset digest mismatch: ${url}`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  return bytes;
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
      await fs.writeFile(path.join(directory, name), await verifiedAsset(archive, url, sha256));
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
