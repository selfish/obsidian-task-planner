import { App, Setting, type SettingControl, type SettingDefinitionList, type SettingDefinitionRender } from "obsidian";

import type TaskPlannerPlugin from "../../src/main";
import { TaskPlannerSettingsTab } from '../../src/settings/settings-tab';
import { editHorizon, editShortcut, addIgnoredFolder } from '../../src/settings/settings-editors';
import { DEFAULT_SETTINGS, parseTaskPlannerSettings } from '../../src/settings/types';

jest.mock('../../src/settings/settings-editors');

function setup() {
  const app = new App();
  const plugin = {
    settings: parseTaskPlannerSettings(DEFAULT_SETTINGS),
    saveSettings: jest.fn().mockResolvedValue(undefined),
    refreshPlanningViews: jest.fn(),
    taskIndex: { filesLoaded: jest.fn().mockResolvedValue(undefined) },
  } as unknown as TaskPlannerPlugin;
  const tab = new TaskPlannerSettingsTab(app, plugin);
  tab.update = jest.fn();
  const items = tab.getSettingDefinitions();
  const controls = items.flatMap((item) => "items" in item ? item.items ?? [] : [item]).flatMap((item) => "control" in item && item.control ? [item.control] : []);
  return { app, plugin, tab, items, controls };
}

function leaves(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null && !Array.isArray(child) ? leaves(child, path) : [path];
  });
}

