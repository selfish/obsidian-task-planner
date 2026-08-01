import { App } from "obsidian";

import { PlanningSettings, getDefaultSettings } from "./planning-settings";

const storageKey = "TaskPlanner.PlanningSettings";

export class PlanningSettingsStore {
  constructor(private app: App) {}

  getSettings(): PlanningSettings {
    const serializedValue: unknown = this.app.loadLocalStorage(storageKey);
    const value = getDefaultSettings();
    if (typeof serializedValue === "string" && serializedValue) {
      const saved: unknown = JSON.parse(serializedValue);
      if (saved !== null && typeof saved === "object" && !Array.isArray(saved)) {
        Object.assign(value, saved);
      }
    }
    return value;
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
