export type HorizonColor = "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | "accent" | "success" | "warning" | "error";

export interface CustomAtShortcut {
  keyword: string;
  targetAttribute: string;
  value: string | true;
}

export interface AtShortcutSettings {
  enableAtShortcuts: boolean; // Master toggle (default: true)
  enableDateShortcuts: boolean; // @today, @tomorrow, etc. (default: true)
  enablePriorityShortcuts: boolean; // @critical, @high, @medium, @low, @lowest (default: true)
  enableBuiltinShortcuts: boolean; // @selected (default: true)
  customShortcuts: CustomAtShortcut[];
}

export interface CustomHorizon {
  label: string;
  date: string; // ISO date (YYYY-MM-DD) - required
  tag?: string; // Tag to apply when dropping tasks to this horizon
  color?: HorizonColor; // Color tint for the column
  position: "before" | "after" | "end" | "inline"; // before = before backlog, after = after backlog, end = after time horizons, inline = at its date position
}

export type NextWeekMode = "collapsed" | "same-as-this-week" | "rolling-week";

export interface HorizonVisibility {
  // Basic horizons
  showBacklog: boolean;
  showPast: boolean;
  showOverdue: boolean;

  // Individual weekdays (this week)
  showMonday: boolean;
  showTuesday: boolean;
  showWednesday: boolean;
  showThursday: boolean;
  showFriday: boolean;
  showSaturday: boolean;
  showSunday: boolean;

  // Next week display mode
  nextWeekMode: NextWeekMode;

  // Week/Month counts (weeksToShow now counts weeks AFTER next week)
  weeksToShow: number; // 0-4
  monthsToShow: number; // 0-3

  // Quarters (shows all remaining quarters until end of year)
  showQuarters: boolean;

  // Year
  showNextYear: boolean;

  // Later horizon
  showLater: boolean;
}

export interface QuickAddSettings {
  destination: "inbox" | "daily";
  inboxFilePath: string;
  placement: "prepend" | "append" | "before-regex" | "after-regex";
  templaterDelay: number;
  taskPattern: string; // Template for task, e.g., "### {time}\n- [ ] {task}"
  locationRegex: string; // Regex pattern to find insertion point (used with before-regex/after-regex)
}

export interface FollowUpSettings {
  textPrefix: string; // Default: "Follow up: "
  copyTags: boolean; // Default: true
  copyPriority: boolean; // Default: false
}

export interface UndoSettings {
  enableUndo: boolean; // Default: true
  undoHistorySize: number; // Default: 10
  undoHistoryMaxAgeSeconds: number; // Default: 300
  showUndoToast: boolean; // Default: true
  undoToastDurationMs: number; // Default: 5000
}

export interface TaskPlannerSettings {
  version: number;
  ignoredFolders: string[];
  ignoreArchivedTasks: boolean;
  dailyWipLimit: number;
  dueDateAttribute: string;
  completedDateAttribute: string;
  selectedAttribute: string;
  fuzzySearch: boolean;
  autoConvertAttributes: boolean;
  firstWeekday: number;
  customHorizons: CustomHorizon[];
  horizonVisibility: HorizonVisibility;
  atShortcutSettings: AtShortcutSettings;
  quickAdd: QuickAddSettings;
  followUp: FollowUpSettings;
  undo: UndoSettings;
  hasSeenOnboarding: boolean;
  hasDismissedNativeMenusWarning: boolean;
}

