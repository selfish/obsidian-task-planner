import { App, PluginSettingTab, SearchComponent, Setting, setIcon } from "obsidian";

import TaskPlannerPlugin from "../main";
import { HorizonColor, CustomHorizon } from "./types";
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

export class TaskPlannerSettingsTab extends PluginSettingTab {
  plugin: TaskPlannerPlugin;

  constructor(app: App, plugin: TaskPlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Basic horizons").setHeading();

    const basicDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    basicDesc.setText("Choose which special-purpose columns to display in your planning board.");

    new Setting(containerEl)
      .setName("Backlog")
      .setDesc("Tasks without a due date")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showBacklog).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showBacklog = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(containerEl)
      .setName("Overdue")
      .setDesc("Tasks past their due date that aren't completed")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showOverdue).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showOverdue = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(containerEl)
      .setName("Later")
      .setDesc("Tasks scheduled beyond your visible time horizons")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showLater).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showLater = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(containerEl).setName("Near-term planning").setHeading();

    const nearTermDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    nearTermDesc.setText("Individual days give you detailed control over the current week. Choose which days to show as separate columns.");

    // LED-style weekday selector
    const weekdaySection = containerEl.createDiv({ cls: "th-weekday-selector" });
    const weekdayLabel = weekdaySection.createDiv({ cls: "th-weekday-label" });
    weekdayLabel.setText("Visible weekdays");

    const weekdayGrid = weekdaySection.createDiv({ cls: "th-weekday-grid" });

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

    new Setting(containerEl)
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

    new Setting(containerEl).setName("Future horizons").setHeading();

    const futureDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    futureDesc.setText("Weeks and months provide broader planning horizons. Configure how far ahead you want to plan.");

    new Setting(containerEl)
      .setName("Weeks")
      .setDesc("Show upcoming weeks as individual columns")
      .addDropdown((dropdown) => {
        dropdown.addOption("0", "None");
        dropdown.addOption("1", "1 week");
        dropdown.addOption("2", "2 weeks");
        dropdown.addOption("3", "3 weeks");
        dropdown.addOption("4", "4 weeks");
        dropdown.setValue(this.plugin.settings.horizonVisibility.weeksToShow.toString());
        dropdown.onChange(async (value) => {
          this.plugin.settings.horizonVisibility.weeksToShow = parseInt(value);
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        });
      });

    new Setting(containerEl)
      .setName("Months")
      .setDesc("Show upcoming months for long-term planning")
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

    new Setting(containerEl)
      .setName("Quarters")
      .setDesc("Show remaining quarters of the current year")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showQuarters).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showQuarters = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(containerEl)
      .setName("Next year")
      .setDesc("Show a column for next calendar year")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.horizonVisibility.showNextYear).onChange(async (value) => {
          this.plugin.settings.horizonVisibility.showNextYear = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(containerEl).setName("Work limits").setHeading();

    const limitsDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    limitsDesc.setText("Set limits to avoid overcommitting and maintain sustainable workload.");

    new Setting(containerEl)
      .setName("Daily work in progress limit")
      .setDesc("Maximum tasks in progress per day (0 = unlimited). Columns turn red when exceeded.")
      .addText((txt) =>
        txt.setValue(this.plugin.settings.defaultDailyWipLimit.toString()).onChange(async (txtValue) => {
          const value = Number.parseInt(txtValue);
          this.plugin.settings.defaultDailyWipLimit = Number.isNaN(value) ? 0 : value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("Custom horizons").setHeading();

    const horizonDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    horizonDesc.setText("Create custom date horizons. Optionally stamp a tag when tasks are dropped here.");

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

    new Setting(containerEl).setName("Task attributes").setHeading();

    const attributesDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    attributesDesc.setText("Configure how tasks are tagged and tracked in your Markdown files.");

    new Setting(containerEl)
      .setName("Due date attribute")
      .setDesc("Attribute name for task due dates (no spaces)")
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

    new Setting(containerEl)
      .setName("Completed date attribute")
      .setDesc("Attribute name for task completion dates (no spaces)")
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

    new Setting(containerEl)
      .setName("Pinned attribute")
      .setDesc("Attribute name for pinning/selecting important tasks (no spaces)")
      .addText((text) =>
        text
          .setPlaceholder("Selected")
          .setValue(this.plugin.settings.selectedAttribute)
          .onChange(async (value) => {
            if (value && !value.contains(" ")) {
              this.plugin.settings.selectedAttribute = value;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Auto-convert attributes")
      .setDesc("Automatically convert shorthand attributes (like @high, @today) to dataview format when leaving a line")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoConvertAttributes).onChange(async (value) => {
          this.plugin.settings.autoConvertAttributes = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("Shortcut attributes").setHeading();

    const shortcutDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    shortcutDesc.setText("Control which @shortcuts are recognized. Unknown shortcuts (like @person in wiki links) will be ignored.");

    const atSettings = this.plugin.settings.atShortcutSettings;

    new Setting(containerEl)
      .setName("Enable @ shortcuts")
      .setDesc("Master toggle for all @ shortcut attributes")
      .addToggle((toggle) =>
        toggle.setValue(atSettings.enableAtShortcuts).onChange(async (value) => {
          this.plugin.settings.atShortcutSettings.enableAtShortcuts = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (atSettings.enableAtShortcuts) {
      new Setting(containerEl)
        .setName("Date shortcuts")
        .setDesc("@today, @tomorrow, @monday, etc.")
        .setClass("th-sub-setting")
        .addToggle((toggle) =>
          toggle.setValue(atSettings.enableDateShortcuts).onChange(async (value) => {
            this.plugin.settings.atShortcutSettings.enableDateShortcuts = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(containerEl)
        .setName("Priority shortcuts")
        .setDesc("@critical, @high, @medium, @low, @lowest")
        .setClass("th-sub-setting")
        .addToggle((toggle) =>
          toggle.setValue(atSettings.enablePriorityShortcuts).onChange(async (value) => {
            this.plugin.settings.atShortcutSettings.enablePriorityShortcuts = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(containerEl)
        .setName("Builtin shortcuts")
        .setDesc("@selected for pinning tasks")
        .setClass("th-sub-setting")
        .addToggle((toggle) =>
          toggle.setValue(atSettings.enableBuiltinShortcuts).onChange(async (value) => {
            this.plugin.settings.atShortcutSettings.enableBuiltinShortcuts = value;
            await this.plugin.saveSettings();
          })
        );
    }

    new Setting(containerEl).setName("Filtering & indexing").setHeading();

    const filteringDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    filteringDesc.setText("Control which folders and files are included when scanning for tasks.");

    let folderSearchInput: SearchComponent | undefined;
    new Setting(containerEl)
      .setName("Ignored folders")
      .setDesc("Folders from which you don't want todos to be indexed")
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

          const exists = await this.app.vault.adapter.exists(newFolder, true);
          if (!exists) {
            this.showError(containerEl, `Folder doesn't exist: ${newFolder}`);
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
      new Setting(containerEl).setName(folder).addButton((button) =>
        button.setButtonText("Remove").onClick(async () => {
          this.plugin.settings.ignoredFolders = this.plugin.settings.ignoredFolders.filter((f) => f !== folder);
          await this.plugin.saveSettings();
          this.display();
        })
      );
    });

    new Setting(containerEl)
      .setName("Ignore archived todos")
      .setDesc("Skip todos in files within the archive folder")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ignoreArchivedTodos).onChange(async (value) => {
          this.plugin.settings.ignoreArchivedTodos = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Fuzzy search")
      .setDesc("Enable fuzzy matching when searching for tasks (matches partial words and typos)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.fuzzySearch).onChange(async (value) => {
          this.plugin.settings.fuzzySearch = value;
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
        })
      );

    new Setting(containerEl).setName("Quick add").setHeading();

    const quickAddDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    quickAddDesc.setText("Quickly add tasks from the planning board header using the + button or keyboard shortcut.");

    new Setting(containerEl)
      .setName("Destination")
      .setDesc("Where to save new tasks")
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
      new Setting(containerEl)
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

    new Setting(containerEl)
      .setName("Placement")
      .setDesc("Where to add new tasks in the file")
      .addDropdown((dropdown) => {
        dropdown.addOption("prepend", "Beginning");
        dropdown.addOption("append", "End");
        dropdown.setValue(this.plugin.settings.quickAdd.placement);
        dropdown.onChange(async (value) => {
          this.plugin.settings.quickAdd.placement = value as "prepend" | "append";
          await this.plugin.saveSettings();
        });
      });

    if (this.plugin.settings.quickAdd.destination === "daily") {
      new Setting(containerEl)
        .setName("Templater delay")
        .setDesc("Wait time for templater to process new daily notes (ms)")
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
