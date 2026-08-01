import { DEFAULT_SETTINGS, parseTaskPlannerSettings } from "../../src/settings/types";

describe("parseTaskPlannerSettings", () => {
  it.each([undefined, null, true, 42, "settings", []])("uses defaults for a non-object persisted value", (value) => {
    const parsed = parseTaskPlannerSettings(value);
    expect(parsed).toEqual(DEFAULT_SETTINGS);
    expect(parsed).not.toBe(DEFAULT_SETTINGS);
    expect(parsed.ignoredFolders).not.toBe(DEFAULT_SETTINGS.ignoredFolders);
    expect(parsed.customHorizons).not.toBe(DEFAULT_SETTINGS.customHorizons);
    expect(parsed.atShortcutSettings.customShortcuts).not.toBe(DEFAULT_SETTINGS.atShortcutSettings.customShortcuts);
  });

  it("validates known values recursively while preserving unknown keys", () => {
    const parsed = parseTaskPlannerSettings({
      version: "4",
      ignoredFolders: ["Archive", 42, null],
      dailyWipLimit: -1,
      firstWeekday: 9,
      customHorizons: [{ label: "Valid", date: "2026-08-01", position: "inline", tag: 42, color: "blue", futureHorizonOption: true }, { label: "Bad date", date: "tomorrow", position: "end" }, null],
      horizonVisibility: {
        showBacklog: false,
        showPast: "no",
        nextWeekMode: "sideways",
        weeksToShow: 99,
        futureHorizonVisibility: true,
      },
      atShortcutSettings: {
        enableAtShortcuts: false,
        customShortcuts: [
          { keyword: "person", targetAttribute: "owner", value: true, futureShortcutOption: "kept" },
          { keyword: 42, targetAttribute: "owner", value: true },
        ],
      },
      quickAdd: {
        destination: "elsewhere",
        inboxFilePath: "Tasks.md",
        placement: "append",
        templaterDelay: -1,
      },
      followUp: null,
      undo: {
        enableUndo: false,
        undoHistorySize: 0,
        futureUndoOption: true,
      },
      hasSeenOnboarding: true,
      futureSetting: { preserved: true },
    });

    expect(parsed).toMatchObject({
      ...DEFAULT_SETTINGS,
      ignoredFolders: ["Archive"],
      customHorizons: [{ label: "Valid", date: "2026-08-01", position: "inline", color: "blue", futureHorizonOption: true }],
      horizonVisibility: {
        ...DEFAULT_SETTINGS.horizonVisibility,
        showBacklog: false,
        futureHorizonVisibility: true,
      },
      atShortcutSettings: {
        ...DEFAULT_SETTINGS.atShortcutSettings,
        enableAtShortcuts: false,
        customShortcuts: [{ keyword: "person", targetAttribute: "owner", value: true, futureShortcutOption: "kept" }],
      },
      quickAdd: {
        ...DEFAULT_SETTINGS.quickAdd,
        inboxFilePath: "Tasks.md",
        placement: "append",
      },
      undo: {
        ...DEFAULT_SETTINGS.undo,
        enableUndo: false,
        futureUndoOption: true,
      },
      hasSeenOnboarding: true,
      futureSetting: { preserved: true },
    });
  });
});
