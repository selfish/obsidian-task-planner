import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { browser, captureFailure, obsidianPage, startObsidian, stopObsidian } from "./cdp-harness.mjs";
import { ROOT, digest, prepareSiblingPlugins, siblingLock } from "./sibling-plugins.mjs";

const fixtures = JSON.parse(await fs.readFile(new URL("./completion-fixtures.json", import.meta.url), "utf8"));
const fixturePath = "Completion coexistence.md";
const contents = fixtures.map(({ line }) => line).join("\n") + "\n";
const evidence = {};

async function snapshot() {
  return browser.executeObsidian(({ plugins }, file) => {
    const page = plugins.dataview.api.page(file);
    const tasks = plugins.obsidianTasksPlugin.getTasks().filter((task) => task.path === file);
    return {
      dataview: page?.file.tasks.array().map((task) => ({ completed: task.completed, completion: task.completion?.toISODate() ?? null })) ?? [],
      tasks: tasks.map((task) => ({ completed: task.status.symbol === "x", completion: task.doneDate?.format("YYYY-MM-DD") ?? null, serialized: task.toFileLineString() })),
      planner: plugins.taskPlanner.taskIndex.tasks.filter((task) => task.file.path === file).map((task) => ({ status: task.status, attributes: task.attributes, sourceLine: task.sourceLine })),
    };
  }, fixturePath);
}

async function waitForIndexes() {
  await browser.waitUntil(
    async () => {
      const actual = await snapshot();
      return [actual.dataview, actual.tasks, actual.planner].every((list) => list.length === fixtures.length);
    },
    { timeout: 30000, timeoutMsg: "Sibling plugins did not index completion fixtures" }
  );
}

describe("released sibling completion-field coexistence", function () {
  before(async () => {
    await startObsidian({ plugins: await prepareSiblingPlugins() });
    await browser.waitUntil(() => browser.executeObsidian(({ plugins }) => Boolean(plugins.dataview?.api && plugins.obsidianTasksPlugin)), { timeout: 15000 });
    await browser.executeObsidian(
      async ({ app }, file, text) => {
        await app.vault.create(file, text);
      },
      fixturePath,
      contents
    );
    try {
      await waitForIndexes();
    } catch (error) {
      console.log(JSON.stringify(await snapshot(), null, 2));
      await captureFailure();
      throw error;
    }
  });
  afterEach(async function () {
    if (this.currentTest?.state === "failed") await captureFailure();
  });
  after(() => stopObsidian());

  it("loads the digest-pinned official assets alongside the exact Task Planner build", async () => {
    for (const [id, lock] of Object.entries(siblingLock)) {
      for (const [name, expected] of Object.entries(lock.assets)) {
        assert.equal(digest(await fs.readFile(path.join(obsidianPage.getVaultPath(), ".obsidian/plugins", id, name))), expected);
      }
      assert.equal(await browser.executeObsidian(({ app }, pluginId) => app.plugins.plugins[pluginId].manifest.version, id), lock.manifestVersion);
    }
    evidence.bundleSha256 = {};
    for (const name of ["main.js", "manifest.json", "styles.css"]) {
      const sha256 = digest(await fs.readFile(path.join(ROOT, name)));
      assert.equal(digest(await fs.readFile(path.join(obsidianPage.getVaultPath(), ".obsidian/plugins/task-planner", name))), sha256);
      evidence.bundleSha256[name] = sha256;
    }
    evidence.runtime = {
      ...(await browser.executeObsidian(({ obsidian }) => ({ app: obsidian.apiVersion, electron: process.versions.electron }))),
      selectedInstaller: process.env.OBSIDIAN_INSTALLER_VERSION ?? "1.14.5",
    };
    assert.equal(evidence.runtime.app, process.env.OBSIDIAN_VERSION ?? "1.14.5");
    assert.equal(await browser.executeObsidian(({ plugins }) => plugins.taskPlanner.settings.completedDateAttribute), "completed");
    assert.equal((await browser.executeObsidian(({ plugins }) => plugins.obsidianTasksPlugin.loadData())).taskFormat, "dataview");
  });

  it("records Boolean completion and actual selected dates for both field orders and syntaxes", async () => {
    const actual = await snapshot();
    assert.deepEqual(
      actual.dataview,
      fixtures.map((f) => ({ completed: f.completed, completion: f.dataviewDate }))
    );
    assert.deepEqual(
      actual.tasks.map(({ completed, completion }) => ({ completed, completion })),
      fixtures.map((f) => ({ completed: f.completed, completion: f.tasksDate }))
    );
    // The unchanged legacy field blocks Tasks' end-to-start serializer when last.
    for (const [index, fixture] of fixtures.entries()) {
      assert.equal(actual.planner[index].sourceLine, fixture.line);
      assert.equal(actual.planner[index].attributes.unknown, "keep");
      if (fixture.id.includes("first")) {
        assert.equal(actual.planner[index].attributes.completed, "2026-10-08");
        assert.equal(actual.planner[index].attributes.completion, "2026-10-09");
        assert.ok(actual.tasks[index].serialized.includes(fixture.line.includes("(completed") ? "(completed:: 2026-10-08)" : "[completed:: 2026-10-08]"));
      }
    }
    assert.equal(await obsidianPage.read(fixturePath), contents);
    evidence.dataviewFormat = actual;
  });

  it("keeps Tasks emoji format separate and serializes canonical done dates only in the selected format", async () => {
    const canonical = fixtures.findIndex((f) => f.id === "canonical");
    assert.match(evidence.dataviewFormat.tasks[canonical].serialized, /\[completion:: 2026-10-09\]/);
    await browser.executeObsidian(async ({ app, plugins }) => {
      const plugin = plugins.obsidianTasksPlugin;
      await plugin.saveData({ ...(await plugin.loadData()), taskFormat: "tasksPluginEmoji" });
      await app.plugins.unloadPlugin("obsidian-tasks-plugin");
      await app.plugins.loadPlugin("obsidian-tasks-plugin");
    });
    await waitForIndexes();
    const actual = await snapshot();
    const emoji = fixtures.findIndex((f) => f.id === "emoji");
    assert.equal(actual.tasks[emoji].completion, "2026-10-10");
    assert.equal(actual.tasks[emoji].completed, true);
    assert.match(actual.tasks[emoji].serialized, /✅ 2026-10-10/);
    assert.equal(actual.tasks[canonical].completion, null);
    assert.deepEqual(actual.dataview, evidence.dataviewFormat.dataview);
    assert.equal(await obsidianPage.read(fixturePath), contents);
    evidence.emojiFormat = actual;
    const directory = path.join(ROOT, `artifacts/calendar-${process.env.OBSIDIAN_VERSION ?? "1.14.5"}`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "completion-coexistence.json"), JSON.stringify({ reviewedSha: process.env.REVIEWED_SHA ?? null, siblingLock, fixtures, ...evidence }, null, 2) + "\n");
  });
});
