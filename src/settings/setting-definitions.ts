import TaskPlannerPlugin from "../main";
import { SettingDef, SubsectionDef } from "./setting-builder";

const noSpaces = (v: string) => !!v && !v.includes(" ");
const isNumber = (v: string) => !isNaN(parseInt(v));

export const quickAddSettings: SubsectionDef = {
  label: "Quick Add",
  settings: [
    {
      type: "dropdown",
      name: "Destination",
      desc: "Where to save new tasks created from the planning board",
      options: [
        { value: "inbox", label: "Inbox file" },
        { value: "daily", label: "Daily note" },
      ],
      getValue: (p) => p.settings.quickAdd.destination,
      setValue: async (p, v) => {
        p.settings.quickAdd.destination = v as "inbox" | "daily";
      },
      refreshDisplay: true,
    },
    {
      type: "search-file",
      name: "Inbox file",
      desc: "Path to the file where tasks will be saved",
      placeholder: "Example: inbox.md",
      getValue: (p) => p.settings.quickAdd.inboxFilePath,
      setValue: async (p, v) => {
        p.settings.quickAdd.inboxFilePath = v as string;
      },
      visible: (p) => p.settings.quickAdd.destination === "inbox",
    },
  ],
};

export const attributesSettings: SubsectionDef = {
  label: "Task Attributes",
  settings: [
    {
      type: "text",
      name: "Due date",
      desc: "Attribute name for task due dates",
      placeholder: "Due",
      getValue: (p) => p.settings.dueDateAttribute,
      setValue: async (p, v) => {
        p.settings.dueDateAttribute = v as string;
      },
      validate: noSpaces,
    },
    {
      type: "text",
      name: "Completed date",
      desc: "Attribute name for task completion dates",
      placeholder: "Completed",
      getValue: (p) => p.settings.completedDateAttribute,
      setValue: async (p, v) => {
        p.settings.completedDateAttribute = v as string;
      },
      validate: noSpaces,
    },
    {
      type: "text",
      name: "Pinned",
      desc: "Attribute name for pinning tasks to the top",
      placeholder: "Pinned",
      getValue: (p) => p.settings.selectedAttribute,
      setValue: async (p, v) => {
        p.settings.selectedAttribute = v as string;
      },
      validate: noSpaces,
    },
  ],
};

export const specialColumnsSettings: SubsectionDef = {
  label: "Special Columns",
  settings: [
    {
      type: "toggle",
      name: "Backlog",
      desc: "Tasks without a due date",
      getValue: (p) => p.settings.horizonVisibility.showBacklog,
      setValue: async (p, v) => {
        p.settings.horizonVisibility.showBacklog = v as boolean;
      },
      refreshViews: true,
    },
    {
      type: "toggle",
      name: "Overdue",
      desc: "Tasks past their due date",
      getValue: (p) => p.settings.horizonVisibility.showOverdue,
      setValue: async (p, v) => {
        p.settings.horizonVisibility.showOverdue = v as boolean;
      },
      refreshViews: true,
    },
    {
      type: "toggle",
      name: "Later",
      desc: "Tasks beyond visible horizons",
      getValue: (p) => p.settings.horizonVisibility.showLater,
      setValue: async (p, v) => {
        p.settings.horizonVisibility.showLater = v as boolean;
      },
      refreshViews: true,
    },
  ],
};

export const nextWeekSettings: SubsectionDef = {
  label: "Next Week",
  settings: [
    {
      type: "dropdown",
      name: "Display mode",
      desc: "How to display days in the next week section",
      options: [
        { value: "same-as-this-week", label: "Selected days (same as this week)" },
        { value: "rolling-week", label: "Rolling 7 days from today" },
        { value: "collapsed", label: "Single column (all of next week)" },
      ],
      getValue: (p) => p.settings.horizonVisibility.nextWeekMode ?? "same-as-this-week",
      setValue: async (p, v) => {
        p.settings.horizonVisibility.nextWeekMode = v as "collapsed" | "same-as-this-week" | "rolling-week";
      },
      refreshViews: true,
    },
  ],
};

