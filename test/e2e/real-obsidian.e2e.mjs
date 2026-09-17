import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

import { browser, captureFailure, obsidianPage, startObsidian, stopObsidian } from "./cdp-harness.mjs";

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
      loadError: loadError ?? null,
    };
  });
}

async function waitForTaskCount(count) {
  await browser.waitUntil(() => browser.executeObsidian(({ plugins }, expected) => plugins.taskPlanner.taskIndex.tasks.length === expected, count), { timeout: 15000, timeoutMsg: `Task Planner did not index ${count} tasks` });
}

describe("real Obsidian vault smoke", function () {
  before(startObsidian);
  afterEach(async function () {
    if (this.currentTest?.state === "failed") await captureFailure();
  });
  after(async () => {
    await stopObsidian();
    await stopObsidian();
  });

  it("loads the exact built plugin in a copied synthetic vault", async function () {
    const installedMain = path.join(obsidianPage.getVaultPath(), ".obsidian", "plugins", "task-planner", "main.js");
    assert.equal(sha256(installedMain), sha256(path.join(PROJECT_ROOT, "main.js")));

    const loaded = await loadPlugin();
    assert.deepEqual(loaded, {
      pluginPresent: true,
      enabled: true,
      manifestVersion: MANIFEST.version,
      hasVaultProcess: true,
      loadError: null,
    });
    await waitForTaskCount(1);

    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector(".onboarding-modal .onboarding-secondary-btn"))), {
      timeout: 5000,
      timeoutMsg: "First-run onboarding was not rendered",
    });
    const onboardingAction = await browser.execute(() => {
      const button = document.querySelector(".onboarding-modal .onboarding-secondary-btn");
      const label = button?.textContent?.trim();
      button?.click();
      return label;
    });
    assert.equal(onboardingAction, "Skip");
    await browser.waitUntil(() => browser.executeObsidian(({ plugins }) => plugins.taskPlanner.settings.hasSeenOnboarding && !document.querySelector(".onboarding-modal")), {
      timeout: 5000,
      timeoutMsg: "First-run onboarding did not close",
    });
  });

  it("keeps the index current across ignored-folder renames", async function () {
    await browser.executeObsidian(async ({ app, plugins }) => {
      plugins.taskPlanner.settings.ignoreArchivedTasks = true;
      plugins.taskPlanner.settings.ignoredFolders = ["Archive"];
      await app.vault.createFolder("Archive");
      await app.vault.createFolder("Archive2");
      await app.vault.create("Archive/Hidden.md", "- [ ] Hidden\n");
      await app.vault.create("Archive2/Visible.md", "- [ ] Prefix sibling\n");
    });
    await waitForTaskCount(2);

    await browser.executeObsidian(async ({ app }) => {
      await app.vault.rename(app.vault.getAbstractFileByPath("Archive/Hidden.md"), "Restored.md");
    });
    await waitForTaskCount(3);

    await browser.executeObsidian(async ({ app }) => {
      await app.vault.rename(app.vault.getAbstractFileByPath("Restored.md"), "Archive/Restored.md");
      await app.vault.rename(app.vault.getAbstractFileByPath("Archive2/Visible.md"), "Archive/Visible.md");
    });
    await waitForTaskCount(1);
  });

  it("renders searchable settings through the current API with a legacy fallback", async function () {
    const isDeclarativeHost = await browser.executeObsidian(({ app }) => typeof app.setting.getCurrentPageEl === "function");
    const openedTabId = await browser.executeObsidian(({ app }) => {
      app.setting.openTabById("task-planner");
      return app.setting.activeTab?.id;
    });
    assert.equal(openedTabId, "task-planner");

    const getSettingNames = () =>
      browser.executeObsidian(({ app }) => {
        const root = app.setting.getCurrentPageEl?.() ?? app.setting.activeTab?.containerEl;
        return root ? [...root.querySelectorAll(".setting-item-name")].map((element) => element.textContent?.trim()) : [];
      });

    if (isDeclarativeHost) {
      await browser.waitUntil(
        async () => {
          const names = await getSettingNames();
          return ["Essential", "Horizons", "Advanced"].every((name) => names.includes(name));
        },
        { timeout: 15000, timeoutMsg: "Declarative settings pages were not rendered" }
      );
    } else {
      await browser.waitUntil(async () => (await getSettingNames()).includes("Destination"), {
        timeout: 15000,
        timeoutMsg: "Legacy settings fallback did not render",
      });
    }
  });

  it("atomically relocates a stale UI task and preserves unrelated CRLF bytes", async function () {
    await browser.executeObsidian(async ({ app, plugins }) => {
      plugins.taskPlanner.settings.customHorizons = [
        { label: "Initial", date: "2026-08-02", position: "end" },
        { label: "E2E", date: "2026-08-09", tag: "e2e", color: "accent", position: "end" },
      ];
      await app.vault.create("Priorities.md", "- [ ] High E2E [priority:: high] (due:: 2026-08-02)\n- [ ] Low E2E [priority:: low] (due:: 2026-08-02)\n");
      app.saveLocalStorage("TaskPlanner.PlanningSettings", JSON.stringify({ hideEmpty: false }));
    });
    await waitForTaskCount(3);
    await browser.executeObsidianCommand("task-planner:open-planning");
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector('[aria-label^="Task: Target"] .checkbox'))), { timeout: 15000, timeoutMsg: "Target task checkbox was not rendered" });

    const setPriorityFilter = (value) =>
      browser.execute((selectedPriority) => {
        const select = document.querySelector('select[aria-label="Filter by priority"]');
        select.value = selectedPriority;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return select.tagName;
      }, value);
    try {
      assert.equal(await setPriorityFilter("high"), "SELECT");
      await browser.waitUntil(() => browser.execute(() => document.querySelector(".board > .header .stats")?.textContent.includes("1 active")), {
        timeout: 5000,
        timeoutMsg: "priority selection did not reduce the active task count",
      });
    } finally {
      await setPriorityFilter("all");
    }
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".board > .header .stats")?.textContent.includes("3 active") && Boolean(document.querySelector('[aria-label^="Task: Target"] .checkbox'))), {
      timeout: 5000,
      timeoutMsg: "resetting priority filter did not restore all tasks",
    });

    const measureToolbar = async (width) => {
      await browser.sendCommand("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      return browser.execute(() => {
        const header = document.querySelector('.workspace-leaf-content[data-type="task-planner.planning"] .board > .header');
        const title = header?.querySelector(".title");
        const controls = header?.querySelector(".controls");
        const search = controls?.querySelector(".search");
        const priority = controls?.querySelector(".priority-filter");
        const rect = (element) => {
          const bounds = element?.getBoundingClientRect();
          return bounds ? { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width } : null;
        };
        return { header: rect(header), title: rect(title), controls: rect(controls), search: rect(search), priority: rect(priority), controlItems: [...(controls?.children ?? [])].map(rect) };
      });
    };

    const wideToolbar = await measureToolbar(1600);
    assert.ok(wideToolbar.controls.right >= wideToolbar.header.right - 2.5);
    assert.ok(Math.min(wideToolbar.title.bottom, wideToolbar.controls.bottom) - Math.max(wideToolbar.title.top, wideToolbar.controls.top) > 0);
    assert.ok(wideToolbar.search.width >= 200);
    assert.ok(wideToolbar.search.width < 250);

    const narrowToolbar = await measureToolbar(1024);
    assert.ok(narrowToolbar.controls.right >= narrowToolbar.header.right - 2.5);
    assert.ok(narrowToolbar.controls.width >= narrowToolbar.header.width - 4);
    assert.ok(narrowToolbar.search.width > wideToolbar.search.width);

    const mobileToolbar = await measureToolbar(640);
    assert.ok(mobileToolbar.controlItems.every((item) => item.left >= mobileToolbar.header.left - 2.5 && item.right <= mobileToolbar.header.right + 2.5));
    assert.ok(mobileToolbar.priority.width >= 130);

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
    assert.equal(result.staleNodeWasConnected, true);

    const completedPattern = /^Inserted\r\n-   \[x\]\tTarget \(due:: 2026-08-02\) \[owner:: Alice\] ⏳ 2026-08-02 \[completed:: \d{4}-\d{2}-\d{2}\]\r\n  continuation \[note:: keep\]\r\n\r\n    loose continuation \(owner:: Bob\)\r\nUnrelated\r\n$/;
    await browser.waitUntil(() => obsidianPage.read("Tasks.md").then((text) => completedPattern.test(text)), {
      timeout: 15000,
      timeoutMsg: "stale status mutation did not preserve the synthetic file",
    });
    assert.equal(await browser.executeObsidian(({ app }) => app.vault.__e2eProcessCalls), 1);
  });

  it("keeps overflowing horizons reachable with a visible native scrollbar", async function () {
    const setViewport = (width) =>
      browser.sendCommand("Emulation.setDeviceMetricsOverride", {
        width,
        height: 700,
        deviceScaleFactor: 1,
        mobile: false,
      });

    await setViewport(1024);
    const desktop = await browser.execute(async () => {
      const section = document.querySelector(".future-section");
      const style = getComputedStyle(section);
      const scrollbar = getComputedStyle(section, "::-webkit-scrollbar");
      section.scrollLeft = section.scrollWidth;
      await new Promise(requestAnimationFrame);
      const programmaticScrollLeft = section.scrollLeft;
      section.scrollLeft = 0;
      section.focus();
      return {
        ariaLabel: section.getAttribute("aria-label"),
        tabIndex: section.tabIndex,
        overflowX: style.overflowX,
        scrollbarWidth: style.scrollbarWidth,
        webkitDisplay: scrollbar.display,
        clientWidth: section.clientWidth,
        scrollWidth: section.scrollWidth,
        programmaticScrollLeft,
        focused: document.activeElement === section,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert.equal(desktop.overflowX, "auto");
    assert.ok(desktop.scrollWidth > desktop.clientWidth);
    assert.notEqual(desktop.scrollbarWidth, "none");
    assert.notEqual(desktop.webkitDisplay, "none");
    assert.equal(desktop.ariaLabel, "Future planning horizons");
    assert.equal(desktop.tabIndex, 0);
    assert.ok(desktop.programmaticScrollLeft > 0);
    assert.equal(desktop.focused, true);
    assert.ok(desktop.pageOverflow <= 1);

    await browser.executeObsidian(({ app }) => {
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
    });
    await setViewport(320);
    await browser.waitUntil(
      () =>
        browser.execute(() => {
          const viewportWidth = document.documentElement.clientWidth;
          const { left, right, width } = document.querySelector(".future-section").getBoundingClientRect();
          return width > 0 && left >= -1 && right <= viewportWidth + 1;
        }),
      { timeout: 5000, timeoutMsg: "Narrow planning layout did not settle after collapsing sidebars" }
    );
    const mobile = await browser.execute(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const futureSection = document.querySelector(".future-section").getBoundingClientRect();
      const controls = [...document.querySelectorAll(".board > .header button, .board > .header input, .board > .header select")].map((element) => element.getBoundingClientRect());
      return {
        viewportWidth,
        futureSection: { left: futureSection.left, right: futureSection.right, width: futureSection.width },
        controlCount: controls.length,
        pageOverflow: document.documentElement.scrollWidth - viewportWidth,
        sectionInsideViewport: futureSection.width > 0 && futureSection.left >= -1 && futureSection.right <= viewportWidth + 1,
        controlsInsideViewport: controls.every(({ left, right, width, height }) => left >= -1 && right <= viewportWidth + 1 && width > 0 && height > 0),
      };
    });
    assert.ok(mobile.pageOverflow <= 1);
    assert.ok(mobile.controlCount > 0, JSON.stringify(mobile));
    assert.equal(mobile.sectionInsideViewport, true, JSON.stringify(mobile));
    assert.equal(mobile.controlsInsideViewport, true, JSON.stringify(mobile));
    await setViewport(1024);
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
    assert.equal(drag.targetTitle, "E2E");
    assert.notEqual(drag.taskId, "");

    const movedPattern = /-   \[ \]\tTarget #e2e \(due:: 2026-08-09\) \[owner:: Alice\] ⏳ 2026-08-02/;
    await browser.waitUntil(() => obsidianPage.read("Tasks.md").then((text) => movedPattern.test(text)), {
      timeout: 15000,
      timeoutMsg: "date/tag drag mutation did not reach the vault",
    });

    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector(".th-undo-toast-button"))), { timeout: 5000, timeoutMsg: "undo toast was not rendered after date/tag move" });
    await browser.execute(() => document.querySelector(".th-undo-toast-button").click());
    await browser.waitUntil(() => obsidianPage.read("Tasks.md").then((text) => /-   \[x\]\tTarget \(due:: 2026-08-02\)/.test(text) && !text.includes("#e2e") && !text.includes("(due:: 2026-08-09)")), {
      timeout: 15000,
      timeoutMsg: "UI undo did not restore the date/tag mutation",
    });
    assert.match(await obsidianPage.read("Tasks.md"), /-   \[x\]\tTarget \(due:: 2026-08-02\)/);
  });

  it("fails closed when duplicate source lines are ambiguous", async function () {
    const duplicateText = "- [ ] Duplicate\r\n- [ ] Duplicate\r\n";
    await browser.executeObsidian(async ({ app }, text) => {
      await app.vault.create("Duplicates.md", text);
    }, duplicateText);
    await waitForTaskCount(5);

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

    assert.equal(await obsidianPage.read("Duplicates.md"), duplicateText);
  });

  it("edits a task due date through the native command with cancel, undo and custom fields", async function () {
    const original = "Before\n\t-   [ ]  Note task [[Link]] (deadline:: 2026-08-01) [owner:: me] #tag  \nAfter\n";
    await browser.executeObsidian(async ({ app, plugins }, text) => {
      app.setting.close();
      plugins.taskPlanner.settings.dueDateAttribute = "deadline";
      const file = await app.vault.create("Date editor.md", text);
      const leaf = app.workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode: "source" } });
      leaf.view.editor.setCursor({ line: 1, ch: 18 });
      leaf.view.editor.focus();
    }, original);
    await browser.executeObsidianCommand("task-planner:set-task-due-date");
    const initial = await browser.execute(() => document.querySelector('.task-planner-due-date input[type="date"]').value);
    assert.equal(initial, "2026-08-01");
    await browser.saveScreenshot("artifacts/e2e/due-date-desktop.png");
    await browser.sendCommand("Emulation.setDeviceMetricsOverride", { width: 360, height: 780, deviceScaleFactor: 1, mobile: false });
    await browser.saveScreenshot("artifacts/e2e/due-date-narrow.png");
    assert.equal(await browser.execute(() => {
      const modal = document.querySelector('.task-planner-due-date').closest('.modal').getBoundingClientRect();
      return modal.left >= 0 && modal.right <= window.innerWidth;
    }), true);
    await browser.sendCommand("Emulation.clearDeviceMetricsOverride");
    await browser.execute(() => [...document.querySelectorAll('.task-planner-due-date button')].find((button) => button.textContent === "Cancel").click());
    assert.equal(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getValue()), original);

    await browser.executeObsidianCommand("task-planner:set-task-due-date");
    await browser.execute(() => {
      document.querySelector('.task-planner-due-date input[type="date"]').value = "2026-10-20";
      document.querySelector('.task-planner-due-date button[type="submit"]').click();
    });
    const updated = original.replace("2026-08-01", "2026-10-20");
    assert.equal(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getValue()), updated);
    await browser.waitUntil(() => obsidianPage.read("Date editor.md").then((text) => text === updated));
    assert.deepEqual(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getCursor()), { line: 1, ch: 18 });
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
    assert.equal(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getValue()), original);
    await browser.waitUntil(() => obsidianPage.read("Date editor.md").then((text) => text === original));

    await browser.executeObsidianCommand("task-planner:set-task-due-date");
    await browser.execute(() => [...document.querySelectorAll('.task-planner-due-date button')].find((button) => button.textContent === "Remove date").click());
    const removed = original.replace(" (deadline:: 2026-08-01)", "");
    assert.equal(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getValue()), removed);
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
    await browser.executeObsidian(({ plugins }) => {
      plugins.taskPlanner.settings.dueDateAttribute = "due";
    });
  });

  it("opens @date through editor suggestions without adding a new task line", async function () {
    await browser.executeObsidian(async ({ app }) => {
      const file = await app.vault.create("Date suggestion.md", "- [ ] Review @high ");
      const leaf = app.workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode: "source" } });
      leaf.view.editor.setCursor({ line: 0, ch: leaf.view.editor.getLine(0).length });
      leaf.view.editor.focus();
    });
    await browser.sendCommand("Input.insertText", { text: "@date" });
    await browser.waitUntil(() => browser.execute(() => [...document.querySelectorAll('.suggestion-item')].some((item) => item.textContent.includes("Choose due date"))), { timeout: 5000, timeoutMsg: "@date suggestion did not open" });
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector('.task-planner-due-date'))));
    fs.mkdirSync(path.join(PROJECT_ROOT, "artifacts/e2e"), { recursive: true });
    await browser.saveScreenshot(path.join(PROJECT_ROOT, "artifacts/e2e/date-picker.png"));
    await browser.execute(() => {
      document.querySelector('.task-planner-due-date input').value = "2026-10-20";
      document.querySelector('.task-planner-due-date button[type="submit"]').click();
    });
    assert.equal(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getValue()), "- [ ] Review @high [due:: 2026-10-20]");
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
    assert.equal(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getValue()), "- [ ] Review @high @date");
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "Z", code: "KeyZ", modifiers: 10, windowsVirtualKeyCode: 90 });
    await browser.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Z", code: "KeyZ", modifiers: 10, windowsVirtualKeyCode: 90 });
    await browser.executeObsidianCommand("task-planner:complete-line");
    assert.equal(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getValue()), "- [ ] Review [priority:: high] [due:: 2026-10-20]");
  });

  it("refuses a stale picker write and leaves fenced examples unchanged", async function () {
    await browser.executeObsidianCommand("task-planner:set-task-due-date");
    const concurrent = await browser.executeObsidian(({ app }) => {
      const editor = app.workspace.activeEditor.editor;
      editor.replaceRange("Concurrent edit\n", { line: 0, ch: 0 });
      return editor.getValue();
    });
    await browser.execute(() => {
      document.querySelector('.task-planner-due-date input').value = "2026-12-25";
      document.querySelector('.task-planner-due-date button[type="submit"]').click();
    });
    assert.equal(await browser.executeObsidian(({ app }) => app.workspace.activeEditor.editor.getValue()), concurrent);
    assert.equal(await browser.execute(() => [...document.querySelectorAll('.notice')].some((notice) => notice.textContent.includes("note changed"))), true);
    await browser.executeObsidian(async ({ app }) => {
      const file = await app.vault.create("Date example.md", "```md\n- [ ] Example @date\n```\n");
      const leaf = app.workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode: "source" } });
      leaf.view.editor.setCursor({ line: 1, ch: 18 });
    });
    await browser.executeObsidianCommand("task-planner:set-task-due-date");
    assert.equal(await browser.execute(() => Boolean(document.querySelector('.task-planner-due-date'))), false);
    assert.equal(await obsidianPage.read("Date example.md"), "```md\n- [ ] Example @date\n```\n");
  });
});
