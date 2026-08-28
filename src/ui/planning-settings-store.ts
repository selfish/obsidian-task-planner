import { App } from "obsidian";

import { PlanningSettings, getDefaultSettings } from "./planning-settings";

const storageKey = "TaskPlanner.PlanningSettings";

export class PlanningSettingsStore {
  constructor(private app: App) {}

  getSettings(): PlanningSettings {
    const serializedValue: unknown = this.app.loadLocalStorage(storageKey);
    const defaults = getDefaultSettings();
    if (typeof serializedValue !== "string" || !serializedValue) return defaults;

    let parsed: unknown;
    try {
      parsed = JSON.parse(serializedValue);
    } catch {
      return defaults;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;

    const saved = parsed as Record<string, unknown>;
    const searchParameters = saved.searchParameters !== null && typeof saved.searchParameters === "object" && !Array.isArray(saved.searchParameters) ? (saved.searchParameters as Record<string, unknown>) : {};
    const viewModes: readonly PlanningSettings["viewMode"][] = ["default", "today", "future"];
    const priorityFilters: readonly PlanningSettings["priorityFilter"][] = ["all", "critical", "high", "medium", "low", "lowest"];
    return {
      ...saved,
      searchParameters: {
        ...searchParameters,
        searchPhrase: typeof searchParameters.searchPhrase === "string" ? searchParameters.searchPhrase : defaults.searchParameters.searchPhrase,
      },
      hideEmpty: typeof saved.hideEmpty === "boolean" ? saved.hideEmpty : defaults.hideEmpty,
      hideDone: typeof saved.hideDone === "boolean" ? saved.hideDone : defaults.hideDone,
      viewMode: typeof saved.viewMode === "string" && viewModes.includes(saved.viewMode as PlanningSettings["viewMode"]) ? (saved.viewMode as PlanningSettings["viewMode"]) : defaults.viewMode,
      showLoadColors: typeof saved.showLoadColors === "boolean" ? saved.showLoadColors : defaults.showLoadColors,
      priorityFilter: typeof saved.priorityFilter === "string" && priorityFilters.includes(saved.priorityFilter as PlanningSettings["priorityFilter"]) ? (saved.priorityFilter as PlanningSettings["priorityFilter"]) : defaults.priorityFilter,
    };
  }

  saveSettings(settings: PlanningSettings): void {
    const serializedValue = JSON.stringify(settings);
    this.app.saveLocalStorage(storageKey, serializedValue);
  }

  decorateSetterWithSaveSettings(setter: (value: PlanningSettings) => void): (value: PlanningSettings) => void {
    return (settings) => {
      setter(settings);
      this.saveSettings(settings);
    };
  }
}
