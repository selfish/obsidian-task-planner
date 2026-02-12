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
    const periodicSettings = this.getPeriodicNotesSettings();
    if (periodicSettings) {
      return periodicSettings;
    }
    return this.getCoreDailyNotesSettings();
  }

  private getPeriodicNotesSettings(): DailyNoteSettings | null {
    try {
      const periodicNotesPlugin = (this.app as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins?.plugins?.["periodic-notes"];
      if (!periodicNotesPlugin) {
        return null;
      }

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

    const existingFile = this.app.vault.getAbstractFileByPath(notePath);
    if (existingFile instanceof TFile) {
      return existingFile;
    }

    const settings = this.getDailyNoteSettings();
    let initialContent = "";

    if (settings?.template) {
      const templateFile = this.app.vault.getAbstractFileByPath(normalizePath(settings.template));
      if (templateFile instanceof TFile) {
        initialContent = await this.app.vault.read(templateFile);
      }
    }

    const parentPath = notePath.substring(0, notePath.lastIndexOf("/"));
    if (parentPath) {
      await this.ensureFolderExists(parentPath);
    }

    const newFile = await this.app.vault.create(notePath, initialContent);

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
