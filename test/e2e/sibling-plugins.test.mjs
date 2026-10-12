import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { digest, verifiedAsset } from "./sibling-plugins.mjs";

async function withFile(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tp-sibling-"));
  try {
    await run(path.join(directory, "main.js"));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

const expected = Buffer.from("official fixture bundle");
const sha256 = digest(expected);
const response = (bytes) => async () => ({ ok: true, arrayBuffer: async () => bytes });

test("verified cache avoids network access", () =>
  withFile(async (file) => {
    await fs.writeFile(file, expected);
    assert.deepEqual(
      await verifiedAsset(file, "unused", sha256, () => {
        throw new Error("unexpected fetch");
      }),
      expected
    );
  }));

test("missing or corrupt cache is replaced only by digest-matching bytes", () =>
  withFile(async (file) => {
    assert.deepEqual(await verifiedAsset(file, "fixture", sha256, response(expected)), expected);
    await fs.writeFile(file, "corrupt");
    assert.deepEqual(await verifiedAsset(file, "fixture", sha256, response(expected)), expected);
    assert.deepEqual(await fs.readFile(file), expected);
  }));

test("mismatched downloaded bytes are rejected and never cached", () =>
  withFile(async (file) => {
    await assert.rejects(verifiedAsset(file, "fixture", sha256, response(Buffer.from("tampered"))), /digest mismatch/);
    await assert.rejects(fs.readFile(file), { code: "ENOENT" });
  }));

test("HTTP failures are rejected and never cached", () =>
  withFile(async (file) => {
    await assert.rejects(
      verifiedAsset(file, "fixture", sha256, async () => ({ ok: false, status: 404 })),
      /download failed: 404/
    );
    await assert.rejects(fs.readFile(file), { code: "ENOENT" });
  }));
