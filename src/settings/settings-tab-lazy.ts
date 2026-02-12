import { App, PluginSettingTab } from "obsidian";

import type TaskPlannerPlugin from "../main";

export class LazySettingsTab extends PluginSettingTab {
  private plugin: TaskPlannerPlugin;
  private actualTab: PluginSettingTab | null = null;

  constructor(app: App, plugin: TaskPlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    if (!this.actualTab) {
      // Dynamically import the settings tab module
      const { TaskPlannerSettingsTab } = await import("./settings-tab");
      this.actualTab = new TaskPlannerSettingsTab(this.app, this.plugin);
    }

    // Copy the containerEl reference and call display
    this.actualTab.containerEl = this.containerEl;
    this.actualTab.display();
  }

  hide(): void {
    if (this.actualTab?.hide) {
      this.actualTab.hide();
    }
  }
}
