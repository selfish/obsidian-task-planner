import { App, PluginSettingTab, SearchComponent, Setting, setIcon, type SettingDefinition, type SettingDefinitionItem } from "obsidian";

import { FileSuggest } from "../ui/file-suggest";
import { FolderSuggest } from "../ui/folder-suggest";

import type TaskPlannerPlugin from "../main";
import type { HorizonColor, CustomHorizon, CustomAtShortcut } from "./types";

const HORIZON_COLORS: { value: HorizonColor; cssVar: string }[] = [
  { value: "red", cssVar: "var(--color-red)" },
  { value: "orange", cssVar: "var(--color-orange)" },
  { value: "yellow", cssVar: "var(--color-yellow)" },
  { value: "green", cssVar: "var(--color-green)" },
  { value: "cyan", cssVar: "var(--color-cyan)" },
  { value: "blue", cssVar: "var(--color-blue)" },
  { value: "purple", cssVar: "var(--color-purple)" },
  { value: "pink", cssVar: "var(--color-pink)" },
  { value: "accent", cssVar: "var(--text-accent)" },
  { value: "success", cssVar: "var(--text-success)" },
  { value: "warning", cssVar: "var(--text-warning)" },
  { value: "error", cssVar: "var(--text-error)" },
];

interface DefinitionChangeOptions {
  refreshPlanning?: boolean;
  refreshTab?: boolean;
}

export class TaskPlannerSettingsTab extends PluginSettingTab {
  plugin: TaskPlannerPlugin;

