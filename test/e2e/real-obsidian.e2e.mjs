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

  it("renders flat native settings and persists validated controls without subpages", async function () {
    await browser.executeObsidian(({ app }) => {
      app.setting.open();
      app.setting.openTabById("task-planner");
    });
    const names = await browser.executeObsidian(({ app }) => [...app.setting.getCurrentPageEl().querySelectorAll(".setting-item-name")].map((el) => el.textContent.trim()));
    for (const name of ["Maximum horizons per column", "Destination", "Backlog", "Week starts on", "Due date attribute", "Undo history size", "Follow-up prefix"]) assert.ok(names.includes(name), `Missing native setting: ${name}`);
    for (const name of ["Essential", "Advanced"]) assert.ok(!names.includes(name), `Unexpected nested page: ${name}`);
    assert.equal(await browser.executeObsidian(({ app }) => app.setting.getCurrentPageEl().querySelectorAll("details, .th-settings-section").length), 0);
    await browser.executeObsidian(({ app }) => new Promise((resolve) => app.setting.getCurrentPageEl().win.requestAnimationFrame(() => app.setting.getCurrentPageEl().win.requestAnimationFrame(resolve))));
    await browser.saveSettingsScreenshot(path.resolve("artifacts/e2e/settings-native.png"));
    const setNumber = (name, value) => browser.executeObsidian(({ app }, label, next) => {
      const row = [...app.setting.getCurrentPageEl().querySelectorAll(".setting-item")].find((el) => el.querySelector(".setting-item-name")?.textContent.trim() === label);
      const input = row.querySelector("input");
      input.focus();
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
    }, name, value);
    await setNumber("Maximum horizons per column", 2);
    await browser.waitUntil(() => browser.executeObsidian(async ({ plugins }) => (await plugins.taskPlanner.loadData()).maxHorizonsPerColumn === 2), { timeout: 5000, timeoutMsg: "Native number control did not persist" });
    await setNumber("Maximum horizons per column", 1.5);
    await browser.waitUntil(() => browser.executeObsidian(({ app }) => app.setting.getCurrentPageEl().textContent.includes("Enter a whole number")), { timeout: 5000, timeoutMsg: "Invalid count did not show validation feedback" });
    assert.equal(await browser.executeObsidian(({ plugins }) => plugins.taskPlanner.settings.maxHorizonsPerColumn), 2);
    await setNumber("Maximum horizons per column", 0);
    await browser.waitUntil(() => browser.executeObsidian(async ({ plugins }) => (await plugins.taskPlanner.loadData()).maxHorizonsPerColumn === 0), { timeout: 5000 });
    await browser.executeObsidian(({ app }) => app.setting.close());
  });

  it("edits native collections as drafts, validates shortcuts, and reindexes exclusions immediately", async function () {
    const original = await browser.executeObsidian(({ app }) => {
      const s = app.plugins.plugins["task-planner"].settings;
      app.setting.open(); app.setting.openTabById("task-planner");
      return { customHorizons: structuredClone(s.customHorizons), shortcuts: structuredClone(s.atShortcutSettings.customShortcuts), folders: [...s.ignoredFolders] };
    });
    const action = (label) => browser.executeObsidian(({ app }, label) => {
      const root = app.setting.getCurrentPageEl();
      const element = [...root.querySelectorAll(".setting-item-name, button, [aria-label]")].find((el) => el.textContent.trim() === label || el.getAttribute("aria-label") === label);
      if (!element) throw new Error(`Missing action ${label}`);
      (element.matches(".setting-item-name") ? element.closest(".setting-item") : element).click();
    }, label);
    const editor = (fields = {}, button) => browser.executeObsidian(({ app }, fields, button) => {
      const docs = [document, app.setting.getCurrentPageEl().ownerDocument];
      const modal = docs.map((doc) => doc.querySelector(".task-planner-settings-editor")).find(Boolean);
      if (!modal) throw new Error("Collection editor did not open");
      for (const [label, value] of Object.entries(fields)) {
        const row = [...modal.querySelectorAll(".setting-item")].find((el) => el.querySelector(".setting-item-name")?.textContent === label);
        const input = row.querySelector("input, select");
        input.value = value;
        input.dispatchEvent(new input.win.Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      }
      if (button) [...modal.querySelectorAll("button")].find((el) => el.textContent === button).click();
      return modal.querySelector('[role="alert"]')?.textContent;
    }, fields, button);
    const state = () => browser.executeObsidian(async ({ app }) => await app.plugins.plugins["task-planner"].loadData());
    try {
      await action("Add custom horizon");
      await editor({ Name: "Cancelled milestone", Date: "2026-11-01" }, "Cancel");
      assert.deepEqual((await state()).customHorizons, original.customHorizons);
      await action("Add custom horizon");
      await editor({ Name: "Release milestone", Date: "2026-11-01", Tag: "launch", Position: "inline", Color: "blue" }, "Save");
      await browser.waitUntil(async () => (await state()).customHorizons.some((h) => h.label === "Release milestone"));
      await action("Release milestone");
      await editor({ Name: "Do not save" }, "Cancel");
      assert.equal((await state()).customHorizons.at(-1).label, "Release milestone");
      await action("Add custom shortcut");
      await editor({ Keyword: "bad-key", Attribute: "owner", Value: "team" }, "Save");
      await browser.waitUntil(async () => (await editor()).includes("keyword"));
      await editor({ Keyword: "high" }, "Save");
      await browser.waitUntil(async () => (await editor()).includes("reserved"));
      await editor({ Keyword: "reviewer" }, "Save");
      await browser.waitUntil(async () => (await state()).atShortcutSettings.customShortcuts.some((s) => s.keyword === "reviewer"));
      await browser.executeObsidian(async ({ app }) => {
        await app.vault.createFolder("ExcludeMe");
        await app.vault.create("ExcludeMe/Tasks.md", "- [ ] Exclusion live test\n");
      });
      await browser.waitUntil(async () => await browser.executeObsidian(({ app }) => app.plugins.plugins["task-planner"].taskIndex.tasks.some((task) => task.text.includes("Exclusion live test"))));
      await action("Add ignored folder");
      await editor({ Folder: "ExcludeMe" }, "Save");
      await browser.waitUntil(async () => await browser.executeObsidian(({ app }) => !app.plugins.plugins["task-planner"].taskIndex.tasks.some((task) => task.text.includes("Exclusion live test"))));
      assert.ok((await state()).ignoredFolders.includes("ExcludeMe"));
      assert.equal(await browser.executeObsidian(async ({ app }) => app.vault.read(app.vault.getAbstractFileByPath("ExcludeMe/Tasks.md"))), "- [ ] Exclusion live test\n");
    } catch (error) {
      console.error("Collection scenario failed before cleanup", error);
      throw error;
    } finally {
      await browser.executeObsidian(async ({ app }, original) => {
        const plugin = app.plugins.plugins["task-planner"];
        plugin.settings.customHorizons = original.customHorizons;
        plugin.settings.atShortcutSettings.customShortcuts = original.shortcuts;
        plugin.settings.ignoredFolders = original.folders;
        await plugin.saveSettings(); plugin.refreshPlanningViews();
        const file = app.vault.getAbstractFileByPath("ExcludeMe/Tasks.md");
        if (file) await app.vault.delete(file);
        app.setting.close();
      }, original);
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

  it("caps the actual stacked horizons, refreshes immediately, and keeps every horizon reachable", async function () {
    await browser.sendCommand("Emulation.setDeviceMetricsOverride", { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
    const measure = () => browser.execute(() => {
      const section = document.querySelector(".future-section");
      const stacks = {};
      const cards = [...section.querySelectorAll(":scope > .column")];
      for (const card of cards) {
        const key = Math.round(card.getBoundingClientRect().left);
        stacks[key] = (stacks[key] || 0) + 1;
      }
      return { max: Math.max(...Object.values(stacks)), count: cards.length, variable: getComputedStyle(section).getPropertyValue("--horizons-per-column").trim(), overflow: section.scrollWidth > section.clientWidth };
    });
    const count = (await measure()).count;
    assert.ok(count > 6);
    for (const cap of [1, 2, 3, 6]) {
      await browser.executeObsidian(async ({ app }, value) => {
        app.setting.openTabById("task-planner");
        await app.setting.activeTab.setControlValue("maxHorizonsPerColumn", value);
      }, cap);
      await browser.waitUntil(async () => (await measure()).variable === String(cap), { timeout: 5000 });
      const geometry = await measure();
      assert.ok(geometry.max <= cap, JSON.stringify({ cap, geometry }));
      assert.equal(geometry.count, count);
      if (cap <= 2) assert.ok(geometry.overflow);
      if (cap === 2) await browser.saveScreenshot(path.resolve("artifacts/e2e/horizon-cap-two.png"));
    }
    await browser.executeObsidian(async ({ app }) => {
      await app.setting.activeTab.setControlValue("maxHorizonsPerColumn", 0);
      app.setting.close();
    });
    await browser.waitUntil(async () => (await measure()).variable === "2", { timeout: 5000 });
    await browser.sendCommand("Emulation.setDeviceMetricsOverride", { width: 1024, height: 700, deviceScaleFactor: 1, mobile: false });
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
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector('.task-planner-due-date-suggest input[type="date"]'))), { timeout: 5000, timeoutMsg: "inline @date picker did not open" });
    fs.mkdirSync(path.join(PROJECT_ROOT, "artifacts/e2e"), { recursive: true });
    await browser.saveScreenshot(path.join(PROJECT_ROOT, "artifacts/e2e/date-picker.png"));
    await browser.execute(() => {
      document.querySelector('.task-planner-due-date-suggest [aria-label="Next month"]').click();
      document.querySelector('.task-planner-due-date-suggest [data-date="2026-10-20"]').click();
      if (document.querySelector('.task-planner-due-date-suggest input').value !== "2026-10-20") throw new Error("Calendar click did not update the editable date");
      document.querySelector('.task-planner-due-date-suggest button[type="submit"]').click();
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

  it("finds the horizon cap through native search and restores it after a plugin reload", async function () {
    await browser.executeObsidian(({ app }) => { app.setting.open(); app.setting.openTabById("task-planner"); });
    await browser.executeObsidian(({ app }) => {
      const doc = app.setting.getCurrentPageEl().ownerDocument;
      const search = doc.querySelector('input[placeholder="Search settings..."]');
      if (!search) throw new Error("Native settings search input missing");
      search.value = "Maximum horizons per column";
      search.dispatchEvent(new search.win.Event("input", { bubbles: true }));
    });
    await browser.waitUntil(() => browser.executeObsidian(({ app }) => {
      const doc = app.setting.getCurrentPageEl().ownerDocument;
      return [...doc.querySelectorAll('[class*="search-result"]')].some((element) => element.textContent.includes("Maximum horizons per column"));
    }), { timeout: 5000, timeoutMsg: "Native search did not index the plugin setting" });
    await browser.saveSettingsScreenshot(path.resolve("artifacts/e2e/settings-search.png"));
    await browser.executeObsidian(async ({ app }) => {
      app.setting.close();
      const plugin = app.plugins.plugins["task-planner"];
      plugin.settings.maxHorizonsPerColumn = 2;
      await plugin.saveSettings();
      await app.plugins.unloadPlugin("task-planner");
      await app.plugins.loadPlugin("task-planner");
    });
    assert.equal(await browser.executeObsidian(({ app }) => app.plugins.plugins["task-planner"].settings.maxHorizonsPerColumn), 2);
    await browser.executeObsidian(async ({ app }) => {
      const plugin = app.plugins.plugins["task-planner"];
      plugin.settings.maxHorizonsPerColumn = 0;
      await plugin.saveSettings();
    });
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