describe("canonical settings", () => {
  it("exposes every active preference as native controls, lists, or the compact weekday selector, with no pages", () => {
    const { items, controls } = setup();
    expect(items.every((item) => "type" in item && ["group", "list"].includes(item.type))).toBe(true);
    const renders = items.flatMap((item) => ("items" in item ? (item.items ?? []) : [])).filter((item) => "render" in item);
    expect(renders).toHaveLength(1);
    expect(renders[0]).toMatchObject({ name: "Visible days" });
    const collectionKeys = ["customHorizons", "ignoredFolders", "atShortcutSettings.customShortcuts"];
    const stateOnly = ["version", "hasSeenOnboarding", "hasDismissedNativeMenusWarning", "horizonVisibility.showPast", ...(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const).map((day) => `horizonVisibility.show${day}`)];
    expect(controls.map((control) => control.key).sort()).toEqual(leaves(DEFAULT_SETTINGS).filter((key) => ![...collectionKeys, ...stateOnly].includes(key)).sort());
    expect(items.filter((item) => "type" in item && item.type === "list")).toHaveLength(3);
    expect(Object.prototype.hasOwnProperty.call(TaskPlannerSettingsTab.prototype, "display")).toBe(false);
  });

  it("renders weekdays compactly in configured order and persists a toggle", async () => {
    const { tab, plugin, items } = setup();
    plugin.settings.firstWeekday = 7;
    const definition = items.flatMap((item) => ("items" in item ? (item.items ?? []) : [])).find((item) => "render" in item) as SettingDefinitionRender;
    const setting = new Setting(document.createElement("div"));
    const enhance = (element: HTMLElement): HTMLElement => {
      Object.assign(element, {
        createEl(tag: keyof HTMLElementTagNameMap, options: { cls?: string; text?: string; attr?: Record<string, string> } = {}) {
          const child = enhance(document.createElement(tag));
          if (options.cls) child.className = options.cls;
          if (options.text) child.textContent = options.text;
          for (const [key, value] of Object.entries(options.attr ?? {})) child.setAttribute(key, value);
          element.append(child);
          return child;
        },
        createDiv(options = {}) {
          return (element as HTMLElement & { createEl: (tag: keyof HTMLElementTagNameMap, options?: unknown) => HTMLElement }).createEl("div", options);
        },
        createSpan(options = {}) {
          return (element as HTMLElement & { createEl: (tag: keyof HTMLElementTagNameMap, options?: unknown) => HTMLElement }).createEl("span", options);
        },
      });
      return element;
    };
    enhance(setting.controlEl);
    definition.render(setting, {} as never);
    const buttons = [...setting.controlEl.querySelectorAll("button")];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    const previous = plugin.settings.horizonVisibility.showSunday;
    buttons[0].click();
    await Promise.resolve();
    await Promise.resolve();
    expect(plugin.settings.horizonVisibility.showSunday).toBe(!previous);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(plugin.refreshPlanningViews).toHaveBeenCalledTimes(1);
    expect(tab.update).toHaveBeenCalledTimes(1);

    (plugin.saveSettings as jest.Mock).mockRejectedValueOnce(new Error("disk full"));
    const monday = plugin.settings.horizonVisibility.showMonday;
    buttons[1].click();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(plugin.settings.horizonVisibility.showMonday).toBe(monday);
    expect(tab.update).toHaveBeenCalledTimes(2);
  });

  it("validates the cap, saves it, refreshes the board, and round-trips persisted settings", async () => {
    const { tab, plugin } = setup();
    await tab.setControlValue("maxHorizonsPerColumn", 3);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(plugin.refreshPlanningViews).toHaveBeenCalledTimes(1);
    expect(parseTaskPlannerSettings(JSON.parse(JSON.stringify(plugin.settings))).maxHorizonsPerColumn).toBe(3);
    for (const invalid of [-1, 7, 1.5, NaN, Infinity, "2", null]) await expect(tab.setControlValue("maxHorizonsPerColumn", invalid)).rejects.toThrow();
    expect(plugin.settings.maxHorizonsPerColumn).toBe(3);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
  });

  it("retains numeric weekday storage while exposing readable dropdown options", async () => {
    const { tab, plugin } = setup();
    expect(tab.getControlValue("firstWeekday")).toBe("1");
    await tab.setControlValue("firstWeekday", "7");
    expect(plugin.settings.firstWeekday).toBe(7);
    await expect(tab.setControlValue("firstWeekday", "8")).rejects.toThrow();
  });

  it("rejects invalid fields, patterns, options, fractional counts and unknown keys without saving", async () => {
    const { tab, plugin } = setup();
    for (const [key, value] of [["dueDateAttribute", "bad field"], ["quickAdd.locationRegex", "["], ["quickAdd.taskPattern", "task text lost"], ["quickAdd.inboxFilePath", "../outside.md"], ["quickAdd.destination", "toString"], ["dailyWipLimit", 1.5], ["__proto__.polluted", true]] as const) await expect(tab.setControlValue(key, value)).rejects.toThrow();
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });

  it("reindexes immediately when exclusions or field names change", async () => {
    const { tab, plugin } = setup();
    await tab.setControlValue("ignoreArchivedTasks", false);
    await tab.setControlValue("dueDateAttribute", "deadline");
    expect(plugin.taskIndex.filesLoaded).toHaveBeenCalledTimes(2);
  });

  it("rolls back a scalar preference on save failure", async () => {
    const { tab, plugin } = setup();
    (plugin.saveSettings as jest.Mock).mockRejectedValue(new Error("disk full"));
    await expect(tab.setControlValue("maxHorizonsPerColumn", 2)).rejects.toThrow("disk full");
    expect(plugin.settings.maxHorizonsPerColumn).toBe(0);
    expect(plugin.refreshPlanningViews).not.toHaveBeenCalled();
  });

  it("keeps dependent controls searchable but disabled, and rerenders only dependencies", async () => {
    const { tab, plugin } = setup();
    await tab.setControlValue("atShortcutSettings.enableAtShortcuts", false);
    expect(tab.update).toHaveBeenCalledTimes(1);
    const controls = tab.getSettingDefinitions().flatMap((item) => "items" in item ? item.items ?? [] : []).flatMap((item) => "control" in item && item.control ? [item.control] : []);
    const date = controls.find((control) => control.key === "atShortcutSettings.enableDateShortcuts") as SettingControl;
    expect(typeof date.disabled === "function" && date.disabled()).toBe(true);
    expect(plugin.settings.atShortcutSettings.enableDateShortcuts).toBe(true);
    await tab.setControlValue("followUp.textPrefix", "Next: ");
    expect(tab.update).toHaveBeenCalledTimes(1);
  });

  it("keeps dependent controls visible and describes enabled states and supported values", async () => {
    const { tab, plugin } = setup();
    const controls = () => tab.getSettingDefinitions().flatMap((item) => "items" in item ? item.items ?? [] : []).flatMap((item) => "control" in item && item.control ? [item.control] : []);
    const disabled = (key: string) => {
      const predicate = controls().find((control) => control.key === key)!.disabled;
      return typeof predicate === "function" ? predicate() : predicate;
    };
    expect(disabled("quickAdd.inboxFilePath")).toBe(false);
    await tab.setControlValue("quickAdd.destination", "daily");
    expect(disabled("quickAdd.inboxFilePath")).toBe(true);
    expect(disabled("quickAdd.locationRegex")).toBe(true);
    await tab.setControlValue("quickAdd.placement", "after-regex");
    expect(disabled("quickAdd.locationRegex")).toBe(false);
    expect(disabled("undo.undoToastDurationMs")).toBe(false);
    await tab.setControlValue("undo.showUndoToast", false);
    expect(disabled("undo.undoToastDurationMs")).toBe(true);
    await tab.setControlValue("undo.enableUndo", false);
    expect(disabled("undo.undoToastDurationMs")).toBe(true);
    const file = controls().find((control) => control.type === "file");
    if (file?.type !== "file") throw new Error("Expected native file picker");
    expect(file.filter!({ extension: "md" } as never)).toBe(true);
    expect(file.filter!({ extension: "png" } as never)).toBe(false);
    for (const control of controls()) if (control.type === "number") {
      expect(await control.validate!(control.min! - 1)).toBeTruthy();
      if (control.max !== undefined) expect(await control.validate!(control.max + 1)).toBeTruthy();
    }
    for (const value of ["", "/outside.md", "a.txt"]) await expect(tab.setControlValue("quickAdd.inboxFilePath", value)).rejects.toThrow();
    await expect(tab.setControlValue("quickAdd.locationRegex", "")).rejects.toThrow();
    await expect(tab.setControlValue("dueDateAttribute", "")).rejects.toThrow();
    plugin.settings.customHorizons = (["before", "after", "inline", "end"] as const).map((position) => ({ label: position, date: "2026-10-20", position, tag: "work" }));
    const horizons = tab.getSettingDefinitions().find((item) => "heading" in item && item.heading === "Custom horizons") as SettingDefinitionList;
    expect(horizons.items!.map((item) => item.desc)).toEqual(["2026-10-20 · #work · Before backlog", "2026-10-20 · #work · After backlog", "2026-10-20 · #work · On its date", "2026-10-20 · #work · At the end"]);
  });

  it("restores collection data when persistence fails", async () => {
    const { tab, plugin } = setup();
    plugin.settings.customHorizons.push({ label: "Keep me", date: "2026-10-01", position: "end" });
    (plugin.saveSettings as jest.Mock).mockRejectedValueOnce(new Error("disk full"));
    const list = tab.getSettingDefinitions().find((item) => "heading" in item && item.heading === "Custom horizons") as SettingDefinitionList;
    list.onDelete!(0);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(plugin.settings.customHorizons).toEqual([{ label: "Keep me", date: "2026-10-01", position: "end" }]);
  });

  it("uses native reorder and delete affordances for collections", async () => {
    const { tab, plugin } = setup();
    plugin.settings.customHorizons.push({ label: "A", date: "2026-10-01", position: "end" }, { label: "B", date: "2026-11-01", position: "end" });
    const list = tab.getSettingDefinitions().find((item) => "heading" in item && item.heading === "Custom horizons") as SettingDefinitionList;
    list.onReorder!(0, 1);
    await Promise.resolve();
    expect(plugin.settings.customHorizons.map((horizon) => horizon.label)).toEqual(["B", "A"]);
    list.onDelete!(1);
    await Promise.resolve();
    expect(plugin.settings.customHorizons.map((horizon) => horizon.label)).toEqual(["B"]);
  });

  it("wires native add/edit/save callbacks to the right lists and reindexes shortcuts and folders", async () => {
    const { tab, plugin } = setup();
    const list = (heading: string) => tab.getSettingDefinitions().find((item) => "heading" in item && item.heading === heading) as SettingDefinitionList;
    const action = (item: unknown) => ((item as { action: () => void }).action)();
    action(list("Custom horizons").addItem);
    await jest.mocked(editHorizon).mock.calls.at(-1)![2]({ label: "New", date: "2026-10-20", position: "end" });
    action(list("Custom horizons").items![0]);
    await jest.mocked(editHorizon).mock.calls.at(-1)![2]({ label: "Edited", date: "2026-10-20", position: "inline" });
    expect(plugin.settings.customHorizons[0].label).toBe("Edited");
    action(list("Custom shortcuts").addItem);
    await jest.mocked(editShortcut).mock.calls.at(-1)![3]({ keyword: "office", targetAttribute: "context", value: "work" });
    action(list("Custom shortcuts").items![0]);
    await jest.mocked(editShortcut).mock.calls.at(-1)![3]({ keyword: "office", targetAttribute: "context", value: "desk" });
    expect(plugin.settings.atShortcutSettings.customShortcuts[0].value).toBe("desk");
    list("Custom shortcuts").onReorder!(0, 0);
    list("Custom shortcuts").onDelete!(0);
    action(list("Ignored folders").addItem);
    await jest.mocked(addIgnoredFolder).mock.calls.at(-1)![2]("Archive");
    expect(plugin.settings.ignoredFolders).toContain("Archive");
    list("Ignored folders").onDelete!(plugin.settings.ignoredFolders.indexOf("Archive"));
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(plugin.settings.ignoredFolders).not.toContain("Archive");
    expect(plugin.taskIndex.filesLoaded).toHaveBeenCalledTimes(6);
  });

  it("does not rewrite unchanged preferences and keeps a saved value on reindex failure", async () => {
    const { tab, plugin } = setup();
    await tab.setControlValue("maxHorizonsPerColumn", 0);
    expect(plugin.saveSettings).not.toHaveBeenCalled();
    (plugin.taskIndex.filesLoaded as jest.Mock).mockRejectedValueOnce(new Error("read failure"));
    await tab.setControlValue("dueDateAttribute", "deadline");
    expect(plugin.settings.dueDateAttribute).toBe("deadline");
    expect(plugin.refreshPlanningViews).toHaveBeenCalled();
    await tab.setControlValue("quickAdd.locationRegex", "^## Tasks$");
    await tab.setControlValue("quickAdd.taskPattern", "- [ ] {{task}}");
    await tab.setControlValue("quickAdd.inboxFilePath", "Inbox/tasks.md");
  });

  it("defaults old data to automatic layout, preserves unknown keys and rejects invalid persisted caps", () => {
    const old = { ...DEFAULT_SETTINGS, customHorizons: [{ label: "Kept", date: "2026-10-01", position: "end", futureKey: 1 }], futureKey: true };
    delete (old as Partial<typeof old>).maxHorizonsPerColumn;
    expect(parseTaskPlannerSettings(old)).toMatchObject({ maxHorizonsPerColumn: 0, futureKey: true, customHorizons: [{ futureKey: 1 }] });
    for (const value of [-1, 7, 1.5, Infinity, "3", null]) expect(parseTaskPlannerSettings({ maxHorizonsPerColumn: value }).maxHorizonsPerColumn).toBe(0);
  });
});
