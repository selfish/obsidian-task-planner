import { App, type SettingDefinitionItem } from "obsidian";

import type TaskPlannerPlugin from "../../src/main";
import { TaskPlannerSettingsTab } from "../../src/settings/settings-tab";
import { DEFAULT_SETTINGS } from "../../src/settings/types";

function collectNames(items: SettingDefinitionItem[]): string[] {
  return items.flatMap((item) => {
    if ("items" in item && item.items) {
      return ["name" in item && item.name ? item.name : item.heading, ...collectNames(item.items)].filter((name): name is string => typeof name === "string");
    }
    return "name" in item ? [item.name] : [];
  });
}

describe("TaskPlannerSettingsTab declarative settings", () => {
  it("indexes every user-facing setting while retaining the legacy fallback", () => {
    const plugin = {
      settings: DEFAULT_SETTINGS,
      saveSettings: jest.fn().mockResolvedValue(undefined),
      refreshPlanningViews: jest.fn(),
    } as unknown as TaskPlannerPlugin;
    const tab = new TaskPlannerSettingsTab(new App(), plugin);

    expect(collectNames(tab.getSettingDefinitions())).toEqual(
      expect.arrayContaining([
        "Quick add",
        "Destination",
        "Inbox file",
        "Task attributes",
        "Due date",
        "Completed date",
        "Pinned",
        "Special columns",
        "Backlog",
        "Overdue",
        "Later",
        "This week",
        "Visible days",
        "Week starts on",
        "Next week",
        "Display mode",
        "Future horizons",
        "Weeks after next",
        "Months ahead",
        "Quarters",
        "Next year",
        "Custom horizons",
        "Work limits",
        "Daily work-in-progress limit",
        "Quick add options",
        "Placement",
        "Location regex",
        "Templater delay",
        "Task pattern",
        "@ shortcuts",
        "Enable @-shortcuts",
        "Auto-convert",
        "Date shortcuts",
        "Priority shortcuts",
        "Pinned shortcut",
        "Custom shortcuts",
        "Indexing",
        "Ignored folders",
        "Ignore archived",
        "Fuzzy search",
        "Undo",
        "Enable undo for drag-and-drop",
        "Show undo toast",
        "Follow-up tasks",
        "Text prefix",
        "Copy tags",
        "Copy priority",
      ])
    );
    expect(typeof tab.display).toBe("function");
  });
});
