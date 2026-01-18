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

export interface HorizonVisibility {
  // Basic horizons
  showBacklog: boolean;
  showPast: boolean;
  showOverdue: boolean;

  // Individual weekdays
  showMonday: boolean;
  showTuesday: boolean;
  showWednesday: boolean;
  showThursday: boolean;
  showFriday: boolean;
  showSaturday: boolean;
  showSunday: boolean;

  // Week/Month counts
  weeksToShow: number; // 0-4
  monthsToShow: number; // 0-3

  // Quarters (shows all remaining quarters until end of year)
  showQuarters: boolean;

  // Year
  showNextYear: boolean;

  // Later horizon
  showLater: boolean;
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
}

export const DEFAULT_SETTINGS: TaskPlannerSettings = {
  version: 3,
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
    weeksToShow: 4,
    monthsToShow: 3,
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
};