export const DEFAULT_SETTINGS: TaskPlannerSettings = {
  version: 4,
  ignoredFolders: [],
  ignoreArchivedTasks: true,
  dailyWipLimit: 8,
  dueDateAttribute: "due",
  completedDateAttribute: "completed",
  selectedAttribute: "selected",
  fuzzySearch: false,
  autoConvertAttributes: true,
  firstWeekday: 1,
  customHorizons: [],
  horizonVisibility: {
    showBacklog: true,
    showPast: true,
    showOverdue: true,
    showMonday: true,
    showTuesday: true,
    showWednesday: true,
    showThursday: true,
    showFriday: true,
    showSaturday: false,
    showSunday: false,
    nextWeekMode: "same-as-this-week",
    weeksToShow: 2,
    monthsToShow: 2,
    showQuarters: false,
    showNextYear: false,
    showLater: true,
  },
  atShortcutSettings: {
    enableAtShortcuts: true,
    enableDateShortcuts: true,
    enablePriorityShortcuts: true,
    enableBuiltinShortcuts: true,
    customShortcuts: [],
  },
  quickAdd: {
    destination: "inbox",
    inboxFilePath: "Inbox.md",
    placement: "prepend",
    templaterDelay: 300,
    taskPattern: "- [ ] {task}",
    locationRegex: "",
  },
  followUp: {
    textPrefix: "Follow up: ",
    copyTags: true,
    copyPriority: true,
  },
  undo: {
    enableUndo: true,
    undoHistorySize: 10,
    undoHistoryMaxAgeSeconds: 300,
    showUndoToast: true,
    undoToastDurationMs: 5000,
  },
  hasSeenOnboarding: false,
  hasDismissedNativeMenusWarning: false,
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : undefined;
}

function stringValue(record: UnknownRecord, key: string, fallback: string): string {
  return typeof record[key] === "string" ? record[key] : fallback;
}

function booleanValue(record: UnknownRecord, key: string, fallback: boolean): boolean {
  return typeof record[key] === "boolean" ? record[key] : fallback;
}

function numberValue(record: UnknownRecord, key: string, fallback: number, isValid: (value: number) => boolean): number {
  const value = record[key];
  return typeof value === "number" && isValid(value) ? value : fallback;
}

function enumValue<T extends string>(record: UnknownRecord, key: string, values: readonly T[], fallback: T): T {
  const value = record[key];
  return typeof value === "string" && values.includes(value as T) ? (value as T) : fallback;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseCustomHorizon(value: unknown): CustomHorizon | undefined {
  const record = asRecord(value);
  if (!record || typeof record.label !== "string" || typeof record.date !== "string" || !isIsoDate(record.date)) return undefined;
  const positions = ["before", "after", "end", "inline"] as const;
  if (typeof record.position !== "string" || !positions.includes(record.position as CustomHorizon["position"])) return undefined;

  const colors: readonly HorizonColor[] = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "accent", "success", "warning", "error"];
  const { tag: _tag, color: _color, ...unknownValues } = record;
  return {
    ...unknownValues,
    label: record.label,
    date: record.date,
    position: record.position as CustomHorizon["position"],
    ...(typeof record.tag === "string" ? { tag: record.tag } : {}),
    ...(typeof record.color === "string" && colors.includes(record.color as HorizonColor) ? { color: record.color as HorizonColor } : {}),
  };
}

function parseCustomShortcut(value: unknown): CustomAtShortcut | undefined {
  const record = asRecord(value);
  if (!record || typeof record.keyword !== "string" || typeof record.targetAttribute !== "string" || (typeof record.value !== "string" && record.value !== true)) return undefined;
  return { ...record, keyword: record.keyword, targetAttribute: record.targetAttribute, value: record.value };
}

/**
 * Validate persisted plugin data without discarding unknown keys that a newer
 * Task Planner version may need after a downgrade/upgrade round trip.
 */
