import { App, TFile, normalizePath } from "obsidian";

import { DailyNoteService } from "./daily-note-service";
import { TaskPlannerSettings } from "../../settings/types";
import { moment } from "../../utils/moment";

export class TaskCreator {
  private dailyNoteService: DailyNoteService;

  constructor(
    private app: App,
    private settings: TaskPlannerSettings
  ) {
    this.dailyNoteService = new DailyNoteService(app);
  }

  async createTask(text: string): Promise<void> {
    const taskLine = this.formatTaskLine(text.trim());
    const targetFile = await this.getTargetFile();

    if (!targetFile) {
      throw new Error("Could not determine target file for task");
    }

    const currentContent = await this.app.vault.read(targetFile);
    const newContent = this.insertContent(currentContent, taskLine);

    await this.app.vault.modify(targetFile, newContent);
  }

  private formatTaskLine(task: string): string {
    const { taskPattern } = this.settings.quickAdd;
    const now = moment();

    return taskPattern
      .replace(/\\n/g, "\n") // Convert literal \n to actual newlines
      .replace(/\{task\}/g, task)
      .replace(/\{time\}/g, now.format("HH:mm"))
      .replace(/\{date\}/g, now.format("YYYY-MM-DD"))
      .replace(/\{datetime\}/g, now.format("YYYY-MM-DD HH:mm"));
  }

  private insertContent(content: string, taskLine: string): string {
    const { placement, locationRegex } = this.settings.quickAdd;

    // Handle regex-based placement
    if ((placement === "before-regex" || placement === "after-regex") && locationRegex) {
      const result = this.insertAtRegex(content, taskLine, locationRegex, placement === "before-regex");
      if (result !== null) {
        return result;
      }
      // If no match found, fall back to prepend
      return this.prependAfterFrontmatter(content, taskLine);
    }

    // Normal prepend/append behavior
    if (placement === "prepend") {
      return this.prependAfterFrontmatter(content, taskLine);
    }

    // Append
    return content.endsWith("\n") ? content + taskLine : content + "\n" + taskLine;
  }

  private insertAtRegex(content: string, taskLine: string, pattern: string, before: boolean): string | null {
    // Get frontmatter end position so we can skip it
    const fmEnd = this.getFrontmatterEndPosition(content);

    // Search only in content after frontmatter
    const searchContent = content.slice(fmEnd);

    try {
      const regex = new RegExp(pattern, "m");
      const match = regex.exec(searchContent);

      if (match && match.index !== undefined) {
        // Adjust match index to account for frontmatter
        const actualIndex = fmEnd + match.index;

        if (before) {
          return content.slice(0, actualIndex) + taskLine + "\n" + content.slice(actualIndex);
        } else {
          const insertPos = actualIndex + match[0].length;
          return content.slice(0, insertPos) + "\n" + taskLine + content.slice(insertPos);
        }
      }
    } catch {
      // Invalid regex
    }

    return null;
  }

  private getFrontmatterEndPosition(content: string): number {
    if (!content.startsWith("---")) {
      return 0;
    }

    const endOfFrontmatter = content.indexOf("\n---", 3);
    if (endOfFrontmatter === -1) {
      return 0;
    }

    // Return position after the closing ---
    return endOfFrontmatter + 4;
  }

  private prependAfterFrontmatter(content: string, taskLine: string): string {
    // Check if content starts with frontmatter
    if (!content.startsWith("---")) {
      return taskLine + "\n" + content;
    }

    // Find the closing --- of frontmatter
    const endOfFrontmatter = content.indexOf("\n---", 3);
    if (endOfFrontmatter === -1) {
      // No closing ---, treat as no frontmatter
      return taskLine + "\n" + content;
    }

    // Find the position after the closing ---
    const insertPosition = endOfFrontmatter + 4; // +4 for "\n---"

    // Skip any newlines immediately after frontmatter
    let actualInsertPosition = insertPosition;
    while (actualInsertPosition < content.length && content[actualInsertPosition] === "\n") {
      actualInsertPosition++;
    }

    const beforeInsert = content.slice(0, insertPosition);
    const afterInsert = content.slice(actualInsertPosition);

    return beforeInsert + "\n" + taskLine + "\n" + afterInsert;
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
