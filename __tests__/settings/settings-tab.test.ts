import { App } from "obsidian";

import { TaskPlannerSettingsTab } from "../../src/settings/settings-tab";
import { mergeSettings } from "../../src/settings/types";

function createTab() {
  const plugin = {
    settings: mergeSettings(null),
    saveSettings: jest.fn().mockResolvedValue(undefined),
    refreshPlanningViews: jest.fn(),
  };
  const tab = new TaskPlannerSettingsTab(new App(), plugin as never);
  tab.update = jest.fn();
  return { plugin, tab };
}

describe("TaskPlannerSettingsTab", () => {
  it("uses Obsidian's declarative settings definitions", () => {
    const { tab } = createTab();

    const definitions = tab.getSettingDefinitions();

    expect(definitions.length).toBeGreaterThan(0);
    expect(definitions.some((definition) => "type" in definition && definition.type === "group")).toBe(true);
    expect(definitions.some((definition) => "name" in definition && definition.name === "Advanced Settings")).toBe(true);
  });

  it("reads and writes nested control keys", async () => {
    const { plugin, tab } = createTab();

    expect(tab.getControlValue("horizonVisibility.showBacklog")).toBe(true);
    await tab.setControlValue("horizonVisibility.showBacklog", false);

    expect(plugin.settings.horizonVisibility.showBacklog).toBe(false);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(plugin.refreshPlanningViews).toHaveBeenCalledTimes(1);
  });

  it("normalizes dropdown-backed numbers and refreshes structural changes", async () => {
    const { plugin, tab } = createTab();

    await tab.setControlValue("firstWeekday", "7");

    expect(plugin.settings.firstWeekday).toBe(7);
    expect(tab.getControlValue("firstWeekday")).toBe("7");
    expect(tab.update).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid attribute names", async () => {
    const { plugin, tab } = createTab();

    await tab.setControlValue("dueDateAttribute", "not valid");

    expect(plugin.settings.dueDateAttribute).toBe("due");
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });
});
