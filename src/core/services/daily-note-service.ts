import { App, TFile, normalizePath } from "obsidian";

import { moment } from "../../utils/moment";

export interface DailyNoteSettings {
  folder: string;
  format: string;
  template?: string;
}

interface PeriodicNotesData {
  daily?: {
    enabled?: boolean;
    format?: string;
    folder?: string;
    template?: string;
  };
}

interface CoreDailyNotesData {
  folder?: string;
  format?: string;
  template?: string;
}

export class DailyNoteService {
  constructor(private app: App) {}

  getDailyNoteSettings(): DailyNoteSettings | null {
    // Try Periodic Notes plugin first
    const periodicSettings = this.getPeriodicNotesSettings();
    if (periodicSettings) {
      return periodicSettings;
    }

    // Fall back to core daily notes
    return this.getCoreDailyNotesSettings();
  }

  private getPeriodicNotesSettings(): DailyNoteSettings | null {
    try {
      // Check if Periodic Notes plugin is enabled
      const periodicNotesPlugin = (this.app as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins?.plugins?.["periodic-notes"];
      if (!periodicNotesPlugin) {
        return null;
      }

      // Try to read settings from the plugin instance
      const pluginSettings = (periodicNotesPlugin as { settings?: PeriodicNotesData }).settings;
      if (pluginSettings?.daily?.enabled !== false) {
        return {
          folder: pluginSettings?.daily?.folder || "",
          format: pluginSettings?.daily?.format || "YYYY-MM-DD",
          template: pluginSettings?.daily?.template,
        };
      }
    } catch {
      // Fall through to null
    }
    return null;
  }

  private getCoreDailyNotesSettings(): DailyNoteSettings | null {
    try {
      // Check if Daily Notes core plugin is enabled
      const dailyNotesPlugin = (this.app as unknown as { internalPlugins: { plugins: Record<string, { enabled: boolean; instance?: { options?: CoreDailyNotesData } }> } }).internalPlugins?.plugins?.["daily-notes"];

      if (!dailyNotesPlugin?.enabled) {
        return null;
      }

      const options = dailyNotesPlugin.instance?.options;
      return {
        folder: options?.folder || "",
        format: options?.format || "YYYY-MM-DD",
        template: options?.template,
      };
    } catch {
      // Fall through to null
    }
    return null;
  }

  getTodayNotePath(): string | null {
    const settings = this.getDailyNoteSettings();
    if (!settings) {
      return null;
    }

    const dateStr = moment().format(settings.format);
    const folder = settings.folder ? settings.folder + "/" : "";
    return normalizePath(`${folder}${dateStr}.md`);
  }

  async ensureDailyNoteExists(templaterDelay: number): Promise<TFile | null> {
    const notePath = this.getTodayNotePath();
    if (!notePath) {
      return null;
    }

    // Check if file already exists
    const existingFile = this.app.vault.getAbstractFileByPath(notePath);
    if (existingFile instanceof TFile) {
      return existingFile;
    }

    // Create the file
    const settings = this.getDailyNoteSettings();
    let initialContent = "";

    // If there's a template and no Templater, load template content
    if (settings?.template) {
      const templateFile = this.app.vault.getAbstractFileByPath(normalizePath(settings.template));
      if (templateFile instanceof TFile) {
        initialContent = await this.app.vault.read(templateFile);
      }
    }

    // Ensure parent folders exist
    const parentPath = notePath.substring(0, notePath.lastIndexOf("/"));
    if (parentPath) {
      await this.ensureFolderExists(parentPath);
    }

    // Create the file
    const newFile = await this.app.vault.create(notePath, initialContent);

    // Wait for Templater to process (if it's installed)
    if (templaterDelay > 0) {
      await this.sleep(templaterDelay);
    }

    return newFile;
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!folder) {
      await this.app.vault.createFolder(normalizedPath);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
