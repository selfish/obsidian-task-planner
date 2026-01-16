import TaskPlannerPlugin from "../main";
import { App, PluginSettingTab, SearchComponent, Setting } from "obsidian";
import { FolderSuggest } from "../ui/FolderSuggest";

export class TaskPlannerSettingsTab extends PluginSettingTab {
  plugin: TaskPlannerPlugin;

  constructor(app: App, plugin: TaskPlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // === BASIC HORIZONS ===
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

    // === NEAR-TERM PLANNING ===
    new Setting(containerEl).setName("Near-term planning").setHeading();

    const nearTermDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    nearTermDesc.setText("Individual days give you detailed control over the current week. Choose which days to show as separate columns.");

    // Calendar-style weekday selector
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
      const dayButton = weekdayGrid.createDiv({ cls: "th-weekday-button" });
      const isChecked = this.plugin.settings.horizonVisibility[day.key as keyof typeof this.plugin.settings.horizonVisibility] as boolean;
      if (isChecked) {
        dayButton.addClass("th-weekday-button--active");
      }
      dayButton.setText(day.label);
      dayButton.setAttribute("aria-label", day.full);
      dayButton.addEventListener("click", () => {
        const newValue = !isChecked;
        (this.plugin.settings.horizonVisibility as unknown as Record<string, boolean>)[day.key] = newValue;
        void this.plugin
          .saveSettings()
          .then(() => this.plugin.refreshPlanningViews())
          .then(() => this.display());
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
        dropDown.onChange((value: string) => {
          this.plugin.settings.firstWeekday = parseInt(value);
          void this.plugin.saveSettings().then(() => {
            this.plugin.refreshPlanningViews();
            this.display();
          });
        });
      });

    // === FUTURE HORIZONS ===
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

    // === WORK LIMITS ===
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

    // === CUSTOM HORIZONS ===
    new Setting(containerEl).setName("Custom horizons").setHeading();

    const horizonDesc = containerEl.createDiv({ cls: "setting-item-description th-settings-desc" });
    horizonDesc.setText("Create custom horizons filtered by tag or for specific dates");

    let labelInput: HTMLInputElement;
    let tagInput: HTMLInputElement;
    let dateInput: HTMLInputElement;
    let positionDropdown: HTMLSelectElement;

    const horizonInputContainer = containerEl.createDiv({ cls: "th-horizon-input-container" });

    new Setting(horizonInputContainer)
      .setName("New horizon")
      .addText((text) => {
        labelInput = text.inputEl;
        text.setPlaceholder("Label");
        text.inputEl.addClass("th-input-label");
      })
      .addText((text) => {
        tagInput = text.inputEl;
        text.setPlaceholder("Tag (optional)");
        text.inputEl.addClass("th-input-tag");
      })
      .addText((text) => {
        dateInput = text.inputEl;
        text.setPlaceholder("Date yyyy-mm-dd (optional)");
        text.inputEl.addClass("th-input-date");
      })
      .addDropdown((dropdown) => {
        positionDropdown = dropdown.selectEl;
        dropdown.addOption("before", "Before backlog");
        dropdown.addOption("after", "After backlog");
        dropdown.addOption("end", "End");
        dropdown.setValue("end");
      })
      .addButton((button) => {
        button.setIcon("plus");
        button.setTooltip("Add horizon");
        button.onClick(async () => {
          const label = labelInput.value.trim();
          const tag = tagInput.value.trim();
          const date = dateInput.value.trim();
          const position = positionDropdown.value as "before" | "after" | "end";

          if (!label) {
            this.showError(containerEl, "Label is required");
            return;
          }

          if (!tag && !date) {
            this.showError(containerEl, "Either tag or date must be provided");
            return;
          }

          if (tag && date) {
            this.showError(containerEl, "Cannot have both tag and date - choose one");
            return;
          }

          if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            this.showError(containerEl, "Invalid date format (use YYYY-MM-DD)");
            return;
          }

          this.plugin.settings.customHorizons.push({
            label,
            tag: tag || undefined,
            date: date || undefined,
            position,
          });

          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();

          labelInput.value = "";
          tagInput.value = "";
          dateInput.value = "";
          positionDropdown.value = "end";

          this.display();
        });
      });

    this.plugin.settings.customHorizons.forEach((horizon, index) => {
      const horizonType = horizon.tag ? `Tag: ${horizon.tag}` : `Date: ${horizon.date}`;
      let positionLabel: string;
      if (horizon.position === "before") {
        positionLabel = "Before backlog";
      } else if (horizon.position === "after") {
        positionLabel = "After backlog";
      } else {
        positionLabel = "End";
      }

      new Setting(containerEl)
        .setDesc(`${horizonType} - ${positionLabel}`)
        .addText((text) => {
          text.setPlaceholder("Label");
          text.setValue(horizon.label);
          text.onChange(async (value) => {
            this.plugin.settings.customHorizons[index].label = value.trim();
            await this.plugin.saveSettings();
            this.plugin.refreshPlanningViews();
          });
        })
        .addButton((button) =>
          button.setButtonText("Remove").onClick(async () => {
            this.plugin.settings.customHorizons.splice(index, 1);
            await this.plugin.saveSettings();
            this.plugin.refreshPlanningViews();
            this.display();
          })
        );
    });

    // === TASK ATTRIBUTES ===
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

    // === FILTERING & INDEXING ===
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
        button.onClick(() => {
          if (folderSearchInput === undefined) return;

          const newFolder = folderSearchInput.getValue();
          if (!newFolder) return;

          void this.app.vault.adapter.exists(newFolder, true).then((exists) => {
            if (!exists) {
              this.showError(containerEl, `Folder doesn't exist: ${newFolder}`);
              return;
            }

            if (!this.plugin.settings.ignoredFolders.includes(newFolder)) {
              this.plugin.settings.ignoredFolders.push(newFolder);
              void this.plugin.saveSettings().then(() => {
                folderSearchInput?.setValue("");
                this.display();
              });
            }
          });
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
  }

  private showError(containerEl: HTMLElement, message: string): void {
    const errorSpan = containerEl.createEl("span", {
      text: message,
      cls: "th-error",
    });
    setTimeout(() => errorSpan.remove(), 3000);
  }
}
