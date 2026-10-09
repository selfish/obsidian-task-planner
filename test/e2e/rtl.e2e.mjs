import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { browser, captureFailure, obsidianPage, startObsidian, stopObsidian } from "./cdp-harness.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("Hebrew workspace compatibility", function () {
  before(() => startObsidian({ language: "he" }));
  afterEach(async function () {
    if (this.currentTest?.state === "failed") await captureFailure();
  });
  after(stopObsidian);

  it("scrolls the RTL board and round-trips a Hebrew task through drag/drop and undo", async function () {
    const file = "עברית.md";
    const fixture = "- [ ] משימה בעברית [due:: 2099-01-01] [unknown:: keep-me]\r\nUntouched text\r\n";
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector(".onboarding-secondary-btn"))));
    await browser.execute(() => document.querySelector(".onboarding-secondary-btn").click());
    await browser.sendCommand("Emulation.setDeviceMetricsOverride", { width: 1024, height: 700, deviceScaleFactor: 1, mobile: false });
    await browser.executeObsidian(async ({ app, plugins }, file, contents) => {
      plugins.taskPlanner.settings.maxHorizonsPerColumn = 1;
      await plugins.taskPlanner.saveSettings();
      await app.vault.create(file, contents);
      await app.workspace.getLeaf("tab").setViewState({ type: "task-planner.planning" });
    }, file, fixture);
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector('[aria-label="Task: משימה בעברית"]'))));
    await browser.execute(() => {
      const hide = document.querySelector('[aria-label="Hide empty horizons"]');
      if (hide.classList.contains("active")) hide.click();
    });
    await browser.waitUntil(() => browser.execute(() => document.querySelectorAll(".future-section > .column").length > 6));

    const geometry = await browser.execute(async () => {
      const section = document.querySelector(".future-section");
      const direction = getComputedStyle(section).direction;
      const bounds = section.getBoundingClientRect();
      const visible = () => [...section.querySelectorAll(":scope > .column")].filter(column => {
        const rect = column.getBoundingClientRect();
        return rect.left < bounds.right && rect.right > bounds.left;
      }).map(column => column.querySelector(".title")?.textContent);
      section.scrollLeft = 0;
      await new Promise(requestAnimationFrame);
      const initial = visible();
      section.scrollLeft = (direction === "rtl" ? -1 : 1) * section.scrollWidth;
      await new Promise(requestAnimationFrame);
      section.focus();
      return {
        language: localStorage.getItem("language"),
        workspaceDirection: getComputedStyle(document.querySelector(".workspace")).direction,
        direction,
        scrollLeft: section.scrollLeft,
        overflow: section.scrollWidth > section.clientWidth,
        initial, final: visible(),
        focused: document.activeElement === section,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(geometry.language, "he");
    // Whole-workspace RTL is new in the current-public 1.14 lane; the
    // retained 1.13.4 floor deliberately keeps its historical LTR workspace.
    assert.equal(geometry.workspaceDirection, process.env.OBSIDIAN_VERSION === "1.13.4" ? "ltr" : "rtl");
    assert.ok(geometry.overflow);
    assert.notEqual(geometry.scrollLeft, 0);
    assert.ok(geometry.initial.length && geometry.final.length);
    assert.notDeepEqual(geometry.initial, geometry.final);
    assert.equal(geometry.focused, true);
    assert.ok(geometry.pageOverflow <= 1);
    assert.equal(await obsidianPage.read(file), fixture, "Scrolling must not write Markdown");

    const today = await browser.executeObsidian(({ obsidian }) => obsidian.moment().format("YYYY-MM-DD"));
    const payload = await browser.execute(() => {
      const card = document.querySelector('[aria-label="Task: משימה בעברית"]');
      const target = [...document.querySelectorAll(".today-section .column")].find(column => column.querySelector(".title")?.textContent === "Todo").querySelector(":scope > .content");
      const dataTransfer = new DataTransfer();
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      for (const type of ["dragenter", "dragover", "drop"]) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
      return dataTransfer.getData("application/x-task-id");
    });
    assert.notEqual(payload, "");
    const expected = fixture.replace("2099-01-01", today);
    await browser.waitUntil(async () => (await obsidianPage.read(file)) === expected, { timeoutMsg: "RTL drop did not preserve the expected task text" });
    await browser.waitUntil(() => browser.execute(() => Boolean(document.querySelector(".th-undo-toast-button"))));
    await browser.execute(() => document.querySelector(".th-undo-toast-button").click());
    await browser.waitUntil(async () => (await obsidianPage.read(file)) === fixture, { timeoutMsg: "RTL undo did not restore exact CRLF fixture bytes" });

    const artifactDir = path.join(ROOT, `artifacts/calendar-${process.env.OBSIDIAN_VERSION ?? "1.14.4"}`);
    fs.mkdirSync(artifactDir, { recursive: true });
    const revision = process.env.REVIEWED_SHA ?? "local-uncommitted";
    fs.writeFileSync(path.join(artifactDir, "rtl-evidence.json"), `${JSON.stringify({ revision, geometry, drag: "synthetic DOM DragEvents", undoRestoredExactBytes: true, fixture }, null, 2)}\n`);
    await browser.saveScreenshot(path.join(artifactDir, "rtl-board.png"));
  });
});
