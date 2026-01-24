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
  position: "before" | "after" | "end"; // before = before backlog, after = after backlog, end = after time horizons
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
  ignoreArchivedTodos: boolean;
  defaultDailyWipLimit: number;
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
  ignoreArchivedTodos: true,
  defaultDailyWipLimit: 5,
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
