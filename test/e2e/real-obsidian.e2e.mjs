import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "manifest.json"), "utf8"));

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function loadPlugin() {
  return browser.executeObsidian(async ({ app }) => {
    let loadError;
    if (!app.plugins.plugins["task-planner"]) {
      try {
        await app.plugins.loadPlugin("task-planner");
      } catch (error) {
        loadError = error?.stack ?? error?.message ?? String(error);
      }
    }
    const plugin = app.plugins.plugins["task-planner"];
    return {
      pluginPresent: Boolean(plugin),
      enabled: app.plugins.enabledPlugins.has("task-planner"),
      manifestVersion: plugin?.manifest?.version,
      hasVaultProcess: typeof app.vault.process === "function",
      loadError,
    };
  });
}

async function waitForTaskCount(count) {
  await browser.waitUntil(() => browser.executeObsidian(({ plugins }, expected) => plugins.taskPlanner.taskIndex.tasks.length === expected, count), { timeout: 15000, timeoutMsg: `Task Planner did not index ${count} tasks` });
}

describe("real Obsidian vault smoke", function () {
  it("loads the exact built plugin in a copied synthetic vault", async function () {
    const installedMain = path.join(obsidianPage.getVaultPath(), ".obsidian", "plugins", "task-planner", "main.js");
    expect(sha256(installedMain)).toEqual(sha256(path.join(PROJECT_ROOT, "main.js")));

    const loaded = await loadPlugin();
    expect(loaded).toEqual(
      expect.objectContaining({
        pluginPresent: true,
        enabled: true,
        manifestVersion: MANIFEST.version,
        hasVaultProcess: true,
        loadError: null,
      })
    );
    await waitForTaskCount(1);
  });

  it("atomically relocates a stale UI task and preserves unrelated CRLF bytes", async function () {
    await browser.executeObsidian(({ app, plugins }) => {
      plugins.taskPlanner.settings.customHorizons = [
        { label: "Initial", date: "2026-08-02", position: "end" },
        { label: "E2E", date: "2026-08-09", tag: "e2e", color: "accent", position: "end" },
      ];
      app.saveLocalStorage("TaskPlanner.PlanningSettings", JSON.stringify({ hideEmpty: false }));
    });
    await browser.executeObsidianCommand("task-planner:open-planning");
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector('[aria-label^="Task: Target"] .checkbox'))), { timeout: 15000, timeoutMsg: "Target task checkbox was not rendered" });

    const result = await browser.executeObsidian(async ({ app }) => {
      const staleCheckbox = document.querySelector('[aria-label^="Task: Target"] .checkbox');
      const file = app.vault.getAbstractFileByPath("Tasks.md");
      await app.vault.process(file, (text) => `Inserted\r\n${text}`);

      app.vault.__e2eProcessCalls = 0;
      const originalProcess = app.vault.process;
      app.vault.process = async function (...args) {
        this.__e2eProcessCalls += 1;
        return originalProcess.apply(this, args);
      };

      staleCheckbox.click();
      return { staleNodeWasConnected: staleCheckbox.isConnected };
    });
    expect(result.staleNodeWasConnected).toEqual(true);

    const completedPattern = /^Inserted\r\n-   \[x\]\tTarget \(due:: 2026-08-02\) \[owner:: Alice\] ⏳ 2026-08-02 \[completed:: \d{4}-\d{2}-\d{2}\]\r\n  continuation \[note:: keep\]\r\n\r\n    loose continuation \(owner:: Bob\)\r\nUnrelated\r\n$/;
    await browser.waitUntil(() => obsidianPage.read("Tasks.md").then((text) => completedPattern.test(text)), {
      timeout: 15000,
      timeoutMsg: "stale status mutation did not preserve the synthetic file",
    });
    expect(await browser.executeObsidian(({ app }) => app.vault.__e2eProcessCalls)).toEqual(1);
  });

  it("moves through a dated/tagged horizon and supports UI undo", async function () {
    await browser.waitUntil(() => browser.execute(() => [...document.querySelectorAll(".column")].some((column) => column.querySelector(".title")?.textContent === "E2E")), { timeout: 15000, timeoutMsg: "custom E2E horizon was not rendered" });

    const drag = await browser.execute(() => {
      const card = document.querySelector('[aria-label^="Task: Target"]');
      const column = [...document.querySelectorAll(".column")].find((candidate) => candidate.querySelector(".title")?.textContent === "E2E");
      const target = column?.querySelector(":scope > .content");
      const dataTransfer = new DataTransfer();
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
      return {
        taskId: dataTransfer.getData("application/x-task-id"),
        targetTitle: column?.querySelector(".title")?.textContent,
      };
    });
    expect(drag.targetTitle).toEqual("E2E");
    expect(drag.taskId).not.toEqual("");

    const movedPattern = /-   \[ \]\tTarget #e2e \(due:: 2026-08-09\) \[owner:: Alice\] ⏳ 2026-08-02/;
    await browser.waitUntil(() => obsidianPage.read("Tasks.md").then((text) => movedPattern.test(text)), {
      timeout: 15000,
      timeoutMsg: "date/tag drag mutation did not reach the vault",
    });

    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector(".th-undo-toast-button"))), { timeout: 5000, timeoutMsg: "undo toast was not rendered after date/tag move" });
    await browser.execute(() => document.querySelector(".th-undo-toast-button").click());
    await browser.waitUntil(() => obsidianPage.read("Tasks.md").then((text) => !text.includes("#e2e") && !text.includes("(due:: 2026-08-09)")), {
      timeout: 15000,
      timeoutMsg: "UI undo did not restore the date/tag mutation",
    });
    expect(await obsidianPage.read("Tasks.md")).toMatch(/-   \[x\]\tTarget \(due:: 2026-08-02\)/);
  });

  it("fails closed when duplicate source lines are ambiguous", async function () {
    const duplicateText = "- [ ] Duplicate\r\n- [ ] Duplicate\r\n";
    await browser.executeObsidian(async ({ app }, text) => {
      await app.vault.create("Duplicates.md", text);
    }, duplicateText);
    await waitForTaskCount(3);

    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector('[aria-label^="Task: Duplicate"] .checkbox'))), { timeout: 15000, timeoutMsg: "duplicate task was not rendered" });
    await browser.executeObsidian(({ app }) => {
      const originalProcess = app.vault.process.bind(app.vault);
      window.__taskPlannerE2eProcessFinished = 0;
      app.vault.process = async (...args) => {
        try {
          return await originalProcess(...args);
        } finally {
          window.__taskPlannerE2eProcessFinished += 1;
        }
      };
    });
    await browser.execute(() => document.querySelector('[aria-label^="Task: Duplicate"] .checkbox').click());
    await browser.waitUntil(() => browser.execute(() => window.__taskPlannerE2eProcessFinished > 0), {
      timeout: 15000,
      timeoutMsg: "ambiguous mutation did not finish its atomic process attempt",
    });

    expect(await obsidianPage.read("Duplicates.md")).toEqual(duplicateText);
  });
});
