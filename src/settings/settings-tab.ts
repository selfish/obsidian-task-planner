import { App, PluginSettingTab, Setting, setIcon } from "obsidian";

import TaskPlannerPlugin from "../main";
import { HorizonColor, CustomHorizon, CustomAtShortcut } from "./types";
import {
  createSubsection,
  createCollapsibleSection,
  renderSubsection,
  renderSetting,
  renderFolderList,
} from "./setting-builder";
import {
  quickAddSettings,
  attributesSettings,
  specialColumnsSettings,
  nextWeekSettings,
  futureHorizonsSettings,
  wipSettings,
  quickAddAdvancedSettings,
  atShortcutsSettings,
  indexingSettings,
  undoSettings,
  followUpSettings,
} from "./setting-definitions";

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

let advancedSectionCollapsed = true;

export class TaskPlannerSettingsTab extends PluginSettingTab {
  plugin: TaskPlannerPlugin;

  constructor(app: App, plugin: TaskPlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("th-settings-tab");
    const refresh = () => this.display();

    // ESSENTIAL SETTINGS
    new Setting(containerEl).setName("Essential").setHeading();
    renderSubsection(containerEl, quickAddSettings, this.plugin, this.app, refresh);
    renderSubsection(containerEl, attributesSettings, this.plugin, this.app, refresh);

    // HORIZONS SETTINGS
    new Setting(containerEl).setName("Horizons").setHeading();
    renderSubsection(containerEl, specialColumnsSettings, this.plugin, this.app, refresh);
    this.renderThisWeekSection(containerEl, refresh);
    renderSubsection(containerEl, nextWeekSettings, this.plugin, this.app, refresh);
    renderSubsection(containerEl, futureHorizonsSettings, this.plugin, this.app, refresh);
    this.renderCustomHorizonsSection(containerEl, refresh);

    // ADVANCED SETTINGS (Collapsible)
    const advancedContent = createCollapsibleSection(containerEl, "Advanced Settings", advancedSectionCollapsed, (c) => {
      advancedSectionCollapsed = c;
    });

    renderSubsection(advancedContent, wipSettings, this.plugin, this.app, refresh);
    renderSubsection(advancedContent, quickAddAdvancedSettings, this.plugin, this.app, refresh);
    this.renderAtShortcutsSection(advancedContent, refresh);
    this.renderIndexingSection(advancedContent, refresh);
    renderSubsection(advancedContent, undoSettings, this.plugin, this.app, refresh);
    renderSubsection(advancedContent, followUpSettings, this.plugin, this.app, refresh);
  }

