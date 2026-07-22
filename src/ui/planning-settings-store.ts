import { App } from "obsidian";

import { PlanningSettings, getDefaultSettings } from "./planning-settings";

const storageKey = "TaskPlanner.PlanningSettings";

export class PlanningSettingsStore {
  constructor(private app: App) {}

  getSettings(): PlanningSettings {
    const storedValue = this.app.loadLocalStorage(storageKey) as unknown;
    const value = getDefaultSettings();
    if (typeof storedValue === "string" && storedValue) {
      // Legacy versions stored a JSON string instead of a structured value.
      const saved = JSON.parse(storedValue) as Partial<PlanningSettings>;
      Object.assign(value, saved);
    } else if (storedValue !== null && typeof storedValue === "object" && !Array.isArray(storedValue)) {
      Object.assign(value, storedValue);
    }
    return value;
  }

  saveSettings(settings: PlanningSettings): void {
    this.app.saveLocalStorage(storageKey, settings);
  }

  decorateSetterWithSaveSettings(setter: (value: PlanningSettings) => void): (value: PlanningSettings) => void {
    return (settings) => {
      setter(settings);
      this.saveSettings(settings);
    };
  }
}
