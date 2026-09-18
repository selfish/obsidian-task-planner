import { App, type SettingControl, type SettingDefinitionList } from "obsidian";

import type TaskPlannerPlugin from "../../src/main";
import { TaskPlannerSettingsTab } from "../../src/settings/settings-tab";
import { DEFAULT_SETTINGS, parseTaskPlannerSettings } from "../../src/settings/types";

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
  it("exposes every active preference as native controls or lists, with no pages or custom row rendering", () => {
    const { items, controls } = setup();
    expect(items.every((item) => "type" in item && ["group", "list"].includes(item.type))).toBe(true);
    for (const item of items) {
      if ("items" in item) for (const child of item.items ?? []) expect(child).not.toHaveProperty("render");
    }
    const collectionKeys = ["customHorizons", "ignoredFolders", "atShortcutSettings.customShortcuts"];
    const stateOnly = ["version", "hasSeenOnboarding", "hasDismissedNativeMenusWarning", "horizonVisibility.showPast"];
    expect(controls.map((control) => control.key).sort()).toEqual(leaves(DEFAULT_SETTINGS).filter((key) => ![...collectionKeys, ...stateOnly].includes(key)).sort());
    expect(items.filter((item) => "type" in item && item.type === "list")).toHaveLength(3);
    expect(Object.prototype.hasOwnProperty.call(TaskPlannerSettingsTab.prototype, "display")).toBe(false);
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

  it("defaults old data to automatic layout, preserves unknown keys and rejects invalid persisted caps", () => {
    const old = { ...DEFAULT_SETTINGS, customHorizons: [{ label: "Kept", date: "2026-10-01", position: "end", futureKey: 1 }], futureKey: true };
    delete (old as Partial<typeof old>).maxHorizonsPerColumn;
    expect(parseTaskPlannerSettings(old)).toMatchObject({ maxHorizonsPerColumn: 0, futureKey: true, customHorizons: [{ futureKey: 1 }] });
    for (const value of [-1, 7, 1.5, Infinity, "3", null]) expect(parseTaskPlannerSettings({ maxHorizonsPerColumn: value }).maxHorizonsPerColumn).toBe(0);
  });
});
