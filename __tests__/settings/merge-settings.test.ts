import { DEFAULT_SETTINGS, mergeSettings } from "../../src/settings/types";

describe("mergeSettings", () => {
  it("fills nested defaults without overwriting stored values", () => {
    const settings = mergeSettings({
      horizonVisibility: {
        showBacklog: false,
        showSunday: true,
      },
      quickAdd: {
        destination: "daily",
      },
    });

    expect(settings.horizonVisibility.showBacklog).toBe(false);
    expect(settings.horizonVisibility.showSunday).toBe(true);
    expect(settings.horizonVisibility.showLater).toBe(DEFAULT_SETTINGS.horizonVisibility.showLater);
    expect(settings.quickAdd.destination).toBe("daily");
    expect(settings.quickAdd.taskPattern).toBe(DEFAULT_SETTINGS.quickAdd.taskPattern);
  });

  it("does not share mutable defaults between loaded settings", () => {
    const first = mergeSettings(null);
    const second = mergeSettings(null);

    first.ignoredFolders.push("Archive");
    first.atShortcutSettings.customShortcuts.push({ keyword: "later", targetAttribute: "due", value: true });

    expect(second.ignoredFolders).toEqual([]);
    expect(second.atShortcutSettings.customShortcuts).toEqual([]);
    expect(DEFAULT_SETTINGS.ignoredFolders).toEqual([]);
    expect(DEFAULT_SETTINGS.atShortcutSettings.customShortcuts).toEqual([]);
  });
});
