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
      version: -1,
      ignoredFolders: ["Archive", 42, null],
      dailyWipLimit: -1,
      firstWeekday: 9,
      customHorizons: [
        { label: "Valid", date: "2026-08-01", position: "inline", tag: "#valid", color: "blue", futureHorizonOption: true },
        { label: "Bad date", date: "tomorrow", position: "end" },
        { label: "Impossible date", date: "2026-02-29", position: "end" },
        { label: "Bad position", date: "2026-08-01", position: 42 },
        { label: "Sanitized", date: "2026-08-02", position: "end", tag: 42, color: "chartreuse" },
        null,
      ],
      horizonVisibility: {
        showBacklog: false,
        showPast: "no",
        nextWeekMode: "sideways",
        weeksToShow: 99,
        monthsToShow: 99,
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
        undoHistoryMaxAgeSeconds: -1,
        undoToastDurationMs: -1,
        futureUndoOption: true,
      },
      hasSeenOnboarding: true,
      futureSetting: { preserved: true },
    });

    expect(parsed).toMatchObject({
      ...DEFAULT_SETTINGS,
      ignoredFolders: ["Archive"],
      customHorizons: [
        { label: "Valid", date: "2026-08-01", position: "inline", tag: "#valid", color: "blue", futureHorizonOption: true },
        { label: "Sanitized", date: "2026-08-02", position: "end" },
      ],
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

  it("accepts valid boundary values for every guarded number", () => {
    const parsed = parseTaskPlannerSettings({
      version: 0,
      dailyWipLimit: 0,
      firstWeekday: 7,
      horizonVisibility: { weeksToShow: 4, monthsToShow: 3 },
      quickAdd: { templaterDelay: 0 },
      followUp: { textPrefix: "Next: ", copyTags: false, copyPriority: false },
      undo: { undoHistorySize: 1, undoHistoryMaxAgeSeconds: 0, undoToastDurationMs: 0 },
    });

    expect(parsed).toMatchObject({
      version: 0,
      dailyWipLimit: 0,
      firstWeekday: 7,
      horizonVisibility: { weeksToShow: 4, monthsToShow: 3 },
      quickAdd: { templaterDelay: 0 },
      followUp: { textPrefix: "Next: ", copyTags: false, copyPriority: false },
      undo: { undoHistorySize: 1, undoHistoryMaxAgeSeconds: 0, undoToastDurationMs: 0 },
    });
  });

  it("accepts a real leap day for a custom horizon", () => {
    expect(parseTaskPlannerSettings({ customHorizons: [{ label: "Leap day", date: "2028-02-29", position: "end" }] }).customHorizons).toEqual([{ label: "Leap day", date: "2028-02-29", position: "end" }]);
  });

  it("clones future non-empty array defaults instead of sharing mutable entries", () => {
    const defaultHorizon = { label: "Default", date: "2026-08-01", position: "end" as const };
    const defaultShortcut = { keyword: "who", targetAttribute: "owner", value: true as const };
    DEFAULT_SETTINGS.customHorizons.push(defaultHorizon);
    DEFAULT_SETTINGS.atShortcutSettings.customShortcuts.push(defaultShortcut);

    try {
      const parsed = parseTaskPlannerSettings(undefined);
      expect(parsed.customHorizons).toEqual([defaultHorizon]);
      expect(parsed.customHorizons[0]).not.toBe(defaultHorizon);
      expect(parsed.atShortcutSettings.customShortcuts).toEqual([defaultShortcut]);
      expect(parsed.atShortcutSettings.customShortcuts[0]).not.toBe(defaultShortcut);
    } finally {
      DEFAULT_SETTINGS.customHorizons.pop();
      DEFAULT_SETTINGS.atShortcutSettings.customShortcuts.pop();
    }
  });
});