  private renderThisWeekSection(containerEl: HTMLElement, refresh: () => void): void {
    const subsection = createSubsection(containerEl, "This Week");

    // Weekday selector grid
    const weekdaySelector = subsection.createDiv({ cls: "th-weekday-selector" });
    weekdaySelector.createDiv({ cls: "th-weekday-label", text: "Visible days" });
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

    const firstWeekday = this.plugin.settings.firstWeekday || 1;
    const weekdays = [...allWeekdays.filter((d) => d.dayNum >= firstWeekday), ...allWeekdays.filter((d) => d.dayNum < firstWeekday)];

    for (const day of weekdays) {
      const isChecked = this.plugin.settings.horizonVisibility[day.key as keyof typeof this.plugin.settings.horizonVisibility] as boolean;
      const dayButton = weekdayGrid.createEl("button", {
        cls: `th-weekday-btn ${isChecked ? "th-weekday-btn--active" : ""}`,
        attr: { "aria-label": day.full },
      });
      dayButton.createSpan({ cls: "th-weekday-btn-label", text: day.label });
      dayButton.createSpan({ cls: "th-weekday-btn-led" });

      dayButton.addEventListener("click", async () => {
        (this.plugin.settings.horizonVisibility as unknown as Record<string, boolean>)[day.key] = !isChecked;
        await this.plugin.saveSettings();
        this.plugin.refreshPlanningViews();
        refresh();
      });
    }

    new Setting(subsection)
      .setName("Week starts on")
      .setDesc("First day of your work week")
      .addDropdown((dropdown) => {
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].forEach((day, i) => {
          dropdown.addOption((i + 1).toString(), day);
        });
        dropdown.setValue((this.plugin.settings.firstWeekday || 1).toString());
        dropdown.onChange(async (value) => {
          this.plugin.settings.firstWeekday = parseInt(value);
          await this.plugin.saveSettings();
          this.plugin.refreshPlanningViews();
          refresh();
        });
      });
  }

  private renderCustomHorizonsSection(containerEl: HTMLElement, refresh: () => void): void {
    const subsection = createSubsection(containerEl, "Custom Horizons");
    const horizonsContainer = subsection.createDiv({ cls: "th-horizons-container" });

    this.plugin.settings.customHorizons.forEach((horizon, index) => {
      this.renderHorizonCard(horizonsContainer, horizon, index, refresh);
    });

    new Setting(subsection).addButton((button) => {
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
        refresh();
      });
    });
  }

  private renderAtShortcutsSection(containerEl: HTMLElement, refresh: () => void): void {
    const subsection = createSubsection(containerEl, "@ Shortcuts");
    const settings = atShortcutsSettings(this.plugin);

    for (const def of settings) {
      renderSetting(subsection, def, this.plugin, this.app, refresh);
    }

    if (this.plugin.settings.atShortcutSettings.enableAtShortcuts) {
      const customSetting = new Setting(subsection).setName("Custom shortcuts").setDesc("Define your own @shortcuts");
      customSetting.addButton((button) => {
        button.setButtonText("Add");
        button.setCta();
        button.onClick(async () => {
          this.plugin.settings.atShortcutSettings.customShortcuts.push({ keyword: "", targetAttribute: "", value: true });
          await this.plugin.saveSettings();
          refresh();
        });
      });

      if (this.plugin.settings.atShortcutSettings.customShortcuts.length > 0) {
        const shortcutsContainer = subsection.createDiv({ cls: "th-shortcuts-container" });
        this.plugin.settings.atShortcutSettings.customShortcuts.forEach((shortcut, index) => {
          this.renderShortcutCard(shortcutsContainer, shortcut, index, refresh);
        });
      }
    }
  }

  private renderIndexingSection(containerEl: HTMLElement, refresh: () => void): void {
    const subsection = createSubsection(containerEl, "Indexing");
    renderFolderList(subsection, this.plugin, this.app, refresh);

    for (const def of indexingSettings.settings) {
      renderSetting(subsection, def, this.plugin, this.app, refresh);
    }
  }

  private renderHorizonCard(container: HTMLElement, horizon: CustomHorizon, index: number, refresh: () => void): void {
    const card = container.createDiv({ cls: "th-horizon-card" });
    const row1 = card.createDiv({ cls: "th-horizon-card-row" });

    row1.appendChild(
      this.createColorPicker(horizon.color, async (color) => {
        this.plugin.settings.customHorizons[index].color = color;
        await this.plugin.saveSettings();
        this.plugin.refreshPlanningViews();
      })
    );

    const labelInput = row1.createEl("input", { type: "text", cls: "th-horizon-label", value: horizon.label, attr: { placeholder: "Horizon name" } });
    labelInput.addEventListener("change", async () => {
      this.plugin.settings.customHorizons[index].label = labelInput.value.trim();
      await this.plugin.saveSettings();
      this.plugin.refreshPlanningViews();
    });

    const deleteBtn = row1.createEl("button", { cls: "th-horizon-delete clickable-icon", attr: { "aria-label": "Delete", type: "button" } });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", async () => {
      this.plugin.settings.customHorizons.splice(index, 1);
      await this.plugin.saveSettings();
      this.plugin.refreshPlanningViews();
      refresh();
    });

    const row2 = card.createDiv({ cls: "th-horizon-card-row th-horizon-card-row--details" });

    const dateInput = row2.createEl("input", { type: "date", cls: "th-horizon-date", value: horizon.date });
    dateInput.addEventListener("change", async () => {
      this.plugin.settings.customHorizons[index].date = dateInput.value;
      await this.plugin.saveSettings();
      this.plugin.refreshPlanningViews();
    });

    const tagWrapper = row2.createDiv({ cls: "th-horizon-tag-wrapper" });
    tagWrapper.createSpan({ cls: "th-horizon-tag-prefix", text: "#" });
    const tagInput = tagWrapper.createEl("input", { type: "text", cls: "th-horizon-tag", value: horizon.tag || "", attr: { placeholder: "Tag" } });
    tagInput.addEventListener("change", async () => {
      this.plugin.settings.customHorizons[index].tag = tagInput.value.trim() || undefined;
      await this.plugin.saveSettings();
      this.plugin.refreshPlanningViews();
    });

    const positionSelect = row2.createEl("select", { cls: "th-horizon-position dropdown" });
    [
      { value: "before", label: "Before backlog" },
      { value: "after", label: "After backlog" },
      { value: "inline", label: "On its date" },
      { value: "end", label: "End" },
    ].forEach((pos) => {
      const option = positionSelect.createEl("option", { value: pos.value, text: pos.label });
      if (horizon.position === pos.value) option.selected = true;
    });
    positionSelect.addEventListener("change", async () => {
      this.plugin.settings.customHorizons[index].position = positionSelect.value as "before" | "after" | "end" | "inline";
      await this.plugin.saveSettings();
      this.plugin.refreshPlanningViews();
    });
  }

  private renderShortcutCard(container: HTMLElement, shortcut: CustomAtShortcut, index: number, refresh: () => void): void {
    const card = container.createDiv({ cls: "th-shortcut-card" });
    const row = card.createDiv({ cls: "th-shortcut-card-row" });

    row.createSpan({ cls: "th-shortcut-prefix", text: "@" });

    const keywordInput = row.createEl("input", { type: "text", cls: "th-shortcut-keyword", value: shortcut.keyword, attr: { placeholder: "Keyword" } });
    keywordInput.addEventListener("change", async () => {
      this.plugin.settings.atShortcutSettings.customShortcuts[index].keyword = keywordInput.value.trim().toLowerCase();
      await this.plugin.saveSettings();
    });

    row.createSpan({ cls: "th-shortcut-arrow", text: "\u2192" });

    const attrInput = row.createEl("input", { type: "text", cls: "th-shortcut-attr", value: shortcut.targetAttribute, attr: { placeholder: "Attribute" } });
    attrInput.addEventListener("change", async () => {
      this.plugin.settings.atShortcutSettings.customShortcuts[index].targetAttribute = attrInput.value.trim();
      await this.plugin.saveSettings();
    });

    const valueSelect = row.createEl("select", { cls: "th-shortcut-value-type dropdown" });
    [
      { value: "true", label: ":: true" },
      { value: "custom", label: ":: value" },
    ].forEach((vt) => {
      const option = valueSelect.createEl("option", { value: vt.value, text: vt.label });
      if ((shortcut.value === true && vt.value === "true") || (shortcut.value !== true && vt.value === "custom")) {
        option.selected = true;
      }
    });

    const valueInput = row.createEl("input", {
      type: "text",
      cls: `th-shortcut-value ${shortcut.value === true ? "th-hidden" : ""}`,
      value: shortcut.value === true ? "" : shortcut.value,
      attr: { placeholder: "Value" },
    });

    valueSelect.addEventListener("change", async () => {
      if (valueSelect.value === "true") {
        this.plugin.settings.atShortcutSettings.customShortcuts[index].value = true;
        valueInput.addClass("th-hidden");
      } else {
        this.plugin.settings.atShortcutSettings.customShortcuts[index].value = valueInput.value.trim() || "value";
        valueInput.removeClass("th-hidden");
      }
      await this.plugin.saveSettings();
    });

    valueInput.addEventListener("change", async () => {
      this.plugin.settings.atShortcutSettings.customShortcuts[index].value = valueInput.value.trim() || "value";
      await this.plugin.saveSettings();
    });

    const deleteBtn = row.createEl("button", { cls: "th-shortcut-delete clickable-icon", attr: { "aria-label": "Delete", type: "button" } });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", async () => {
      this.plugin.settings.atShortcutSettings.customShortcuts.splice(index, 1);
      await this.plugin.saveSettings();
      refresh();
    });
  }

  private createColorPicker(initialColor: HorizonColor | undefined, onChange: (color: HorizonColor | undefined) => void): HTMLElement {
    const container = createEl("div", { cls: "th-color-picker" });
    const trigger = container.createEl("button", { cls: "th-color-picker-trigger clickable-icon", attr: { "aria-label": "Select color", type: "button" } });

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
}
