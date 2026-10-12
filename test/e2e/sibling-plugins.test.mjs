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
const response = (bytes) => async () => new Response(bytes);

async function assertVerified(file, fetchAsset) {
  assert.equal(await verifiedAsset(file, "fixture", sha256, fetchAsset), file);
  assert.deepEqual(await fs.readFile(file), expected);
  assert.deepEqual(await fs.readdir(path.dirname(file)), ["main.js"]);
}

test("verified cache avoids network access", () =>
  withFile(async (file) => {
    await fs.writeFile(file, expected);
    await assertVerified(file, () => {
      throw new Error("unexpected fetch");
    });
  }));

test("missing or corrupt cache is replaced only by digest-matching bytes", () =>
  withFile(async (file) => {
    await assertVerified(file, response(expected));
    await fs.writeFile(file, "corrupt");
    await assertVerified(file, response(expected));
  }));

test("mismatched downloaded bytes are rejected; quarantine is removed and cache untouched", () =>
  withFile(async (file) => {
    await assert.rejects(verifiedAsset(file, "fixture", sha256, response(Buffer.from("tampered"))), /digest mismatch/);
    assert.deepEqual(await fs.readdir(path.dirname(file)), []);
    await fs.writeFile(file, "corrupt");
    await assert.rejects(verifiedAsset(file, "fixture", sha256, response(Buffer.from("tampered"))), /digest mismatch/);
    assert.deepEqual(await fs.readdir(path.dirname(file)), ["main.js"]);
    assert.equal(await fs.readFile(file, "utf8"), "corrupt");
  }));

test("HTTP failures are rejected and never cached", () =>
  withFile(async (file) => {
    await assert.rejects(
      verifiedAsset(file, "fixture", sha256, async () => new Response(null, { status: 404 })),
      /download failed: 404/
    );
    assert.deepEqual(await fs.readdir(path.dirname(file)), []);
  }));

test("interrupted streams are rejected without leaving cache or quarantine", () =>
  withFile(async (file) => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(expected);
        controller.error(new Error("interrupted fixture stream"));
      },
    });
    await assert.rejects(
      verifiedAsset(file, "fixture", sha256, async () => new Response(body)),
      /interrupted fixture stream/
    );
    assert.deepEqual(await fs.readdir(path.dirname(file)), []);
  }));