export const futureHorizonsSettings: SubsectionDef = {
  label: "Future Horizons",
  settings: [
    {
      type: "dropdown",
      name: "Weeks after next",
      desc: "Additional weeks to show beyond next week",
      options: [
        { value: "0", label: "None" },
        { value: "1", label: "1 week (in 2 weeks)" },
        { value: "2", label: "2 weeks (in 2-3 weeks)" },
        { value: "3", label: "3 weeks (in 2-4 weeks)" },
      ],
      getValue: (p) => p.settings.horizonVisibility.weeksToShow.toString(),
      setValue: async (p, v) => {
        p.settings.horizonVisibility.weeksToShow = parseInt(v as string);
      },
      refreshViews: true,
    },
    {
      type: "dropdown",
      name: "Months ahead",
      desc: "Show upcoming months",
      options: [
        { value: "0", label: "None" },
        { value: "1", label: "1 month" },
        { value: "2", label: "2 months" },
        { value: "3", label: "3 months" },
      ],
      getValue: (p) => p.settings.horizonVisibility.monthsToShow.toString(),
      setValue: async (p, v) => {
        p.settings.horizonVisibility.monthsToShow = parseInt(v as string);
      },
      refreshViews: true,
    },
    {
      type: "toggle",
      name: "Quarters",
      desc: "Show remaining quarters of the year",
      getValue: (p) => p.settings.horizonVisibility.showQuarters,
      setValue: async (p, v) => {
        p.settings.horizonVisibility.showQuarters = v as boolean;
      },
      refreshViews: true,
    },
    {
      type: "toggle",
      name: "Next year",
      desc: "Show a column for next year",
      getValue: (p) => p.settings.horizonVisibility.showNextYear,
      setValue: async (p, v) => {
        p.settings.horizonVisibility.showNextYear = v as boolean;
      },
      refreshViews: true,
    },
  ],
};

export const wipSettings: SubsectionDef = {
  label: "Work Limits",
  settings: [
    {
      type: "text",
      name: "Daily work-in-progress limit",
      desc: "Maximum tasks in progress per day (0 = unlimited)",
      getValue: (p) => p.settings.defaultDailyWipLimit.toString(),
      setValue: async (p, v) => {
        const value = parseInt(v as string);
        p.settings.defaultDailyWipLimit = isNaN(value) ? 0 : value;
      },
      tooltip: "Work-in-progress limits help maintain focus by preventing overcommitment.",
    },
  ],
};

export const quickAddAdvancedSettings: SubsectionDef = {
  label: "Quick Add Options",
  settings: [
    {
      type: "dropdown",
      name: "Placement",
      desc: "Where to add new tasks in the file",
      options: [
        { value: "prepend", label: "Beginning" },
        { value: "append", label: "End" },
        { value: "before-regex", label: "Before regex match" },
        { value: "after-regex", label: "After regex match" },
      ],
      getValue: (p) => p.settings.quickAdd.placement,
      setValue: async (p, v) => {
        p.settings.quickAdd.placement = v as "prepend" | "append" | "before-regex" | "after-regex";
      },
      refreshDisplay: true,
    },
    {
      type: "text",
      name: "Location regex",
      desc: "Regex pattern to find insertion point",
      placeholder: "^## .*",
      getValue: (p) => p.settings.quickAdd.locationRegex,
      setValue: async (p, v) => {
        p.settings.quickAdd.locationRegex = v as string;
      },
      visible: (p) => p.settings.quickAdd.placement === "before-regex" || p.settings.quickAdd.placement === "after-regex",
    },
    {
      type: "text",
      name: "Templater delay",
      desc: "Wait time for templater (ms)",
      getValue: (p) => p.settings.quickAdd.templaterDelay.toString(),
      setValue: async (p, v) => {
        const numValue = parseInt(v as string);
        if (!isNaN(numValue) && numValue >= 0) {
          p.settings.quickAdd.templaterDelay = numValue;
        }
      },
      visible: (p) => p.settings.quickAdd.destination === "daily",
      validate: isNumber,
    },
    {
      type: "text",
      name: "Task pattern",
      desc: "Template for new tasks. Use {task}, {time}, {date}",
      placeholder: "- [ ] {task}",
      getValue: (p) => p.settings.quickAdd.taskPattern,
      setValue: async (p, v) => {
        p.settings.quickAdd.taskPattern = (v as string) || "- [ ] {task}";
      },
    },
  ],
};

