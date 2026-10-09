import assert from "node:assert/strict";

import { browser, captureFailure, startObsidian, stopObsidian } from "./cdp-harness.mjs";

describe("synchronous view subscription cleanup", function () {
  before(() => startObsidian());
  afterEach(async function () {
    if (this.currentTest?.state === "failed") await captureFailure();
  });
  after(() => stopObsidian());

  it("releases all three views before unload returns, without waiting for paint", async function () {
    // Startup restores Today Focus asynchronously after indexing the vault.
    // Let it finish instead of racing it with a second sidebar creation.
    await browser.waitUntil(() => browser.executeObsidian(({ app }) =>
      app.plugins.plugins["task-planner"].taskIndex.tasks.length === 1 &&
      app.workspace.getLeavesOfType("task-planner.todo-list").length === 1
    ), { timeoutMsg: "Initial Today Focus view did not finish loading" }).catch(async (error) => {
      const state = await browser.executeObsidian(({ app }) => ({
        tasks: app.plugins.plugins["task-planner"]?.taskIndex.tasks.length,
        leaves: app.workspace.getLeavesOfType("task-planner.todo-list").length,
      }));
      throw new Error(`${error.message}; state=${JSON.stringify(state)}`);
    });
    await browser.executeObsidian(async ({ app }) => {
      const types = ["task-planner.todo-list", "task-planner.report", "task-planner.planning"];
      for (const type of types) {
        if (!app.workspace.getLeavesOfType(type).length) {
          await app.workspace.getLeaf("tab").setViewState({ type });
        }
      }
    });
    await browser.waitUntil(() => browser.executeObsidian(({ app }) =>
      app.plugins.plugins["task-planner"].taskIndex.onUpdateEvent.handlers.length === 3
    ), { timeoutMsg: "Expected exactly one index subscription per mounted view" }).catch(async (error) => {
      const state = await browser.executeObsidian(({ app }) => ({
        handlers: app.plugins.plugins["task-planner"].taskIndex.onUpdateEvent.handlers.length,
        leaves: ["task-planner.todo-list", "task-planner.report", "task-planner.planning"].map(type => app.workspace.getLeavesOfType(type).length),
      }));
      throw new Error(`${error.message}; state=${JSON.stringify(state)}`);
    });

    const result = await browser.executeObsidian(async ({ app }) => {
      const plugin = app.plugins.plugins["task-planner"];
      const event = plugin.taskIndex.onUpdateEvent;
      for (const type of ["task-planner.todo-list", "task-planner.report", "task-planner.planning"]) {
        for (const leaf of app.workspace.getLeavesOfType(type)) {
          leaf.view.render();
          leaf.view.render();
        }
      }
      const before = event.handlers.length;
      await app.plugins.unloadPlugin("task-planner");
      // Do not poll or yield to requestAnimationFrame: cleanup must be complete
      // before the old index can deliver another notification after unload.
      const after = event.handlers.length;
      let callbacksAfterUnload = 0;
      for (const callback of event.handlers) {
        callbacksAfterUnload++;
        await callback(plugin.taskIndex.tasks);
      }
      return { before, after, callbacksAfterUnload };
    });
    assert.deepEqual(result, { before: 3, after: 0, callbacksAfterUnload: 0 });
  });
});