export function parseTaskPlannerSettings(value: unknown): TaskPlannerSettings {
  const loaded = asRecord(value) ?? {};
  const horizonVisibility = asRecord(loaded.horizonVisibility) ?? {};
  const atShortcutSettings = asRecord(loaded.atShortcutSettings) ?? {};
  const quickAdd = asRecord(loaded.quickAdd) ?? {};
  const followUp = asRecord(loaded.followUp) ?? {};
  const undo = asRecord(loaded.undo) ?? {};

  return {
    ...loaded,
    version: numberValue(loaded, "version", DEFAULT_SETTINGS.version, (number) => Number.isInteger(number) && number >= 0),
    ignoredFolders: Array.isArray(loaded.ignoredFolders) ? loaded.ignoredFolders.filter((folder): folder is string => typeof folder === "string") : [...DEFAULT_SETTINGS.ignoredFolders],
    ignoreArchivedTasks: booleanValue(loaded, "ignoreArchivedTasks", DEFAULT_SETTINGS.ignoreArchivedTasks),
    dailyWipLimit: numberValue(loaded, "dailyWipLimit", DEFAULT_SETTINGS.dailyWipLimit, (number) => Number.isFinite(number) && number >= 0),
    dueDateAttribute: stringValue(loaded, "dueDateAttribute", DEFAULT_SETTINGS.dueDateAttribute),
    completedDateAttribute: stringValue(loaded, "completedDateAttribute", DEFAULT_SETTINGS.completedDateAttribute),
    selectedAttribute: stringValue(loaded, "selectedAttribute", DEFAULT_SETTINGS.selectedAttribute),
    fuzzySearch: booleanValue(loaded, "fuzzySearch", DEFAULT_SETTINGS.fuzzySearch),
    autoConvertAttributes: booleanValue(loaded, "autoConvertAttributes", DEFAULT_SETTINGS.autoConvertAttributes),
    firstWeekday: numberValue(loaded, "firstWeekday", DEFAULT_SETTINGS.firstWeekday, (number) => Number.isInteger(number) && number >= 1 && number <= 7),
    customHorizons: Array.isArray(loaded.customHorizons) ? loaded.customHorizons.map(parseCustomHorizon).filter((horizon): horizon is CustomHorizon => horizon !== undefined) : DEFAULT_SETTINGS.customHorizons.map((horizon) => ({ ...horizon })),
    horizonVisibility: {
      ...horizonVisibility,
      showBacklog: booleanValue(horizonVisibility, "showBacklog", DEFAULT_SETTINGS.horizonVisibility.showBacklog),
      showPast: booleanValue(horizonVisibility, "showPast", DEFAULT_SETTINGS.horizonVisibility.showPast),
      showOverdue: booleanValue(horizonVisibility, "showOverdue", DEFAULT_SETTINGS.horizonVisibility.showOverdue),
      showMonday: booleanValue(horizonVisibility, "showMonday", DEFAULT_SETTINGS.horizonVisibility.showMonday),
      showTuesday: booleanValue(horizonVisibility, "showTuesday", DEFAULT_SETTINGS.horizonVisibility.showTuesday),
      showWednesday: booleanValue(horizonVisibility, "showWednesday", DEFAULT_SETTINGS.horizonVisibility.showWednesday),
      showThursday: booleanValue(horizonVisibility, "showThursday", DEFAULT_SETTINGS.horizonVisibility.showThursday),
      showFriday: booleanValue(horizonVisibility, "showFriday", DEFAULT_SETTINGS.horizonVisibility.showFriday),
      showSaturday: booleanValue(horizonVisibility, "showSaturday", DEFAULT_SETTINGS.horizonVisibility.showSaturday),
      showSunday: booleanValue(horizonVisibility, "showSunday", DEFAULT_SETTINGS.horizonVisibility.showSunday),
      nextWeekMode: enumValue(horizonVisibility, "nextWeekMode", ["collapsed", "same-as-this-week", "rolling-week"], DEFAULT_SETTINGS.horizonVisibility.nextWeekMode),
      weeksToShow: numberValue(horizonVisibility, "weeksToShow", DEFAULT_SETTINGS.horizonVisibility.weeksToShow, (number) => Number.isInteger(number) && number >= 0 && number <= 4),
      monthsToShow: numberValue(horizonVisibility, "monthsToShow", DEFAULT_SETTINGS.horizonVisibility.monthsToShow, (number) => Number.isInteger(number) && number >= 0 && number <= 3),
      showQuarters: booleanValue(horizonVisibility, "showQuarters", DEFAULT_SETTINGS.horizonVisibility.showQuarters),
      showNextYear: booleanValue(horizonVisibility, "showNextYear", DEFAULT_SETTINGS.horizonVisibility.showNextYear),
      showLater: booleanValue(horizonVisibility, "showLater", DEFAULT_SETTINGS.horizonVisibility.showLater),
    },
    atShortcutSettings: {
      ...atShortcutSettings,
      enableAtShortcuts: booleanValue(atShortcutSettings, "enableAtShortcuts", DEFAULT_SETTINGS.atShortcutSettings.enableAtShortcuts),
      enableDateShortcuts: booleanValue(atShortcutSettings, "enableDateShortcuts", DEFAULT_SETTINGS.atShortcutSettings.enableDateShortcuts),
      enablePriorityShortcuts: booleanValue(atShortcutSettings, "enablePriorityShortcuts", DEFAULT_SETTINGS.atShortcutSettings.enablePriorityShortcuts),
      enableBuiltinShortcuts: booleanValue(atShortcutSettings, "enableBuiltinShortcuts", DEFAULT_SETTINGS.atShortcutSettings.enableBuiltinShortcuts),
      customShortcuts: Array.isArray(atShortcutSettings.customShortcuts)
        ? atShortcutSettings.customShortcuts.map(parseCustomShortcut).filter((shortcut): shortcut is CustomAtShortcut => shortcut !== undefined)
        : DEFAULT_SETTINGS.atShortcutSettings.customShortcuts.map((shortcut) => ({ ...shortcut })),
    },
    quickAdd: {
      ...quickAdd,
      destination: enumValue(quickAdd, "destination", ["inbox", "daily"], DEFAULT_SETTINGS.quickAdd.destination),
      inboxFilePath: stringValue(quickAdd, "inboxFilePath", DEFAULT_SETTINGS.quickAdd.inboxFilePath),
      placement: enumValue(quickAdd, "placement", ["prepend", "append", "before-regex", "after-regex"], DEFAULT_SETTINGS.quickAdd.placement),
      templaterDelay: numberValue(quickAdd, "templaterDelay", DEFAULT_SETTINGS.quickAdd.templaterDelay, (number) => Number.isFinite(number) && number >= 0),
      taskPattern: stringValue(quickAdd, "taskPattern", DEFAULT_SETTINGS.quickAdd.taskPattern),
      locationRegex: stringValue(quickAdd, "locationRegex", DEFAULT_SETTINGS.quickAdd.locationRegex),
    },
    followUp: {
      ...followUp,
      textPrefix: stringValue(followUp, "textPrefix", DEFAULT_SETTINGS.followUp.textPrefix),
      copyTags: booleanValue(followUp, "copyTags", DEFAULT_SETTINGS.followUp.copyTags),
      copyPriority: booleanValue(followUp, "copyPriority", DEFAULT_SETTINGS.followUp.copyPriority),
    },
    undo: {
      ...undo,
      enableUndo: booleanValue(undo, "enableUndo", DEFAULT_SETTINGS.undo.enableUndo),
      undoHistorySize: numberValue(undo, "undoHistorySize", DEFAULT_SETTINGS.undo.undoHistorySize, (number) => Number.isInteger(number) && number > 0),
      undoHistoryMaxAgeSeconds: numberValue(undo, "undoHistoryMaxAgeSeconds", DEFAULT_SETTINGS.undo.undoHistoryMaxAgeSeconds, (number) => Number.isFinite(number) && number >= 0),
      showUndoToast: booleanValue(undo, "showUndoToast", DEFAULT_SETTINGS.undo.showUndoToast),
      undoToastDurationMs: numberValue(undo, "undoToastDurationMs", DEFAULT_SETTINGS.undo.undoToastDurationMs, (number) => Number.isFinite(number) && number >= 0),
    },
    hasSeenOnboarding: booleanValue(loaded, "hasSeenOnboarding", DEFAULT_SETTINGS.hasSeenOnboarding),
    hasDismissedNativeMenusWarning: booleanValue(loaded, "hasDismissedNativeMenusWarning", DEFAULT_SETTINGS.hasDismissedNativeMenusWarning),
  };
}
