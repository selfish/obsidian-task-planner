import assert from "node:assert/strict";

import { browser, captureFailure, startObsidian, stopObsidian } from "./cdp-harness.mjs";

describe("view timer cleanup at the host lifecycle boundary", function () {
  beforeEach(() => startObsidian());
  afterEach(async function () {
    try {
      if (this.currentTest?.state === "failed") await captureFailure();
    } finally {
      await stopObsidian();
    }
  });

  it("cancels an active drag-scroll interval before plugin unload returns", async function () {
    await browser.executeObsidian(async ({ app }) => {
      await app.workspace.getLeaf("tab").setViewState({ type: "task-planner.planning" });
    });
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector(".future-section"))));
    // Passive setup must have run before dispatching the synthetic drag.
    await browser.execute(() => new Promise(resolve => setTimeout(resolve, 150)));
    const result = await browser.executeObsidian(async ({ app }) => {
      const board = document.querySelector(".board");
      const future = board.querySelector(".future-section");
      const win = board.ownerDocument.defaultView;
      const nativeSet = win.setInterval;
      const nativeClear = win.clearInterval;
      const active = new Set();
      win.setInterval = function (callback, delay, ...args) {
        const id = nativeSet.call(this, callback, delay, ...args);
        active.add(id);
        return id;
      };
      win.clearInterval = function (id) {
        active.delete(id);
        return nativeClear.call(this, id);
      };
      try {
        const rect = future.getBoundingClientRect();
        board.dispatchEvent(new win.DragEvent("dragover", {
          bubbles: true, cancelable: true, clientX: rect.right - 10,
          clientY: rect.top + 10, dataTransfer: new win.DataTransfer(),
        }));
        const duringDrag = active.size;
        await app.plugins.unloadPlugin("task-planner");
        return { duringDrag, afterUnload: active.size };
      } finally {
        for (const id of active) nativeClear.call(win, id);
        win.setInterval = nativeSet;
        win.clearInterval = nativeClear;
      }
    });
    assert.deepEqual(result, { duringDrag: 1, afterUnload: 0 });
  });

  it("does not rearm a closed report's midnight timer on immediate focus", async function () {
    await browser.executeObsidian(async ({ app }) => {
      const win = window;
      const nativeSet = win.setTimeout;
      const nativeClear = win.clearTimeout;
      const probe = { active: new Set(), callbacks: new Set(), schedules: 0 };
      win.setTimeout = function (callback, delay, ...args) {
        const now = new Date();
        const midnightDelay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 1;
        const tracked = probe.callbacks.has(callback) || Math.abs(delay - midnightDelay) < 100;
        const id = nativeSet.call(this, callback, delay, ...args);
        if (tracked) {
          probe.callbacks.add(callback);
          probe.active.add(id);
          probe.schedules++;
        }
        return id;
      };
      win.clearTimeout = function (id) {
        probe.active.delete(id);
        return nativeClear.call(this, id);
      };
      probe.restore = () => {
        for (const id of probe.active) nativeClear.call(win, id);
        win.setTimeout = nativeSet;
        win.clearTimeout = nativeClear;
        delete win.taskPlannerLifecycleProbe;
      };
      win.taskPlannerLifecycleProbe = probe;
      // Close startup views first, then observe only the new report's clock.
      for (const leaf of app.workspace.getLeavesOfType("task-planner.todo-list")) leaf.detach();
      await new Promise(resolve => nativeSet.call(win, resolve, 150));
      probe.active.clear();
      probe.callbacks.clear();
      probe.schedules = 0;
      await app.workspace.getLeaf("tab").setViewState({ type: "task-planner.report" });
    });
    try {
      await browser.waitUntil(() => browser.execute(() => window.taskPlannerLifecycleProbe.active.size === 1));
      const result = await browser.executeObsidian(async ({ app }) => {
        const probe = window.taskPlannerLifecycleProbe;
        const leaf = app.workspace.getLeavesOfType("task-planner.report")[0];
        await leaf.view.onClose();
        const afterClose = probe.active.size;
        const beforeFocus = probe.schedules;
        window.dispatchEvent(new Event("focus"));
        return { afterClose, afterFocus: probe.active.size, rearmed: probe.schedules - beforeFocus };
      });
      assert.deepEqual(result, { afterClose: 0, afterFocus: 0, rearmed: 0 });
    } finally {
      await browser.execute(() => window.taskPlannerLifecycleProbe.restore());
    }
  });
});
