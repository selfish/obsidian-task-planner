import { App, TFile, normalizePath } from "obsidian";

import { DailyNoteService } from "./daily-note-service";
import { TaskPlannerSettings } from "../../settings/types";

export class TaskCreator {
  private dailyNoteService: DailyNoteService;

  constructor(
    private app: App,
    private settings: TaskPlannerSettings
  ) {
    this.dailyNoteService = new DailyNoteService(app);
  }

  async createTask(text: string): Promise<void> {
    const taskLine = `- [ ] ${text.trim()}`;
    const targetFile = await this.getTargetFile();

    if (!targetFile) {
      throw new Error("Could not determine target file for task");
    }

    const currentContent = await this.app.vault.read(targetFile);
    const newContent = this.settings.quickAdd.placement === "prepend" ? `${taskLine}\n${currentContent}` : `${currentContent}\n${taskLine}`;

    await this.app.vault.modify(targetFile, newContent);
  }

  private async getTargetFile(): Promise<TFile> {
    if (this.settings.quickAdd.destination === "daily") {
      return this.getOrCreateDailyNote();
    }
    return this.getOrCreateInboxFile();
  }

  private async getOrCreateDailyNote(): Promise<TFile> {
    const file = await this.dailyNoteService.ensureDailyNoteExists(this.settings.quickAdd.templaterDelay);

    if (!file) {
      throw new Error("Daily notes are not configured. Please enable the Daily Notes or Periodic Notes plugin.");
    }

    return file;
  }

  private async getOrCreateInboxFile(): Promise<TFile> {
    const filePath = normalizePath(this.settings.quickAdd.inboxFilePath);

    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
      return existingFile;
    }

    // Ensure parent folders exist
    const parentPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (parentPath) {
      await this.ensureFolderExists(parentPath);
    }

    // Create the inbox file
    return await this.app.vault.create(filePath, "");
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!folder) {
      await this.app.vault.createFolder(normalizedPath);
    }
  }
}
