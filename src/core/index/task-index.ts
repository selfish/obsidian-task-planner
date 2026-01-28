import { TaskPlannerEvent } from "../../events";
import { FileAdapter, Logger, TaskItem, TasksInFiles } from "../../types";
import { FileTaskParser } from "../parsers/file-task-parser";
import { FolderTaskParser } from "../parsers/folder-task-parser";

export interface TaskIndexDeps<T> {
  fileTaskParser: FileTaskParser<T>;
  folderTaskParser: FolderTaskParser<T>;
  logger: Logger;
}

export interface TaskIndexSettings {
  ignoreArchivedTasks: boolean;
  ignoredFolders: string[];
}

export class TaskIndex<T> {
  files: TasksInFiles<T>[] = [];
  private _tasksCache: TaskItem<T>[] | null = null;

  get tasks(): TaskItem<T>[] {
    if (this._tasksCache === null) {
      this._tasksCache = this.files.reduce((res, ts) => res.concat(ts.tasks), [] as TaskItem<T>[]);
    }
    return this._tasksCache;
  }

  private invalidateCache(): void {
    this._tasksCache = null;
  }

  onUpdateEvent = new TaskPlannerEvent<TaskItem<T>[]>();

  constructor(
    private deps: TaskIndexDeps<T>,
    private settings: TaskIndexSettings
  ) {}

  private ignoreFile(file: FileAdapter<T>): boolean {
    // Only exclude archived folders at index level
    // Frontmatter-based ignore (shouldIgnore) is handled at display level
    // so "show ignored" mode can display those tasks
    if (this.settings.ignoreArchivedTasks) {
      const isIgnored = this.settings.ignoredFolders.some((folder) => file.isInFolder(folder));
      if (isIgnored) {
        this.deps.logger.debug(`TaskIndex: File ignored because archived: ${file.id}`);
        return true;
      }
    }
    return false;
  }

  async filesLoaded(files: FileAdapter<T>[]): Promise<void> {
    const filteredFiles = files.filter((file) => !this.ignoreFile(file));
    try {
      const tasks = await this.deps.folderTaskParser.parseFiles(filteredFiles);
      this.files = tasks;
      this.invalidateCache();
      await this.triggerUpdate();
    } catch (err) {
      this.deps.logger.error(`Failed to load files: ${err}`);
    }
  }

  async fileUpdated(file: FileAdapter<T>): Promise<void> {
    const fileIndex = this.files.findIndex((tasksInFile) => tasksInFile.file.id === file.id);
    const fileInIndex = fileIndex >= 0;

    // Check if file should be ignored (e.g., frontmatter changed to task-planner-ignore: true)
    if (this.ignoreFile(file)) {
      // If file was previously tracked, remove it from the index
      if (fileInIndex) {
        this.deps.logger.debug(`TaskIndex: File now ignored, removing from index: ${file.id}`);
        this.files.splice(fileIndex, 1);
        this.invalidateCache();
        await this.triggerUpdate();
      }
      return;
    }

    // If file is not in index but should be tracked, add it
    if (!fileInIndex) {
      this.deps.logger.debug(`TaskIndex: File no longer ignored, adding to index: ${file.id}`);
      try {
        const tasks = await this.deps.fileTaskParser.parseMdFile(file);
        this.files.push({ tasks, file });
        this.invalidateCache();
        await this.triggerUpdate();
      } catch (err) {
        this.deps.logger.error(`Failed to add previously ignored file ${file.id}: ${err}`);
      }
      return;
    }

    this.deps.logger.debug(`TaskIndex: File updated: ${file.id}`);
    try {
      const tasks = await this.deps.fileTaskParser.parseMdFile(file);
      this.files[fileIndex].tasks = tasks;
      this.invalidateCache();
      await this.triggerUpdate();
    } catch (err) {
      this.deps.logger.error(`Failed to update file ${file.id}: ${err}`);
    }
  }

  async fileRenamed(id: string, file: FileAdapter<T>): Promise<void> {
    this.deps.logger.debug(`TaskIndex: File renamed: ${id} to ${file.id}`);

    // Find the old file entry by the old id
    const index = this.files.findIndex((tasksInFile) => tasksInFile.file.id === id);
    if (index < 0) {
      this.deps.logger.debug(`TaskIndex: File not found in index during rename: ${id}`);
      return;
    }

    // Check if the new location should be ignored
    if (this.ignoreFile(file)) {
      // File moved to ignored folder, remove it from the index
      this.files.splice(index, 1);
      this.invalidateCache();
      await this.triggerUpdate();
      return;
    }

    // Update the file reference to the new file
    this.files[index].file = file;
    this.invalidateCache();
    await this.triggerUpdate();
  }

  async fileDeleted(file: FileAdapter<T>): Promise<void> {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TaskIndex: File deleted: ${file.id}`);
    const index = this.findFileIndex(file);
    this.files.splice(index, 1);
    this.invalidateCache();
    await this.triggerUpdate();
  }

  async fileCreated(file: FileAdapter<T>): Promise<void> {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TaskIndex: File created: ${file.id}`);
    try {
      const tasks = await this.deps.fileTaskParser.parseMdFile(file);
      this.files.push({ tasks, file });
      this.invalidateCache();
      await this.triggerUpdate();
    } catch (err) {
      this.deps.logger.error(`Failed to parse created file ${file.id}: ${err}`);
    }
  }

  private findFileIndex(file: FileAdapter<T>): number {
    const index = this.files.findIndex((tasksInFile) => tasksInFile.file.id === file.id);
    if (index < 0) {
      this.deps.logger.error(`Tasks not found for file '${file.name}'`);
      throw Error(`TaskIndex: File not found in index: ${file.id}`);
    }
    return index;
  }

  private async triggerUpdate(): Promise<void> {
    try {
      await this.onUpdateEvent.fire(this.tasks);
    } catch (err) {
      this.deps.logger.error(`Failed to trigger update event: ${err}`);
    }
  }
}
