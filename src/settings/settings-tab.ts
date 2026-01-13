import TaskPlannerPlugin from "../main";
import { App, PluginSettingTab, SearchComponent, Setting } from "obsidian";
import { FolderSuggest } from "../ui/FolderSuggest";

export class TaskPlannerSettingsTab extends PluginSettingTab {
	plugin: TaskPlannerPlugin;

	constructor(app: App, plugin: TaskPlannerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	calculateTotalBuckets(): number {
		const { horizonVisibility, customHorizons } = this.plugin.settings;
		let count = 0;

		if (horizonVisibility.showBacklog) count++;
		if (horizonVisibility.showPast) count++;
		if (horizonVisibility.showOverdue) count++;
		if (horizonVisibility.showLater) count++;

		count += 3; // Today: Todo, In Progress, Done

		const weekdays = [
			horizonVisibility.showMonday,
			horizonVisibility.showTuesday,
			horizonVisibility.showWednesday,
			horizonVisibility.showThursday,
			horizonVisibility.showFriday,
			horizonVisibility.showSaturday,
			horizonVisibility.showSunday
		];
		const enabledWeekdays = weekdays.filter(Boolean).length;
		count += Math.min(enabledWeekdays, 6);

		count += horizonVisibility.weeksToShow;
		count += horizonVisibility.monthsToShow;

		if (horizonVisibility.showQuarters) {
			const now = new Date();
			const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
			const remainingQuarters = 4 - currentQuarter;
			count += remainingQuarters;
		}

		if (horizonVisibility.showNextYear) count++;
		count += customHorizons.length;

		return count;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Planning Board Section
		new Setting(containerEl).setName("Planning Board").setHeading();

		const basicBucketsDesc = containerEl.createDiv({ cls: "setting-item-description" });
		basicBucketsDesc.setText("Basic time buckets");

		const basicBucketsGrid = containerEl.createDiv({ cls: "th-bucket-grid" });

		const basicBuckets = [
			{ key: "showBacklog", label: "Backlog" },
			{ key: "showPast", label: "Past" },
			{ key: "showOverdue", label: "Overdue" },
			{ key: "showLater", label: "Later" }
		];

		basicBuckets.forEach(bucket => {
			const checkboxWrapper = basicBucketsGrid.createDiv({ cls: "th-bucket-checkbox" });
			const checkbox = checkboxWrapper.createEl("input", { type: "checkbox" });
			checkbox.checked = this.plugin.settings.horizonVisibility[bucket.key as keyof typeof this.plugin.settings.horizonVisibility] as boolean;
			checkbox.addEventListener("change", async () => {
				(this.plugin.settings.horizonVisibility as unknown as Record<string, boolean>)[bucket.key] = checkbox.checked;
				await this.plugin.saveSettings();
				await this.plugin.refreshPlanningViews();
				this.display();
			});
			checkboxWrapper.createSpan({ text: bucket.label });
		});

		// Weekdays
		const weekdaysDesc = containerEl.createDiv({ cls: "setting-item-description" });
		weekdaysDesc.setText("Weekday columns");
		weekdaysDesc.style.marginTop = "var(--th-space-xl)";

		const weekdaysGrid = containerEl.createDiv({ cls: "th-bucket-grid" });

		const weekdays = [
			{ key: "showMonday", label: "Mon" },
			{ key: "showTuesday", label: "Tue" },
			{ key: "showWednesday", label: "Wed" },
			{ key: "showThursday", label: "Thu" },
			{ key: "showFriday", label: "Fri" },
			{ key: "showSaturday", label: "Sat" },
			{ key: "showSunday", label: "Sun" }
		];

		weekdays.forEach(day => {
			const checkboxWrapper = weekdaysGrid.createDiv({ cls: "th-bucket-checkbox" });
			const checkbox = checkboxWrapper.createEl("input", { type: "checkbox" });
			checkbox.checked = this.plugin.settings.horizonVisibility[day.key as keyof typeof this.plugin.settings.horizonVisibility] as boolean;
			checkbox.addEventListener("change", async () => {
				(this.plugin.settings.horizonVisibility as unknown as Record<string, boolean>)[day.key] = checkbox.checked;
				await this.plugin.saveSettings();
				await this.plugin.refreshPlanningViews();
				this.display();
			});
			checkboxWrapper.createSpan({ text: day.label });
		});

		containerEl.createDiv({ cls: "setting-item-control" });

		const weeksValueSpan = containerEl.createEl("span");
		new Setting(containerEl)
			.setName("Weeks to show")
			.setDesc("Number of week columns to display (0-4)")
			.addSlider(slider => {
				weeksValueSpan.setText(` ${this.plugin.settings.horizonVisibility.weeksToShow}`);
				slider
					.setLimits(0, 4, 1)
					.setValue(this.plugin.settings.horizonVisibility.weeksToShow)
					.onChange(async value => {
						this.plugin.settings.horizonVisibility.weeksToShow = value;
						weeksValueSpan.setText(` ${value}`);
						await this.plugin.saveSettings();
						await this.plugin.refreshPlanningViews();
						this.display();
					});
				slider.sliderEl.after(weeksValueSpan);
			});

		const monthsValueSpan = containerEl.createEl("span");
		new Setting(containerEl)
			.setName("Months to show")
			.setDesc("Number of month columns to display (0-3)")
			.addSlider(slider => {
				monthsValueSpan.setText(` ${this.plugin.settings.horizonVisibility.monthsToShow}`);
				slider
					.setLimits(0, 3, 1)
					.setValue(this.plugin.settings.horizonVisibility.monthsToShow)
					.onChange(async value => {
						this.plugin.settings.horizonVisibility.monthsToShow = value;
						monthsValueSpan.setText(` ${value}`);
						await this.plugin.saveSettings();
						await this.plugin.refreshPlanningViews();
						this.display();
					});
				slider.sliderEl.after(monthsValueSpan);
			});

		new Setting(containerEl)
			.setName("Show quarters")
			.setDesc("Display remaining quarterly buckets until end of year (Q1, Q2, Q3, Q4)")
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.horizonVisibility.showQuarters)
					.onChange(async value => {
						this.plugin.settings.horizonVisibility.showQuarters = value;
						await this.plugin.saveSettings();
						await this.plugin.refreshPlanningViews();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("Show next year")
			.setDesc("Display a bucket for next year")
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.horizonVisibility.showNextYear)
					.onChange(async value => {
						this.plugin.settings.horizonVisibility.showNextYear = value;
						await this.plugin.saveSettings();
						await this.plugin.refreshPlanningViews();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("Daily WIP limit")
			.setDesc("Maximum tasks in progress per day (0 = unlimited)")
			.addText(txt =>
				txt
					.setValue(this.plugin.settings.defaultDailyWipLimit.toString())
					.onChange(async txtValue => {
						const value = Number.parseInt(txtValue);
						this.plugin.settings.defaultDailyWipLimit = Number.isNaN(value) ? 0 : value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("First weekday")
			.setDesc("First day of the week for planning columns")
			.addDropdown(dropDown => {
				const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
				days.forEach((display, index) => dropDown.addOption((index + 1).toString(), display));
				dropDown.setValue((this.plugin.settings.firstWeekday || 1).toString());
				dropDown.onChange(async (value: string) => {
					this.plugin.settings.firstWeekday = parseInt(value);
					await this.plugin.saveSettings();
				});
			});

		const totalBuckets = this.calculateTotalBuckets();
		new Setting(containerEl)
			.setName("Total buckets")
			.setDesc(`${totalBuckets} columns will be displayed in the planning view`)
			.setClass("th-bucket-count");

		// Custom Buckets Section
		new Setting(containerEl).setName("Custom Buckets").setHeading();

		const bucketDesc = containerEl.createDiv({ cls: "setting-item-description" });
		bucketDesc.setText("Create custom buckets filtered by tag or for specific dates");

		let labelInput: HTMLInputElement;
		let tagInput: HTMLInputElement;
		let dateInput: HTMLInputElement;
		let positionDropdown: HTMLSelectElement;

		const bucketInputContainer = containerEl.createDiv({ cls: "th-bucket-input-container" });

		new Setting(bucketInputContainer)
			.setName("New bucket")
			.addText(text => {
				labelInput = text.inputEl;
				text.setPlaceholder("Label");
				text.inputEl.style.width = "150px";
			})
			.addText(text => {
				tagInput = text.inputEl;
				text.setPlaceholder("Tag (optional)");
				text.inputEl.style.width = "120px";
			})
			.addText(text => {
				dateInput = text.inputEl;
				text.setPlaceholder("Date YYYY-MM-DD (optional)");
				text.inputEl.style.width = "160px";
			})
			.addDropdown(dropdown => {
				positionDropdown = dropdown.selectEl;
				dropdown.addOption("before", "Before backlog");
				dropdown.addOption("after", "After backlog");
				dropdown.addOption("end", "End");
				dropdown.setValue("end");
			})
			.addButton(button => {
				button.setIcon("plus");
				button.setTooltip("Add bucket");
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
						position
					});

					await this.plugin.saveSettings();
					await this.plugin.refreshPlanningViews();

					labelInput.value = "";
					tagInput.value = "";
					dateInput.value = "";
					positionDropdown.value = "end";

					this.display();
				});
			});

		this.plugin.settings.customHorizons.forEach((bucket, index) => {
			const bucketType = bucket.tag ? `Tag: ${bucket.tag}` : `Date: ${bucket.date}`;
			let positionLabel: string;
			if (bucket.position === "before") {
				positionLabel = "Before backlog";
			} else if (bucket.position === "after") {
				positionLabel = "After backlog";
			} else {
				positionLabel = "End";
			}

			new Setting(containerEl)
				.setDesc(`${bucketType} - ${positionLabel}`)
				.addText(text => {
					text.setPlaceholder("Label");
					text.setValue(bucket.label);
					text.onChange(async value => {
						this.plugin.settings.customHorizons[index].label = value.trim();
						await this.plugin.saveSettings();
						await this.plugin.refreshPlanningViews();
					});
				})
				.addButton(button =>
					button.setButtonText("Remove").onClick(async () => {
						this.plugin.settings.customHorizons.splice(index, 1);
						await this.plugin.saveSettings();
						await this.plugin.refreshPlanningViews();
						this.display();
					})
				);
		});

		// Task Attributes Section
		new Setting(containerEl).setName("Task Attributes").setHeading();

		new Setting(containerEl)
			.setName("Due date attribute")
			.setDesc("Attribute name for task due dates (no spaces)")
			.addText(text =>
				text
					.setPlaceholder("due")
					.setValue(this.plugin.settings.dueDateAttribute)
					.onChange(async value => {
						if (value && !value.contains(" ")) {
							this.plugin.settings.dueDateAttribute = value;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Completed date attribute")
			.setDesc("Attribute name for task completion dates (no spaces)")
			.addText(text =>
				text
					.setPlaceholder("completed")
					.setValue(this.plugin.settings.completedDateAttribute)
					.onChange(async value => {
						if (value && !value.contains(" ")) {
							this.plugin.settings.completedDateAttribute = value;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Pinned attribute")
			.setDesc("Attribute name for pinning/selecting important tasks (no spaces)")
			.addText(text =>
				text
					.setPlaceholder("selected")
					.setValue(this.plugin.settings.selectedAttribute)
					.onChange(async value => {
						if (value && !value.contains(" ")) {
							this.plugin.settings.selectedAttribute = value;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Use Dataview syntax")
			.setDesc("Enable: [due:: 2025-01-01] | Disable: @due(2025-01-01)")
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.useDataviewSyntax)
					.onChange(async value => {
						this.plugin.settings.useDataviewSyntax = value;
						await this.plugin.saveSettings();
					})
			);

		// Filtering & Indexing Section
		new Setting(containerEl).setName("Filtering & Indexing").setHeading();

		let folderSearchInput: SearchComponent | undefined;
		new Setting(containerEl)
			.setName("Ignored folders")
			.setDesc("Folders from which you don't want todos to be indexed")
			.addSearch(search => {
				folderSearchInput = search;
				new FolderSuggest(search.inputEl, this.app);
				search.setPlaceholder("Example: Archive");
			})
			.addButton(button => {
				button.setIcon("plus");
				button.setTooltip("Add folder");
				button.onClick(async () => {
					if (!folderSearchInput) return;

					const newFolder = folderSearchInput.getValue();
					if (!newFolder) return;

					if (!(await this.app.vault.adapter.exists(newFolder, true))) {
						this.showError(containerEl, `Folder doesn't exist: ${newFolder}`);
						return;
					}

					if (!this.plugin.settings.ignoredFolders.includes(newFolder)) {
						this.plugin.settings.ignoredFolders.push(newFolder);
						await this.plugin.saveSettings();
						folderSearchInput.setValue("");
						this.display();
					}
				});
			});

		this.plugin.settings.ignoredFolders.forEach(folder => {
			new Setting(containerEl)
				.setName(folder)
				.addButton(button =>
					button.setButtonText("Remove").onClick(async () => {
						this.plugin.settings.ignoredFolders = this.plugin.settings.ignoredFolders.filter(f => f !== folder);
						await this.plugin.saveSettings();
						this.display();
					})
				);
		});

		new Setting(containerEl)
			.setName("Ignore archived todos")
			.setDesc("Skip todos in files within the Archive folder")
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.ignoreArchivedTodos)
					.onChange(async value => {
						this.plugin.settings.ignoreArchivedTodos = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private showError(containerEl: HTMLElement, message: string): void {
		const errorSpan = containerEl.createEl("span", {
			text: message,
			cls: "th-error"
		});
		setTimeout(() => errorSpan.remove(), 3000);
	}
}