export const atShortcutsSettings = (plugin: TaskPlannerPlugin): SettingDef[] => {
  const base: SettingDef[] = [
    {
      type: "toggle",
      name: "Enable @-shortcuts",
      desc: "Converts shortcuts like @today to attributes",
      getValue: (p) => p.settings.atShortcutSettings.enableAtShortcuts,
      setValue: async (p, v) => {
        p.settings.atShortcutSettings.enableAtShortcuts = v as boolean;
      },
      refreshDisplay: true,
    },
  ];

  if (!plugin.settings.atShortcutSettings.enableAtShortcuts) {
    return base;
  }

  return [
    ...base,
    {
      type: "toggle",
      name: "Auto-convert",
      desc: "Convert when leaving a line",
      getValue: (p) => p.settings.autoConvertAttributes,
      setValue: async (p, v) => {
        p.settings.autoConvertAttributes = v as boolean;
      },
    },
    {
      type: "toggle",
      name: "Date shortcuts",
      desc: "@today, @tomorrow, @monday, etc.",
      getValue: (p) => p.settings.atShortcutSettings.enableDateShortcuts,
      setValue: async (p, v) => {
        p.settings.atShortcutSettings.enableDateShortcuts = v as boolean;
      },
    },
    {
      type: "toggle",
      name: "Priority shortcuts",
      desc: "@critical, @high, @medium, @low",
      getValue: (p) => p.settings.atShortcutSettings.enablePriorityShortcuts,
      setValue: async (p, v) => {
        p.settings.atShortcutSettings.enablePriorityShortcuts = v as boolean;
      },
    },
    {
      type: "toggle",
      name: "Pinned shortcut",
      desc: "@pinned to pin tasks",
      getValue: (p) => p.settings.atShortcutSettings.enableBuiltinShortcuts,
      setValue: async (p, v) => {
        p.settings.atShortcutSettings.enableBuiltinShortcuts = v as boolean;
      },
    },
  ];
};

export const indexingSettings: SubsectionDef = {
  label: "Indexing",
  settings: [
    {
      type: "toggle",
      name: "Ignore archived",
      desc: "Skip tasks in archive folder",
      getValue: (p) => p.settings.ignoreArchivedTasks,
      setValue: async (p, v) => {
        p.settings.ignoreArchivedTasks = v as boolean;
      },
    },
    {
      type: "toggle",
      name: "Fuzzy search",
      desc: "Match partial words and typos",
      getValue: (p) => p.settings.fuzzySearch,
      setValue: async (p, v) => {
        p.settings.fuzzySearch = v as boolean;
      },
      refreshViews: true,
    },
  ],
};

export const undoSettings: SubsectionDef = {
  label: "Undo",
  settings: [
    {
      type: "toggle",
      name: "Enable undo for drag-and-drop",
      desc: "Allow undoing task moves with Ctrl/Cmd+Z",
      getValue: (p) => p.settings.undo.enableUndo,
      setValue: async (p, v) => {
        p.settings.undo.enableUndo = v as boolean;
      },
      refreshDisplay: true,
    },
    {
      type: "toggle",
      name: "Show undo toast",
      desc: "Display a notification after drag-and-drop with an undo button",
      getValue: (p) => p.settings.undo.showUndoToast,
      setValue: async (p, v) => {
        p.settings.undo.showUndoToast = v as boolean;
      },
      visible: (p) => p.settings.undo.enableUndo,
    },
  ],
};

export const followUpSettings: SubsectionDef = {
  label: "Follow-up Tasks",
  settings: [
    {
      type: "text",
      name: "Text prefix",
      desc: "Prefix for follow-up tasks",
      placeholder: "Follow up: ",
      getValue: (p) => p.settings.followUp.textPrefix,
      setValue: async (p, v) => {
        p.settings.followUp.textPrefix = v as string;
      },
    },
    {
      type: "toggle",
      name: "Copy tags",
      desc: "Include tags from original task",
      getValue: (p) => p.settings.followUp.copyTags,
      setValue: async (p, v) => {
        p.settings.followUp.copyTags = v as boolean;
      },
    },
    {
      type: "toggle",
      name: "Copy priority",
      desc: "Include priority from original task",
      getValue: (p) => p.settings.followUp.copyPriority,
      setValue: async (p, v) => {
        p.settings.followUp.copyPriority = v as boolean;
      },
    },
  ],
};
