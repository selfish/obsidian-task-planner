import { App } from "obsidian";
import { PlanningSettings, getDefaultSettings } from "./planning-settings";

// Type augmentation for Obsidian's App - these methods exist but aren't in public types
declare module "obsidian" {
  interface App {
    loadLocalStorage(key: string): string | null;
    saveLocalStorage(key: string, value: string | undefined): void;
  }
}

const storageKey = "TaskPlanner.PlanningSettings";

export class PlanningSettingsStore {
  constructor(private app: App) {}

  getSettings(): PlanningSettings {
    const serializedValue = this.app.loadLocalStorage(storageKey);
    const value = getDefaultSettings();
    if (serializedValue && typeof serializedValue === "string") {
      const saved = JSON.parse(serializedValue);
      Object.assign(value, saved);
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
