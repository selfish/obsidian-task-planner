export type HorizonColor = "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink" | "accent" | "success" | "warning" | "error";

export interface CustomAtShortcut {
  keyword: string;
  targetAttribute: string;
  value: string | true;
}

export interface AtShortcutSettings {
  enableAtShortcuts: boolean;
  enableDateShortcuts: boolean;
  enablePriorityShortcuts: boolean;
  enableBuiltinShortcuts: boolean;
  customShortcuts: CustomAtShortcut[];
}

export interface CustomHorizon {
  label: string;
  date: string;
  tag?: string;
  color?: HorizonColor;
  position: "before" | "after" | "end" | "inline";
}

export type NextWeekMode = "collapsed" | "same-as-this-week" | "rolling-week";

export interface HorizonVisibility {
  showBacklog: boolean;
  showPast: boolean;
  showOverdue: boolean;
  showMonday: boolean;
  showTuesday: boolean;
  showWednesday: boolean;
  showThursday: boolean;
  showFriday: boolean;
  showSaturday: boolean;
  showSunday: boolean;
  nextWeekMode: NextWeekMode;
  weeksToShow: number;
  monthsToShow: number;
  showQuarters: boolean;
  showNextYear: boolean;
  showLater: boolean;
}

export interface QuickAddSettings {
  destination: "inbox" | "daily";
  inboxFilePath: string;
  placement: "prepend" | "append" | "before-regex" | "after-regex";
  templaterDelay: number;
  taskPattern: string;
  locationRegex: string;
}

export interface FollowUpSettings {
  textPrefix: string;
  copyTags: boolean;
  copyPriority: boolean;
}

export interface UndoSettings {
  enableUndo: boolean;
  undoHistorySize: number;
  undoHistoryMaxAgeSeconds: number;
  showUndoToast: boolean;
  undoToastDurationMs: number;
}

export interface TaskPlannerSettings {
  version: number;
  ignoredFolders: string[];
  ignoreArchivedTasks: boolean;
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
  ignoreArchivedTasks: true,
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
