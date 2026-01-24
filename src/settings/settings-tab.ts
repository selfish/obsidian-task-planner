import { App, PluginSettingTab, SearchComponent, Setting, setIcon } from "obsidian";

import TaskPlannerPlugin from "../main";
import { HorizonColor, CustomHorizon, CustomAtShortcut } from "./types";
import { FileSuggest } from "../ui/file-suggest";
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

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("th-settings-tab");

    // ═══════════════════════════════════════════════════════════════════════════
    // ESSENTIAL SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    new Setting(containerEl).setName("Essential").setHeading();

    // --- Quick add settings ---
    const quickAddSection = this.createSubsection(containerEl, "Quick Add");

    new Setting(quickAddSection)
      .setName("Destination")
      .setDesc("Where to save new tasks created from the planning board")
      .addDropdown((dropdown) => {
        dropdown.addOption("inbox", "Inbox file");
        dropdown.addOption("daily", "Daily note");
        dropdown.setValue(this.plugin.settings.quickAdd.destination);
        dropdown.onChange(async (value) => {
          this.plugin.settings.quickAdd.destination = value as "inbox" | "daily";
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (this.plugin.settings.quickAdd.destination === "inbox") {
      new Setting(quickAddSection)
        .setName("Inbox file")
        .setDesc("Path to the file where tasks will be saved")
        .addSearch((search) => {
          new FileSuggest(search.inputEl, this.app);
          search.setPlaceholder("Example: inbox.md");
          search.setValue(this.plugin.settings.quickAdd.inboxFilePath);
          search.onChange(async (value) => {
            this.plugin.settings.quickAdd.inboxFilePath = value;
            await this.plugin.saveSettings();
          });
        });
    }

    // --- Task attributes ---
    const attributesSection = this.createSubsection(containerEl, "Task Attributes");

    new Setting(attributesSection)
      .setName("Due date")
      .setDesc("Attribute name for task due dates")
      .addText((text) =>
        text
          .setPlaceholder("Due")
          .setValue(this.plugin.settings.dueDateAttribute)
          .onChange(async (value) => {
            if (value && !value.contains(" ")) {
              this.plugin.settings.dueDateAttribute = value;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(attributesSection)
      .setName("Completed date")
      .setDesc("Attribute name for task completion dates")
      .addText((text) =>
        text
          .setPlaceholder("Completed")
          .setValue(this.plugin.settings.completedDateAttribute)
          .onChange(async (value) => {
            if (value && !value.contains(" ")) {
              this.plugin.settings.completedDateAttribute = value;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(attributesSection)
      .setName("Pinned")
      .setDesc("Attribute name for pinning tasks to the top")
      .addText((text) =>
        text
          .setPlaceholder("Pinned")
          .setValue(this.plugin.settings.selectedAttribute)
          .onChange(async (value) => {
            if (value && !value.contains(" ")) {
              this.plugin.settings.selectedAttribute = value;
              await this.plugin.saveSettings();
            }
          })
      );

    // ═══════════════════════════════════════════════════════════════════════════
    // HORIZONS SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    new Setting(containerEl).setName("Horizons").setHeading();

    // --- Special columns ---
    const specialSection = this.createSubsection(containerEl, "Special Columns");

    new Setting(specialSection)
      .setName("Backlog")
      .setDesc("Tasks without a due date")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showBacklog).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showBacklog = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(specialSection)
      .setName("Overdue")
      .setDesc("Tasks past their due date")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showOverdue).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showOverdue = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(specialSection)
      .setName("Later")
      .setDesc("Tasks beyond visible horizons")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showLater).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showLater = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    // --- This week ---
    const thisWeekSection = this.createSubsection(containerEl, "This Week");

    // LED-style weekday selector
    const weekdaySelector = thisWeekSection.createDiv({ cls: "th-weekday-selector" });
    const weekdayLabel = weekdaySelector.createDiv({ cls: "th-weekday-label" });
    weekdayLabel.setText("Visible days");

    const weekdayGrid = weekdaySelector.createDiv({ cls: "th-weekday-grid" });

    const allWeekdays = [
      { key: "showMonday", label: "Mon", full: "Monday", dayNum: 1 },
      { key: "showTuesday", label: "Tue", full: "Tuesday", dayNum: 2 },
      { key: "showWednesday", label: "Wed", full: "Wednesday", dayNum: 3 },
      { key: "showThursday", label: "Thu", full: "Thursday", dayNum: 4 },
      { key: "showFriday", label: "Fri", full: "Friday", dayNum: 5 },
      { key: "showSaturday", label: "Sat", full: "Saturday", dayNum: 6 },
      { key: "showSunday", label: "Sun", full: "Sunday", dayNum: 7 },
    ];

    // Reorder weekdays to start from the selected first weekday
    const firstWeekday = this.plugin.settings.firstWeekday || 1;
    const weekdays = [...allWeekdays.filter((d) => d.dayNum >= firstWeekday), ...allWeekdays.filter((d) => d.dayNum < firstWeekday)];

    weekdays.forEach((day) => {
      const isChecked = this.plugin.settings.horizonVisibility[day.key as keyof typeof this.plugin.settings.horizonVisibility] as boolean;
      const dayButton = weekdayGrid.createEl("button", {
        cls: `th-weekday-btn ${isChecked ? "th-weekday-btn--active" : ""}`,
        attr: { "aria-label": day.full },
      });
      const labelSpan = dayButton.createSpan({ cls: "th-weekday-btn-label" });
      labelSpan.setText(day.label);
      dayButton.createSpan({ cls: "th-weekday-btn-led" });

      dayButton.addEventListener("click", () => {
        const newValue = !isChecked;
        (this.plugin.settings.horizonVisibility as unknown as Record<string, boolean>)[day.key] = newValue;
        void this.plugin.saveSettings().then(() => {
          this.plugin.refreshPlanningViews();
          this.display();
        });
      });
    });

    new Setting(thisWeekSection)
      .setName("Week starts on")
      .setDesc("First day of your work week")
      .addDropdown((dropDown) => {
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        for (const [index, display] of days.entries()) {
          dropDown.addOption((index + 1).toString(), display);
        }
        dropDown.setValue((this.plugin.settings.firstWeekday || 1).toString());
        dropDown.onChange(async (value: string) => {
          this.plugin.settings.firstWeekday = parseInt(value);
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
          this.display();
        });
      });

    // --- Next week ---
    const nextWeekSection = this.createSubsection(containerEl, "Next Week");

    new Setting(nextWeekSection)
      .setName("Display mode")
      .setDesc("How to display days in the next week section")
      .addDropdown((dropdown) => {
        dropdown.addOption("same-as-this-week", "Selected days (same as this week)");
        dropdown.addOption("rolling-week", "Rolling 7 days from today");
        dropdown.addOption("collapsed", "Single column (all of next week)");
        dropdown.setValue(this.plugin.settings.horizonVisibility.nextWeekMode ?? "same-as-this-week");
        dropdown.onChange(async (value) => {
          this.plugin.settings.horizonVisibility.nextWeekMode = value as "collapsed" | "same-as-this-week" | "rolling-week";
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        });
      });

    // --- Future horizons ---
    const futureSection = this.createSubsection(containerEl, "Future Horizons");

    new Setting(futureSection)
      .setName("Weeks after next")
      .setDesc("Additional weeks to show beyond next week")
      .addDropdown((dropdown) => {
        dropdown.addOption("0", "None");
        dropdown.addOption("1", "1 week (in 2 weeks)");
        dropdown.addOption("2", "2 weeks (in 2-3 weeks)");
        dropdown.addOption("3", "3 weeks (in 2-4 weeks)");
        dropdown.setValue(this.plugin.settings.horizonVisibility.weeksToShow.toString());
        dropdown.onChange(async (value) => {
          this.plugin.settings.horizonVisibility.weeksToShow = parseInt(value);
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        });
      });

    new Setting(futureSection)
      .setName("Months ahead")
      .setDesc("Show upcoming months")
      .addDropdown((dropdown) => {
        dropdown.addOption("0", "None");
        dropdown.addOption("1", "1 month");
        dropdown.addOption("2", "2 months");
        dropdown.addOption("3", "3 months");
        dropdown.setValue(this.plugin.settings.horizonVisibility.monthsToShow.toString());
        dropdown.onChange(async (value) => {
          this.plugin.settings.horizonVisibility.monthsToShow = parseInt(value);
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        });
      });

    new Setting(futureSection)
      .setName("Quarters")
      .setDesc("Show remaining quarters of the year")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showQuarters).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showQuarters = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(futureSection)
      .setName("Next year")
      .setDesc("Show a column for next year")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showNextYear).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showNextYear = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    // --- Custom horizons ---
    const customSection = this.createSubsection(containerEl, "Custom Horizons");

    const horizonsContainer = customSection.createDiv({ cls: "th-horizons-container" });

    this.plugin.settings.customHorizons.forEach((horizon, index) => {
      this.renderHorizonCard(horizonsContainer, horizon, index);
    });

    new Setting(customSection).addButton((button) => {
      button.setButtonText("Add custom horizon");
      button.setCta();
      button.onClick(async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split("T")[0];

        this.plugin.settings.customHorizons.push({
          label: "New Horizon",
          date: dateStr,
          position: "end",
        });

        await this.plugin.saveSettings();
        this.plugin.refreshPlanningViews();
        this.display();
      });
    });

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
        txt.setValue(this.plugin.settings.defaultDailyWipLimit.toString()).onChange(async (txtValue) => {
          const value = Number.parseInt(txtValue);
          this.plugin.settings.defaultDailyWipLimit = Number.isNaN(value) ? 0 : value;
          await this.plugin.saveSettings();
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
          this.display();
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
          this.display();
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
          this.display();
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

          const folder = this.app.vault.getAbstractFileByPath(newFolder);
          if (folder === null) {
            this.showError(indexingSection, `Folder doesn't exist: ${newFolder}`);
            return;
          }

          if (!this.plugin.settings.ignoredFolders.includes(newFolder)) {
            this.plugin.settings.ignoredFolders.push(newFolder);
            await this.plugin.saveSettings();
            folderSearchInput?.setValue("");
            this.display();
          }
        });
      });

    this.plugin.settings.ignoredFolders.forEach((folder) => {
      new Setting(indexingSection).setName(folder).addButton((button) =>
        button.setButtonText("Remove").onClick(async () => {
          this.plugin.settings.ignoredFolders = this.plugin.settings.ignoredFolders.filter((f) => f !== folder);
          await this.plugin.saveSettings();
          this.display();
        })
      );
    });

    new Setting(indexingSection)
      .setName("Ignore archived")
      .setDesc("Skip todos in archive folder")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ignoreArchivedTodos).onChange(async (value) => {
          this.plugin.settings.ignoreArchivedTodos = value;
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
          this.display();
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
        this.display();
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
        this.display();
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
      { value: "end", label: "End" },
    ];
    for (const pos of positions) {
      const option = positionSelect.createEl("option", { value: pos.value, text: pos.label });
      if (horizon.position === pos.value) option.selected = true;
    }
    positionSelect.addEventListener("change", () => {
      this.plugin.settings.customHorizons[index].position = positionSelect.value as "before" | "after" | "end";
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
