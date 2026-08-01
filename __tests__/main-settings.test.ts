import { App, PluginManifest } from "obsidian";

import TaskPlannerPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings";

const manifest: PluginManifest = {
  id: "task-planner",
  name: "Task Planner",
  version: "2.0.4",
  minAppVersion: "1.8.7",
  description: "test",
  author: "Selfish",
};

describe("TaskPlannerPlugin settings persistence", () => {
  it("does not overwrite settings created by a newer schema", async () => {
    const futureData = {
      version: DEFAULT_SETTINGS.version + 1,
      quickAdd: { destination: "project", futureDestinationOption: true },
      futureRootOption: { retained: true },
    };
    const untouchedFutureData = JSON.parse(JSON.stringify(futureData)) as typeof futureData;
    const plugin = new TaskPlannerPlugin(new App(), manifest);
    const warnSpy = jest.spyOn(plugin.logger, "warn");
    plugin.loadData = jest.fn().mockResolvedValue(futureData);
    plugin.saveData = jest.fn().mockResolvedValue(undefined);

    await plugin.loadSettings();
    expect(plugin.settings.quickAdd.destination).toBe(DEFAULT_SETTINGS.quickAdd.destination);
    plugin.settings.quickAdd.inboxFilePath = "Changed in the older runtime.md";

    await plugin.saveSettings();
    await plugin.saveSettings();

    expect(plugin.saveData).not.toHaveBeenCalled();
    expect(futureData).toEqual(untouchedFutureData);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("continues to save settings at the supported schema version", async () => {
    const plugin = new TaskPlannerPlugin(new App(), manifest);
    plugin.loadData = jest.fn().mockResolvedValue({ version: DEFAULT_SETTINGS.version, ignoredFolders: ["Archive"] });
    plugin.saveData = jest.fn().mockResolvedValue(undefined);

    await plugin.loadSettings();
    plugin.settings.ignoredFolders.push("Templates");
    await plugin.saveSettings();

    expect(plugin.saveData).toHaveBeenCalledWith(expect.objectContaining({ version: DEFAULT_SETTINGS.version, ignoredFolders: ["Archive", "Templates"] }));
  });
});
