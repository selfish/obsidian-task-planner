import { App, TFile, normalizePath } from "obsidian";

import { DailyNoteSettings, readDailyNoteSettings } from "../../integrations/daily-notes";
import { moment } from "../../utils/moment";

export type { DailyNoteSettings } from "../../integrations/daily-notes";

export class DailyNoteService {
  constructor(private app: App) {}

  getDailyNoteSettings(): DailyNoteSettings | null {
    return readDailyNoteSettings();
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
    const existingFile = this.app.vault.getFileByPath(notePath);
    if (existingFile) {
      return existingFile;
    }

    // Create the file
    const settings = this.getDailyNoteSettings();
    let initialContent = "";

    // If there's a template and no Templater, load template content
    if (settings?.template) {
      const templateFile = this.app.vault.getFileByPath(normalizePath(settings.template));
      if (templateFile) {
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
    const folder = this.app.vault.getFolderByPath(normalizedPath);
    if (!folder) {
      await this.app.vault.createFolder(normalizedPath);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
