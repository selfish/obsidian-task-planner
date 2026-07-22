import { App, PluginSettingTab, SearchComponent, Setting, SettingDefinitionItem, setIcon } from "obsidian";

import TaskPlannerPlugin from "../main";
import { HorizonColor, CustomHorizon, CustomAtShortcut } from "./types";
import { FolderSuggest } from "../ui/folder-suggest";

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

// Track collapsed state for Advanced section across renders
let advancedSectionCollapsed = true;

export class TaskPlannerSettingsTab extends PluginSettingTab {
  plugin: TaskPlannerPlugin;

  constructor(app: App, plugin: TaskPlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.containerEl.classList.add("th-settings-tab");
  }

  /**
   * Creates a subsection with a subtle label - NOT a Setting element
   */
  private createSubsection(containerEl: HTMLElement, title: string): HTMLElement {
    const subsection = containerEl.createDiv({ cls: "th-subsection" });
    subsection.createDiv({ cls: "th-subsection-label", text: title });
    return subsection;
  }

  /**
   * Creates a collapsible settings section with a header
   */
  private createCollapsibleSection(containerEl: HTMLElement, title: string, collapsed: boolean, onToggle: (collapsed: boolean) => void): HTMLElement {
    const sectionEl = containerEl.createDiv({ cls: "th-collapsible" });

    // Create header that acts as toggle
    const headerEl = sectionEl.createDiv({
      cls: `th-collapsible-header ${collapsed ? "is-collapsed" : ""}`,
    });

    const chevronEl = headerEl.createSpan({ cls: "th-collapsible-chevron" });
    setIcon(chevronEl, "chevron-down");

    headerEl.createSpan({ cls: "th-collapsible-title", text: title });

    // Create content container
    const contentEl = sectionEl.createDiv({
      cls: `th-collapsible-content ${collapsed ? "is-collapsed" : ""}`,
    });

    // Toggle handler
    const toggle = () => {
      const isCollapsed = headerEl.hasClass("is-collapsed");
      if (isCollapsed) {
        headerEl.removeClass("is-collapsed");
        contentEl.removeClass("is-collapsed");
      } else {
        headerEl.addClass("is-collapsed");
        contentEl.addClass("is-collapsed");
      }
      onToggle(!isCollapsed);
    };

    headerEl.addEventListener("click", toggle);
    headerEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    return contentEl;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      { type: "group", heading: "Essential", items: [] },
      {
        type: "group",
        heading: "Quick Add",
        cls: "th-subsection",
        items: [
          {
            name: "Destination",
            desc: "Where to save new tasks created from the planning board",
            control: {
              type: "dropdown",
              key: "quickAdd.destination",
              options: { inbox: "Inbox file", daily: "Daily note" },
            },
          },
          {
            name: "Inbox file",
            desc: "Path to the file where tasks will be saved",
            visible: () => this.plugin.settings.quickAdd.destination === "inbox",
            control: { type: "file", key: "quickAdd.inboxFilePath", placeholder: "Example: inbox.md" },
          },
        ],
      },
      {
        type: "group",
        heading: "Task Attributes",
        cls: "th-subsection",
        items: [
          {
            name: "Due date",
            desc: "Attribute name for task due dates",
            control: { type: "text", key: "dueDateAttribute", placeholder: "Due" },
          },
          {
            name: "Completed date",
            desc: "Attribute name for task completion dates",
            control: { type: "text", key: "completedDateAttribute", placeholder: "Completed" },
          },
          {
            name: "Pinned",
            desc: "Attribute name for pinning tasks to the top",
            control: { type: "text", key: "selectedAttribute", placeholder: "Pinned" },
          },
        ],
      },
      { type: "group", heading: "Horizons", items: [] },
      {
        type: "group",
        heading: "Special Columns",
        cls: "th-subsection",
        items: [
          {
            name: "Backlog",
            desc: "Tasks without a due date",
            control: { type: "toggle", key: "horizonVisibility.showBacklog" },
          },
          {
            name: "Overdue",
            desc: "Tasks past their due date",
            control: { type: "toggle", key: "horizonVisibility.showOverdue" },
          },
          {
            name: "Later",
            desc: "Tasks beyond visible horizons",
            control: { type: "toggle", key: "horizonVisibility.showLater" },
          },
        ],
      },
      {
        type: "group",
        heading: "This Week",
        cls: "th-subsection",
        items: [
          { name: "Visible days", render: (setting) => this.renderWeekdaySelector(setting.settingEl) },
          {
            name: "Week starts on",
            desc: "First day of your work week",
            control: {
              type: "dropdown",
              key: "firstWeekday",
              options: {
                "1": "Monday",
                "2": "Tuesday",
                "3": "Wednesday",
                "4": "Thursday",
                "5": "Friday",
                "6": "Saturday",
                "7": "Sunday",
              },
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Next Week",
        cls: "th-subsection",
        items: [
          {
            name: "Display mode",
            desc: "How to display days in the next week section",
            control: {
              type: "dropdown",
              key: "horizonVisibility.nextWeekMode",
              defaultValue: "same-as-this-week",
              options: {
                "same-as-this-week": "Selected days (same as this week)",
                "rolling-week": "Rolling 7 days from today",
                collapsed: "Single column (all of next week)",
              },
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Future Horizons",
        cls: "th-subsection",
        items: [
          {
            name: "Weeks after next",
            desc: "Additional weeks to show beyond next week",
            control: {
              type: "dropdown",
              key: "horizonVisibility.weeksToShow",
              options: { "0": "None", "1": "1 week (in 2 weeks)", "2": "2 weeks (in 2-3 weeks)", "3": "3 weeks (in 2-4 weeks)" },
            },
          },
          {
            name: "Months ahead",
            desc: "Show upcoming months",
            control: {
              type: "dropdown",
              key: "horizonVisibility.monthsToShow",
              options: { "0": "None", "1": "1 month", "2": "2 months", "3": "3 months" },
            },
          },
          {
            name: "Quarters",
            desc: "Show remaining quarters of the year",
            control: { type: "toggle", key: "horizonVisibility.showQuarters" },
          },
          {
            name: "Next year",
            desc: "Show a column for next year",
            control: { type: "toggle", key: "horizonVisibility.showNextYear" },
          },
        ],
      },
      {
        type: "group",
        heading: "Custom Horizons",
        cls: "th-subsection",
        items: [{ name: "Custom horizons", render: (setting) => this.renderCustomHorizons(setting.settingEl) }],
      },
      {
        name: "Advanced Settings",
        render: (setting) => {
          setting.settingEl.empty();
          setting.settingEl.removeClass("setting-item");
          this.renderAdvancedSettings(setting.settingEl);
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    let value: unknown = this.plugin.settings;
    for (const segment of key.split(".")) {
      if (typeof value !== "object" || value === null) return undefined;
      value = (value as Record<string, unknown>)[segment];
    }

    if (key === "firstWeekday" || key === "horizonVisibility.weeksToShow" || key === "horizonVisibility.monthsToShow") {
      return value?.toString();
    }
    return value;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const attributeKeys = ["dueDateAttribute", "completedDateAttribute", "selectedAttribute"];
    if (attributeKeys.includes(key) && (typeof value !== "string" || !value || value.includes(" "))) return;

    let normalizedValue = value;
    if (key === "firstWeekday" || key === "horizonVisibility.weeksToShow" || key === "horizonVisibility.monthsToShow") {
      normalizedValue = Number.parseInt(String(value));
    }

    const path = key.split(".");
    const property = path.pop();
    let target = this.plugin.settings as unknown as Record<string, unknown>;
    for (const segment of path) {
      target = target[segment] as Record<string, unknown>;
    }
    if (property !== undefined) target[property] = normalizedValue;

    await this.plugin.saveSettings();

    if (key.startsWith("horizonVisibility.") || key === "firstWeekday") {
      this.plugin.refreshPlanningViews();
    }
    if (key === "quickAdd.destination" || key === "firstWeekday") {
      this.update();
    }
  }

  private renderWeekdaySelector(containerEl: HTMLElement): void {
    containerEl.empty();
    containerEl.removeClass("setting-item");
    containerEl.addClass("th-weekday-selector");
    containerEl.createDiv({ cls: "th-weekday-label", text: "Visible days" });
    const weekdayGrid = containerEl.createDiv({ cls: "th-weekday-grid" });

    const allWeekdays = [
      { key: "showMonday", label: "Mon", full: "Monday", dayNum: 1 },
      { key: "showTuesday", label: "Tue", full: "Tuesday", dayNum: 2 },
      { key: "showWednesday", label: "Wed", full: "Wednesday", dayNum: 3 },
      { key: "showThursday", label: "Thu", full: "Thursday", dayNum: 4 },
      { key: "showFriday", label: "Fri", full: "Friday", dayNum: 5 },
      { key: "showSaturday", label: "Sat", full: "Saturday", dayNum: 6 },
      { key: "showSunday", label: "Sun", full: "Sunday", dayNum: 7 },
    ];

    const firstWeekday = this.plugin.settings.firstWeekday || 1;
    const weekdays = [...allWeekdays.filter((day) => day.dayNum >= firstWeekday), ...allWeekdays.filter((day) => day.dayNum < firstWeekday)];

    for (const day of weekdays) {
      const isChecked = this.plugin.settings.horizonVisibility[day.key as keyof typeof this.plugin.settings.horizonVisibility] as boolean;
      const dayButton = weekdayGrid.createEl("button", {
        cls: `th-weekday-btn ${isChecked ? "th-weekday-btn--active" : ""}`,
        attr: { "aria-label": day.full },
      });
      dayButton.createSpan({ cls: "th-weekday-btn-label", text: day.label });
      dayButton.createSpan({ cls: "th-weekday-btn-led" });

      dayButton.addEventListener("click", () => {
        (this.plugin.settings.horizonVisibility as unknown as Record<string, boolean>)[day.key] = !isChecked;
        void this.plugin.saveSettings().then(() => {
          this.plugin.refreshPlanningViews();
          this.update();
        });
      });
    }
  }

  private renderCustomHorizons(containerEl: HTMLElement): void {
    containerEl.empty();
    containerEl.removeClass("setting-item");
    const horizonsContainer = containerEl.createDiv({ cls: "th-horizons-container" });

    this.plugin.settings.customHorizons.forEach((horizon, index) => {
      this.renderHorizonCard(horizonsContainer, horizon, index);
    });

    new Setting(containerEl).addButton((button) => {
      button.setButtonText("Add custom horizon");
      button.setCta();
      button.onClick(async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        this.plugin.settings.customHorizons.push({
          label: "New Horizon",
          date: tomorrow.toISOString().split("T")[0],
          position: "end",
        });

        await this.plugin.saveSettings();
        this.plugin.refreshPlanningViews();
        this.update();
      });
    });
  }

  private renderAdvancedSettings(containerEl: HTMLElement): void {
    // ═══════════════════════════════════════════════════════════════════════════
    // ADVANCED SETTINGS (Collapsible)
    // ═══════════════════════════════════════════════════════════════════════════
    const advancedContent = this.createCollapsibleSection(containerEl, "Advanced Settings", advancedSectionCollapsed, (collapsed) => {
      advancedSectionCollapsed = collapsed;
    });

    // --- Work limits ---
    const wipSection = this.createSubsection(advancedContent, "Work Limits");

    const wipSetting = new Setting(wipSection)
      .setName("Daily work-in-progress limit")
      .setDesc("Maximum tasks in progress per day (0 = unlimited)")
      .addText((txt) =>
        txt.setValue(this.plugin.settings.dailyWipLimit.toString()).onChange(async (txtValue) => {
          const value = Number.parseInt(txtValue);
          this.plugin.settings.dailyWipLimit = Number.isNaN(value) ? 0 : value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    // Add WIP tooltip
    const wipTooltip = wipSetting.nameEl.createSpan({ cls: "th-tooltip-icon" });
    wipTooltip.setAttribute("aria-label", "Work-in-progress limits help maintain focus by preventing overcommitment.");
    setIcon(wipTooltip, "help-circle");

    // --- Quick add advanced ---
    const quickAddAdvanced = this.createSubsection(advancedContent, "Quick Add Options");

    new Setting(quickAddAdvanced)
      .setName("Placement")
      .setDesc("Where to add new tasks in the file")
      .addDropdown((dropdown) => {
        dropdown.addOption("prepend", "Beginning");
        dropdown.addOption("append", "End");
        dropdown.addOption("before-regex", "Before regex match");
        dropdown.addOption("after-regex", "After regex match");
        dropdown.setValue(this.plugin.settings.quickAdd.placement);
        dropdown.onChange(async (value) => {
          this.plugin.settings.quickAdd.placement = value as "prepend" | "append" | "before-regex" | "after-regex";
          await this.plugin.saveSettings();
          this.update();
        });
      });

    const usesRegex = this.plugin.settings.quickAdd.placement === "before-regex" || this.plugin.settings.quickAdd.placement === "after-regex";

    if (usesRegex) {
      new Setting(quickAddAdvanced)
        .setName("Location regex")
        .setDesc("Regex pattern to find insertion point")
        .addText((text) =>
          text
            .setPlaceholder("^## .*")
            .setValue(this.plugin.settings.quickAdd.locationRegex)
            .onChange(async (value) => {
              this.plugin.settings.quickAdd.locationRegex = value;
              await this.plugin.saveSettings();
            })
        );
    }

    if (this.plugin.settings.quickAdd.destination === "daily") {
      new Setting(quickAddAdvanced)
        .setName("Templater delay")
        .setDesc("Wait time for templater (ms)")
        .addText((text) =>
          text.setValue(this.plugin.settings.quickAdd.templaterDelay.toString()).onChange(async (value) => {
            const numValue = parseInt(value);
            if (!isNaN(numValue) && numValue >= 0) {
              this.plugin.settings.quickAdd.templaterDelay = numValue;
              await this.plugin.saveSettings();
            }
          })
        );
    }

    new Setting(quickAddAdvanced)
      .setName("Task pattern")
      .setDesc("Template for new tasks. Use {task}, {time}, {date}")
      .addText((text) =>
        text
          .setPlaceholder("- [ ] {task}")
          .setValue(this.plugin.settings.quickAdd.taskPattern)
          .onChange(async (value) => {
            this.plugin.settings.quickAdd.taskPattern = value || "- [ ] {task}";
            await this.plugin.saveSettings();
          })
      );

    // --- Attribute shorthand ---
    const shorthandSection = this.createSubsection(advancedContent, "@ Shortcuts");

    const atSettings = this.plugin.settings.atShortcutSettings;

    new Setting(shorthandSection)
      .setName("Enable @-shortcuts")
      .setDesc("Converts shortcuts like @today to attributes")
      .addToggle((toggle) =>
        toggle.setValue(atSettings.enableAtShortcuts).onChange(async (value) => {
          this.plugin.settings.atShortcutSettings.enableAtShortcuts = value;
          await this.plugin.saveSettings();
          this.update();
        })
      );

    if (atSettings.enableAtShortcuts) {
      new Setting(shorthandSection)
        .setName("Auto-convert")
        .setDesc("Convert when leaving a line")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.autoConvertAttributes).onChange(async (value) => {
            this.plugin.settings.autoConvertAttributes = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(shorthandSection)
        .setName("Date shortcuts")
        .setDesc("@today, @tomorrow, @monday, etc.")
        .addToggle((toggle) =>
          toggle.setValue(atSettings.enableDateShortcuts).onChange(async (value) => {
            this.plugin.settings.atShortcutSettings.enableDateShortcuts = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(shorthandSection)
        .setName("Priority shortcuts")
        .setDesc("@critical, @high, @medium, @low")
        .addToggle((toggle) =>
          toggle.setValue(atSettings.enablePriorityShortcuts).onChange(async (value) => {
            this.plugin.settings.atShortcutSettings.enablePriorityShortcuts = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(shorthandSection)
        .setName("Pinned shortcut")
        .setDesc("@pinned to pin tasks")
        .addToggle((toggle) =>
          toggle.setValue(atSettings.enableBuiltinShortcuts).onChange(async (value) => {
            this.plugin.settings.atShortcutSettings.enableBuiltinShortcuts = value;
            await this.plugin.saveSettings();
          })
        );

      // Custom shortcuts
      const customShortcutSetting = new Setting(shorthandSection).setName("Custom shortcuts").setDesc("Define your own @shortcuts");

      customShortcutSetting.addButton((button) => {
        button.setButtonText("Add");
        button.setCta();
        button.onClick(async () => {
          this.plugin.settings.atShortcutSettings.customShortcuts.push({
            keyword: "",
            targetAttribute: "",
            value: true,
          });
          await this.plugin.saveSettings();
          this.update();
        });
      });

      if (atSettings.customShortcuts.length > 0) {
        const shortcutsContainer = shorthandSection.createDiv({ cls: "th-shortcuts-container" });
        atSettings.customShortcuts.forEach((shortcut, index) => {
          this.renderShortcutCard(shortcutsContainer, shortcut, index);
        });
      }
    }

    // --- Filtering & indexing ---
    const indexingSection = this.createSubsection(advancedContent, "Indexing");

    let folderSearchInput: SearchComponent | undefined;
    new Setting(indexingSection)
      .setName("Ignored folders")
      .setDesc("Folders to exclude from indexing")
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

          const folder = this.app.vault.getFolderByPath(newFolder);
          if (folder === null) {
            this.showError(indexingSection, `Folder doesn't exist: ${newFolder}`);
            return;
          }

          if (!this.plugin.settings.ignoredFolders.includes(newFolder)) {
            this.plugin.settings.ignoredFolders.push(newFolder);
            await this.plugin.saveSettings();
            folderSearchInput?.setValue("");
            this.update();
          }
        });
      });

    this.plugin.settings.ignoredFolders.forEach((folder) => {
      new Setting(indexingSection).setName(folder).addButton((button) =>
        button.setButtonText("Remove").onClick(async () => {
          this.plugin.settings.ignoredFolders = this.plugin.settings.ignoredFolders.filter((f) => f !== folder);
          await this.plugin.saveSettings();
          this.update();
        })
      );
    });

    new Setting(indexingSection)
      .setName("Ignore archived")
      .setDesc("Skip tasks in archive folder")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ignoreArchivedTasks).onChange(async (value) => {
          this.plugin.settings.ignoreArchivedTasks = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(indexingSection)
      .setName("Fuzzy search")
      .setDesc("Match partial words and typos")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.fuzzySearch).onChange(async (value) => {
          this.plugin.settings.fuzzySearch = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    // --- Undo for drag-and-drop ---
    const undoSection = this.createSubsection(advancedContent, "Undo");

    new Setting(undoSection)
      .setName("Enable undo for drag-and-drop")
      .setDesc("Allow undoing task moves with Ctrl/Cmd+Z")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.undo.enableUndo).onChange(async (value) => {
          this.plugin.settings.undo.enableUndo = value;
          await this.plugin.saveSettings();
          this.update();
        })
      );

    if (this.plugin.settings.undo.enableUndo) {
      new Setting(undoSection)
        .setName("Show undo toast")
        .setDesc("Display a notification after drag-and-drop with an undo button")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.undo.showUndoToast).onChange(async (value) => {
            this.plugin.settings.undo.showUndoToast = value;
            await this.plugin.saveSettings();
          })
        );
    }

    // --- Follow-up tasks ---
    const followUpSection = this.createSubsection(advancedContent, "Follow-up Tasks");

    new Setting(followUpSection)
      .setName("Text prefix")
      .setDesc("Prefix for follow-up tasks")
      .addText((text) =>
        text
          .setPlaceholder("Follow up: ")
          .setValue(this.plugin.settings.followUp.textPrefix)
          .onChange(async (value) => {
            this.plugin.settings.followUp.textPrefix = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(followUpSection)
      .setName("Copy tags")
      .setDesc("Include tags from original task")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.followUp.copyTags).onChange(async (value) => {
          this.plugin.settings.followUp.copyTags = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(followUpSection)
      .setName("Copy priority")
      .setDesc("Include priority from original task")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.followUp.copyPriority).onChange(async (value) => {
          this.plugin.settings.followUp.copyPriority = value;
          await this.plugin.saveSettings();
        })
      );
  }

  private createColorPicker(initialColor: HorizonColor | undefined, onChange: (color: HorizonColor | undefined) => void): HTMLElement {
    const container = createEl("div", { cls: "th-color-picker" });

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

    const popover = container.createEl("div", { cls: "th-color-picker-popover" });

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
        this.update();
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
        this.update();
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
    const errorSpan = containerEl.createEl("span", {
      text: message,
      cls: "th-error",
    });
    setTimeout(() => errorSpan.remove(), 3000);
  }
}