  constructor(app: App, plugin: TaskPlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private async applyDefinitionChange(options: DefinitionChangeOptions = {}): Promise<void> {
    await this.plugin.saveSettings();
    if (options.refreshPlanning) this.plugin.refreshPlanningViews();
    if (options.refreshTab) this.refreshTab();
  }

  private refreshTab(): void {
    (this as unknown as { update: () => void }).update();
  }

  private toggleDefinition(name: string, desc: string, getValue: () => boolean, setValue: (value: boolean) => void, options: DefinitionChangeOptions = {}): SettingDefinition {
    return {
      name,
      desc,
      render: (setting) => {
        setting.addToggle((toggle) =>
          toggle.setValue(getValue()).onChange(async (value) => {
            setValue(value);
            await this.applyDefinitionChange(options);
          })
        );
      },
    };
  }

  private textDefinition(name: string, desc: string, placeholder: string, getValue: () => string, setValue: (value: string) => boolean | void, options: DefinitionChangeOptions = {}): SettingDefinition {
    return {
      name,
      desc,
      render: (setting) => {
        setting.addText((text) =>
          text
            .setPlaceholder(placeholder)
            .setValue(getValue())
            .onChange(async (value) => {
              if (setValue(value) !== false) await this.applyDefinitionChange(options);
            })
        );
      },
    };
  }

  private dropdownDefinition(name: string, desc: string, options: Record<string, string>, getValue: () => string, setValue: (value: string) => void, changeOptions: DefinitionChangeOptions = {}): SettingDefinition {
    return {
      name,
      desc,
      render: (setting) => {
        setting.addDropdown((dropdown) => {
          for (const [value, label] of Object.entries(options)) dropdown.addOption(value, label);
          dropdown.setValue(getValue());
          dropdown.onChange(async (value) => {
            setValue(value);
            await this.applyDefinitionChange(changeOptions);
          });
        });
      },
    };
  }

  /**
   * Declarative definitions are used for rendering and settings search on
   * Obsidian 1.13+. display() remains as the compatible fallback for older
   * Obsidian versions.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.plugin.settings;

    const essential: SettingDefinitionItem[] = [
      {
        type: "group",
        heading: "Quick add",
        items: [
          this.dropdownDefinition(
            "Destination",
            "Where to save new tasks created from the planning board",
            { inbox: "Inbox file", daily: "Daily note" },
            () => settings.quickAdd.destination,
            (value) => {
              settings.quickAdd.destination = value as "inbox" | "daily";
            },
            { refreshTab: true }
          ),
          {
            name: "Inbox file",
            desc: "Path to the file where tasks will be saved",
            visible: () => settings.quickAdd.destination === "inbox",
            render: (setting) => {
              setting.addSearch((search) => {
                new FileSuggest(search.inputEl, this.app);
                search.setPlaceholder("Example: inbox.md");
                search.setValue(settings.quickAdd.inboxFilePath);
                search.onChange(async (value) => {
                  settings.quickAdd.inboxFilePath = value;
                  await this.applyDefinitionChange();
                });
              });
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Task attributes",
        items: [
          this.textDefinition(
            "Due date",
            "Attribute name for task due dates",
            "Due",
            () => settings.dueDateAttribute,
            (value) => {
              if (!value || value.includes(" ")) return false;
              settings.dueDateAttribute = value;
              return true;
            }
          ),
          this.textDefinition(
            "Completed date",
            "Attribute name for task completion dates",
            "Completed",
            () => settings.completedDateAttribute,
            (value) => {
              if (!value || value.includes(" ")) return false;
              settings.completedDateAttribute = value;
              return true;
            }
          ),
          this.textDefinition(
            "Pinned",
            "Attribute name for pinning tasks to the top",
            "Pinned",
            () => settings.selectedAttribute,
            (value) => {
              if (!value || value.includes(" ")) return false;
              settings.selectedAttribute = value;
              return true;
            }
          ),
        ],
      },
    ];

    const horizons: SettingDefinitionItem[] = [
      {
        type: "group",
        heading: "Board layout",
        items: [
          this.dropdownDefinition(
            "Horizons per column",
            "Maximum horizon boards stacked vertically before starting a new column",
            { "1": "1 (full height)", "2": "2", "3": "3", "4": "4" },
            () => settings.horizonsPerColumn.toString(),
            (value) => {
              settings.horizonsPerColumn = Number.parseInt(value);
            },
            { refreshPlanning: true }
          ),
        ],
      },
      {
        type: "group",
        heading: "Special columns",
        items: [
          this.toggleDefinition(
            "Backlog",
            "Tasks without a due date",
            () => settings.horizonVisibility.showBacklog,
            (value) => {
              settings.horizonVisibility.showBacklog = value;
            },
            { refreshPlanning: true }
          ),
          this.toggleDefinition(
            "Overdue",
            "Tasks past their due date",
            () => settings.horizonVisibility.showOverdue,
            (value) => {
              settings.horizonVisibility.showOverdue = value;
            },
            { refreshPlanning: true }
          ),
          this.toggleDefinition(
            "Later",
            "Tasks beyond visible horizons",
            () => settings.horizonVisibility.showLater,
            (value) => {
              settings.horizonVisibility.showLater = value;
            },
            { refreshPlanning: true }
          ),
        ],
      },
      {
        type: "group",
        heading: "This week",
        items: [
          {
            name: "Visible days",
            desc: "Days shown in the current week",
            render: (setting) => {
              const weekdayGrid = setting.controlEl.createDiv({ cls: "th-weekday-grid" });
              const allWeekdays = [
                { key: "showMonday", label: "Mon", full: "Monday", dayNum: 1 },
                { key: "showTuesday", label: "Tue", full: "Tuesday", dayNum: 2 },
                { key: "showWednesday", label: "Wed", full: "Wednesday", dayNum: 3 },
                { key: "showThursday", label: "Thu", full: "Thursday", dayNum: 4 },
                { key: "showFriday", label: "Fri", full: "Friday", dayNum: 5 },
                { key: "showSaturday", label: "Sat", full: "Saturday", dayNum: 6 },
                { key: "showSunday", label: "Sun", full: "Sunday", dayNum: 7 },
              ] as const;
              const firstWeekday = settings.firstWeekday || 1;
              const weekdays = [...allWeekdays.filter((day) => day.dayNum >= firstWeekday), ...allWeekdays.filter((day) => day.dayNum < firstWeekday)];

              for (const day of weekdays) {
                const isChecked = settings.horizonVisibility[day.key];
                const dayButton = weekdayGrid.createEl("button", {
                  cls: `th-weekday-btn ${isChecked ? "th-weekday-btn--active" : ""}`,
                  attr: { "aria-label": day.full, type: "button" },
                });
                dayButton.createSpan({ cls: "th-weekday-btn-label", text: day.label });
                dayButton.createSpan({ cls: "th-weekday-btn-led" });
                dayButton.addEventListener("click", () => {
                  settings.horizonVisibility[day.key] = !isChecked;
                  void this.applyDefinitionChange({ refreshPlanning: true, refreshTab: true });
                });
              }
            },
          },
          this.dropdownDefinition(
            "Week starts on",
            "First day of your work week",
            { "1": "Monday", "2": "Tuesday", "3": "Wednesday", "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday" },
            () => (settings.firstWeekday || 1).toString(),
            (value) => {
              settings.firstWeekday = Number.parseInt(value);
            },
            { refreshPlanning: true, refreshTab: true }
          ),
        ],
      },
      {
        type: "group",
        heading: "Next week",
        items: [
          this.dropdownDefinition(
            "Display mode",
            "How to display days in the next week section",
            {
              "same-as-this-week": "Selected days (same as this week)",
              "rolling-week": "Rolling 7 days from today",
              collapsed: "Single column (all of next week)",
            },
            () => settings.horizonVisibility.nextWeekMode ?? "same-as-this-week",
            (value) => {
              settings.horizonVisibility.nextWeekMode = value as "collapsed" | "same-as-this-week" | "rolling-week";
            },
            { refreshPlanning: true }
          ),
        ],
      },
      {
        type: "group",
        heading: "Future horizons",
        items: [
          this.dropdownDefinition(
            "Weeks after next",
            "Additional weeks to show beyond next week",
            { "0": "None", "1": "1 week (in 2 weeks)", "2": "2 weeks (in 2-3 weeks)", "3": "3 weeks (in 2-4 weeks)" },
            () => settings.horizonVisibility.weeksToShow.toString(),
            (value) => {
              settings.horizonVisibility.weeksToShow = Number.parseInt(value);
            },
            { refreshPlanning: true }
          ),
          this.dropdownDefinition(
            "Months ahead",
            "Show upcoming months",
            { "0": "None", "1": "1 month", "2": "2 months", "3": "3 months" },
            () => settings.horizonVisibility.monthsToShow.toString(),
            (value) => {
              settings.horizonVisibility.monthsToShow = Number.parseInt(value);
            },
            { refreshPlanning: true }
          ),
          this.toggleDefinition(
            "Quarters",
            "Show remaining quarters of the year",
            () => settings.horizonVisibility.showQuarters,
            (value) => {
              settings.horizonVisibility.showQuarters = value;
            },
            { refreshPlanning: true }
          ),
          this.toggleDefinition(
            "Next year",
            "Show a column for next year",
            () => settings.horizonVisibility.showNextYear,
            (value) => {
              settings.horizonVisibility.showNextYear = value;
            },
            { refreshPlanning: true }
          ),
        ],
      },
      {
        type: "group",
        heading: "Custom horizons",
        items: [
          {
            name: "Custom horizons",
            desc: "Date, tag, color, and placement for custom planning columns",
            render: (setting) => {
              const horizonsContainer = setting.settingEl.createDiv({ cls: "th-horizons-container" });
              settings.customHorizons.forEach((horizon, index) => {
                this.renderHorizonCard(horizonsContainer, horizon, index);
              });
              setting.addButton((button) => {
                button.setButtonText("Add custom horizon");
                button.setCta();
                button.onClick(async () => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const date = tomorrow.toISOString().split("T")[0];
                  settings.customHorizons.push({ label: "New Horizon", date, position: "end" });
                  await this.applyDefinitionChange({ refreshPlanning: true, refreshTab: true });
                });
              });
            },
          },
        ],
      },
    ];

    const advanced: SettingDefinitionItem[] = [
      {
        type: "group",
        heading: "Work limits",
        items: [
          {
            name: "Daily work-in-progress limit",
            desc: "Maximum tasks in progress per day (0 = unlimited)",
            aliases: ["WIP limit"],
            render: (setting) => {
              setting.addText((text) =>
                text.setValue(settings.dailyWipLimit.toString()).onChange(async (value) => {
                  const parsed = Number.parseInt(value);
                  settings.dailyWipLimit = Number.isNaN(parsed) ? 0 : parsed;
                  await this.applyDefinitionChange({ refreshPlanning: true });
                })
              );
              const tooltip = setting.nameEl.createSpan({ cls: "th-tooltip-icon" });
              tooltip.setAttribute("aria-label", "Work-in-progress limits help maintain focus by preventing overcommitment.");
              setIcon(tooltip, "help-circle");
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Quick add options",
        items: [
          this.dropdownDefinition(
            "Placement",
            "Where to add new tasks in the file",
            { prepend: "Beginning", append: "End", "before-regex": "Before regex match", "after-regex": "After regex match" },
            () => settings.quickAdd.placement,
            (value) => {
              settings.quickAdd.placement = value as "prepend" | "append" | "before-regex" | "after-regex";
            },
            { refreshTab: true }
          ),
          {
            ...this.textDefinition(
              "Location regex",
              "Regex pattern to find insertion point",
              "^## .*",
              () => settings.quickAdd.locationRegex,
              (value) => {
                settings.quickAdd.locationRegex = value;
              }
            ),
            visible: () => settings.quickAdd.placement === "before-regex" || settings.quickAdd.placement === "after-regex",
          },
          {
            name: "Templater delay",
            desc: "Wait time for templater (ms)",
            visible: () => settings.quickAdd.destination === "daily",
            render: (setting) => {
              setting.addText((text) =>
                text.setValue(settings.quickAdd.templaterDelay.toString()).onChange(async (value) => {
                  const parsed = Number.parseInt(value);
                  if (!Number.isNaN(parsed) && parsed >= 0) {
                    settings.quickAdd.templaterDelay = parsed;
                    await this.applyDefinitionChange();
                  }
                })
              );
            },
          },
          this.textDefinition(
            "Task pattern",
            "Template for new tasks. Use {task}, {time}, {date}",
            "- [ ] {task}",
            () => settings.quickAdd.taskPattern,
            (value) => {
              settings.quickAdd.taskPattern = value || "- [ ] {task}";
            }
          ),
        ],
      },
      {
        type: "group",
        heading: "@ shortcuts",
        items: [
          this.toggleDefinition(
            "Enable @-shortcuts",
            "Converts shortcuts like @today to attributes",
            () => settings.atShortcutSettings.enableAtShortcuts,
            (value) => {
              settings.atShortcutSettings.enableAtShortcuts = value;
            },
            { refreshTab: true }
          ),
          {
            ...this.toggleDefinition(
              "Auto-convert",
              "Convert when leaving a line",
              () => settings.autoConvertAttributes,
              (value) => {
                settings.autoConvertAttributes = value;
              }
            ),
            visible: () => settings.atShortcutSettings.enableAtShortcuts,
          },
          {
            ...this.toggleDefinition(
              "Date shortcuts",
              "@today, @tomorrow, @monday, etc.",
              () => settings.atShortcutSettings.enableDateShortcuts,
              (value) => {
                settings.atShortcutSettings.enableDateShortcuts = value;
              }
            ),
            visible: () => settings.atShortcutSettings.enableAtShortcuts,
          },
          {
            ...this.toggleDefinition(
              "Priority shortcuts",
              "@critical, @high, @medium, @low",
              () => settings.atShortcutSettings.enablePriorityShortcuts,
              (value) => {
                settings.atShortcutSettings.enablePriorityShortcuts = value;
              }
            ),
            visible: () => settings.atShortcutSettings.enableAtShortcuts,
          },
          {
            ...this.toggleDefinition(
              "Pinned shortcut",
              "@pinned to pin tasks",
              () => settings.atShortcutSettings.enableBuiltinShortcuts,
              (value) => {
                settings.atShortcutSettings.enableBuiltinShortcuts = value;
              }
            ),
            visible: () => settings.atShortcutSettings.enableAtShortcuts,
          },
          {
            name: "Custom shortcuts",
            desc: "Define your own @shortcuts",
            visible: () => settings.atShortcutSettings.enableAtShortcuts,
            render: (setting) => {
              const shortcutsContainer = setting.settingEl.createDiv({ cls: "th-shortcuts-container" });
              settings.atShortcutSettings.customShortcuts.forEach((shortcut, index) => {
                this.renderShortcutCard(shortcutsContainer, shortcut, index);
              });
              setting.addButton((button) => {
                button.setButtonText("Add");
                button.setCta();
                button.onClick(async () => {
                  settings.atShortcutSettings.customShortcuts.push({ keyword: "", targetAttribute: "", value: true });
                  await this.applyDefinitionChange({ refreshTab: true });
                });
              });
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Indexing",
        items: [
          {
            name: "Ignored folders",
            desc: "Folders to exclude from indexing",
            render: (setting) => {
              let folderSearchInput: SearchComponent | undefined;
              setting
                .addSearch((search) => {
                  folderSearchInput = search;
                  new FolderSuggest(search.inputEl, this.app);
                  search.setPlaceholder("Example: archive");
                })
                .addButton((button) => {
                  button.setIcon("plus");
                  button.setTooltip("Add folder");
                  button.onClick(async () => {
                    if (folderSearchInput === undefined) return;
                    const newFolder = folderSearchInput.getValue();
                    if (!newFolder) return;
                    if (this.app.vault.getAbstractFileByPath(newFolder) === null) {
                      this.showError(setting.settingEl, `Folder doesn't exist: ${newFolder}`);
                      return;
                    }
                    if (!settings.ignoredFolders.includes(newFolder)) {
                      settings.ignoredFolders.push(newFolder);
                      await this.applyDefinitionChange({ refreshTab: true });
                    }
                  });
                });

              const foldersContainer = setting.settingEl.createDiv({ cls: "th-ignored-folders" });
              settings.ignoredFolders.forEach((folder) => {
                new Setting(foldersContainer).setName(folder).addButton((button) =>
                  button.setButtonText("Remove").onClick(async () => {
                    settings.ignoredFolders = settings.ignoredFolders.filter((candidate) => candidate !== folder);
                    await this.applyDefinitionChange({ refreshTab: true });
                  })
                );
              });
            },
          },
          this.toggleDefinition(
            "Ignore archived",
            "Skip tasks in archive folder",
            () => settings.ignoreArchivedTasks,
            (value) => {
              settings.ignoreArchivedTasks = value;
            }
          ),
          this.toggleDefinition(
            "Fuzzy search",
            "Match partial words and typos",
            () => settings.fuzzySearch,
            (value) => {
              settings.fuzzySearch = value;
            },
            { refreshPlanning: true }
          ),
        ],
      },
      {
        type: "group",
        heading: "Undo",
        items: [
          this.toggleDefinition(
            "Enable undo for drag-and-drop",
            "Allow undoing task moves with Ctrl/Cmd+Z",
            () => settings.undo.enableUndo,
            (value) => {
              settings.undo.enableUndo = value;
            },
            { refreshTab: true }
          ),
          {
            name: "Undo history size",
            desc: "Maximum actions kept in memory",
            visible: () => settings.undo.enableUndo,
            render: (setting) => {
              setting.addText((text) =>
                text.setValue(settings.undo.undoHistorySize.toString()).onChange(async (value) => {
                  const parsed = Number.parseInt(value);
                  if (parsed > 0) {
                    settings.undo.undoHistorySize = parsed;
                    await this.applyDefinitionChange({ refreshPlanning: true });
                  }
                })
              );
            },
          },
          {
            name: "Undo history lifetime",
            desc: "Seconds before an action can no longer be undone (0 = no expiry)",
            visible: () => settings.undo.enableUndo,
            render: (setting) => {
              setting.addText((text) =>
                text.setValue(settings.undo.undoHistoryMaxAgeSeconds.toString()).onChange(async (value) => {
                  const parsed = Number.parseInt(value);
                  if (parsed >= 0) {
                    settings.undo.undoHistoryMaxAgeSeconds = parsed;
                    await this.applyDefinitionChange({ refreshPlanning: true });
                  }
                })
              );
            },
          },
          {
            ...this.toggleDefinition(
              "Show undo toast",
              "Display a notification after drag-and-drop with an undo button",
              () => settings.undo.showUndoToast,
              (value) => {
                settings.undo.showUndoToast = value;
              },
              { refreshTab: true }
            ),
            visible: () => settings.undo.enableUndo,
          },
          {
            name: "Undo notification duration",
            desc: "Milliseconds before the undo notification closes (0 = stay open)",
            visible: () => settings.undo.enableUndo && settings.undo.showUndoToast,
            render: (setting) => {
              setting.addText((text) =>
                text.setValue(settings.undo.undoToastDurationMs.toString()).onChange(async (value) => {
                  const parsed = Number.parseInt(value);
                  if (parsed >= 0) {
                    settings.undo.undoToastDurationMs = parsed;
                    await this.applyDefinitionChange({ refreshPlanning: true });
                  }
                })
              );
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Follow-up tasks",
        items: [
          this.textDefinition(
            "Text prefix",
            "Prefix for follow-up tasks",
            "Follow up: ",
            () => settings.followUp.textPrefix,
            (value) => {
              settings.followUp.textPrefix = value;
            }
          ),
          this.toggleDefinition(
            "Copy tags",
            "Include tags from original task",
            () => settings.followUp.copyTags,
            (value) => {
              settings.followUp.copyTags = value;
            }
          ),
          this.toggleDefinition(
            "Copy priority",
            "Include priority from original task",
            () => settings.followUp.copyPriority,
            (value) => {
              settings.followUp.copyPriority = value;
            }
          ),
        ],
      },
    ];

    return [
      { type: "page", name: "Essential", items: essential },
      { type: "page", name: "Horizons", items: horizons },
      { type: "page", name: "Advanced", items: advanced },
    ];
  }

  private createColorPicker(initialColor: HorizonColor | undefined, onChange: (color: HorizonColor | undefined) => void): HTMLElement {
    const container = createDiv({ cls: "th-color-picker" });

    const trigger = container.createEl("button", {
      cls: "th-color-picker-trigger clickable-icon",
      attr: { "aria-label": "Select color", type: "button" },
    });

    const updateTrigger = (color: HorizonColor | undefined) => {
      trigger.empty();
      if (color) {
        const colorDef = HORIZON_COLORS.find((c) => c.value === color);
        if (colorDef) {
          trigger.style.setProperty("--trigger-color", colorDef.cssVar);
          trigger.removeClass("th-color-picker-trigger--none");
        }
      } else {
        trigger.style.removeProperty("--trigger-color");
        trigger.addClass("th-color-picker-trigger--none");
        const icon = trigger.createSpan({ cls: "th-color-picker-trigger-icon" });
        setIcon(icon, "palette");
      }
    };

    updateTrigger(initialColor);

    const popover = container.createDiv({ cls: "th-color-picker-popover" });

    const noneBtn = popover.createEl("button", {
      cls: `th-color-swatch th-color-swatch--none clickable-icon ${!initialColor ? "th-color-swatch--selected" : ""}`,
      attr: { "aria-label": "No color", type: "button" },
    });
    const noneIcon = noneBtn.createSpan({ cls: "th-color-swatch-icon" });
    setIcon(noneIcon, "ban");

    noneBtn.addEventListener("click", () => {
      popover.querySelectorAll(".th-color-swatch").forEach((el) => el.removeClass("th-color-swatch--selected"));
      noneBtn.addClass("th-color-swatch--selected");
      updateTrigger(undefined);
      onChange(undefined);
    });

    for (const { value, cssVar } of HORIZON_COLORS) {
      const swatch = popover.createEl("button", {
        cls: `th-color-swatch clickable-icon ${initialColor === value ? "th-color-swatch--selected" : ""}`,
        attr: { "aria-label": value, type: "button" },
      });
      swatch.style.setProperty("--swatch-color", cssVar);

      swatch.addEventListener("click", () => {
        popover.querySelectorAll(".th-color-swatch").forEach((el) => el.removeClass("th-color-swatch--selected"));
        swatch.addClass("th-color-swatch--selected");
        updateTrigger(value);
        onChange(value);
      });
    }

    return container;
  }

  private renderShortcutCard(container: HTMLElement, shortcut: CustomAtShortcut, index: number): void {
    const card = container.createDiv({ cls: "th-shortcut-card" });

    const row = card.createDiv({ cls: "th-shortcut-card-row" });

    // @ prefix
    row.createSpan({ cls: "th-shortcut-prefix", text: "@" });

    // Keyword input
    const keywordInput = row.createEl("input", {
      type: "text",
      cls: "th-shortcut-keyword",
      value: shortcut.keyword,
      attr: { placeholder: "Keyword" },
    });
    keywordInput.addEventListener("change", () => {
      this.plugin.settings.atShortcutSettings.customShortcuts[index].keyword = keywordInput.value.trim().toLowerCase();
      void this.plugin.saveSettings();
    });

    // Arrow
    row.createSpan({ cls: "th-shortcut-arrow", text: "→" });

    // Attribute name input
    const attrInput = row.createEl("input", {
      type: "text",
      cls: "th-shortcut-attr",
      value: shortcut.targetAttribute,
      attr: { placeholder: "Attribute" },
    });
    attrInput.addEventListener("change", () => {
      this.plugin.settings.atShortcutSettings.customShortcuts[index].targetAttribute = attrInput.value.trim();
      void this.plugin.saveSettings();
    });

    // Value type selector
    const valueSelect = row.createEl("select", { cls: "th-shortcut-value-type dropdown" });
    const valueTypes = [
      { value: "true", label: ":: true" },
      { value: "custom", label: ":: value" },
    ];
    for (const vt of valueTypes) {
      const option = valueSelect.createEl("option", { value: vt.value, text: vt.label });
      if ((shortcut.value === true && vt.value === "true") || (shortcut.value !== true && vt.value === "custom")) {
        option.selected = true;
      }
    }

    // Custom value input (shown only when value type is custom)
    const valueInput = row.createEl("input", {
      type: "text",
      cls: "th-shortcut-value",
      value: shortcut.value === true ? "" : shortcut.value,
      attr: { placeholder: "Value" },
    });
    if (shortcut.value === true) {
      valueInput.addClass("th-hidden");
    }

    valueSelect.addEventListener("change", () => {
      if (valueSelect.value === "true") {
        this.plugin.settings.atShortcutSettings.customShortcuts[index].value = true;
        valueInput.addClass("th-hidden");
      } else {
        this.plugin.settings.atShortcutSettings.customShortcuts[index].value = valueInput.value.trim() || "value";
        valueInput.removeClass("th-hidden");
      }
      void this.plugin.saveSettings();
    });

    valueInput.addEventListener("change", () => {
      this.plugin.settings.atShortcutSettings.customShortcuts[index].value = valueInput.value.trim() || "value";
      void this.plugin.saveSettings();
    });

    // Delete button
    const deleteBtn = row.createEl("button", {
      cls: "th-shortcut-delete clickable-icon",
      attr: { "aria-label": "Delete", type: "button" },
    });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.plugin.settings.atShortcutSettings.customShortcuts.splice(index, 1);
      void this.plugin.saveSettings().then(() => {
        this.refreshTab();
      });
    });
  }

  private renderHorizonCard(container: HTMLElement, horizon: CustomHorizon, index: number): void {
    const card = container.createDiv({ cls: "th-horizon-card" });

    const row1 = card.createDiv({ cls: "th-horizon-card-row" });

    const colorPicker = this.createColorPicker(horizon.color, (color) => {
      this.plugin.settings.customHorizons[index].color = color;
      void this.plugin.saveSettings().then(() => {
        this.plugin.refreshPlanningViews();
      });
    });
    row1.appendChild(colorPicker);

    const labelInput = row1.createEl("input", {
      type: "text",
      cls: "th-horizon-label",
      value: horizon.label,
      attr: { placeholder: "Horizon name" },
    });
    labelInput.addEventListener("change", () => {
      this.plugin.settings.customHorizons[index].label = labelInput.value.trim();
      void this.plugin.saveSettings().then(() => {
        this.plugin.refreshPlanningViews();
      });
    });

    const deleteBtn = row1.createEl("button", {
      cls: "th-horizon-delete clickable-icon",
      attr: { "aria-label": "Delete", type: "button" },
    });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.plugin.settings.customHorizons.splice(index, 1);
      void this.plugin.saveSettings().then(() => {
        this.plugin.refreshPlanningViews();
        this.refreshTab();
      });
    });

    const row2 = card.createDiv({ cls: "th-horizon-card-row th-horizon-card-row--details" });

    const dateInput = row2.createEl("input", {
      type: "date",
      cls: "th-horizon-date",
      value: horizon.date,
    });
    dateInput.addEventListener("change", () => {
      this.plugin.settings.customHorizons[index].date = dateInput.value;
      void this.plugin.saveSettings().then(() => {
        this.plugin.refreshPlanningViews();
      });
    });

    const tagWrapper = row2.createDiv({ cls: "th-horizon-tag-wrapper" });
    tagWrapper.createSpan({ cls: "th-horizon-tag-prefix", text: "#" });
    const tagInput = tagWrapper.createEl("input", {
      type: "text",
      cls: "th-horizon-tag",
      value: horizon.tag || "",
      attr: { placeholder: "Tag" },
    });
    tagInput.addEventListener("change", () => {
      this.plugin.settings.customHorizons[index].tag = tagInput.value.trim() || undefined;
      void this.plugin.saveSettings().then(() => {
        this.plugin.refreshPlanningViews();
      });
    });

    const positionSelect = row2.createEl("select", { cls: "th-horizon-position dropdown" });
    const positions = [
      { value: "before", label: "Before backlog" },
      { value: "after", label: "After backlog" },
      { value: "inline", label: "On its date" },
      { value: "end", label: "End" },
    ];
    for (const pos of positions) {
      const option = positionSelect.createEl("option", { value: pos.value, text: pos.label });
      if (horizon.position === pos.value) option.selected = true;
    }
    positionSelect.addEventListener("change", () => {
      this.plugin.settings.customHorizons[index].position = positionSelect.value as "before" | "after" | "end" | "inline";
      void this.plugin.saveSettings().then(() => {
        this.plugin.refreshPlanningViews();
      });
    });
  }

  private showError(containerEl: HTMLElement, message: string): void {
    const errorSpan = containerEl.createSpan({
      text: message,
      cls: "th-error",
    });
    (containerEl.ownerDocument.defaultView ?? window).setTimeout(() => errorSpan.remove(), 3000);
  }
}
