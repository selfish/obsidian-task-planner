import { TaskPlannerEvent } from "../../events";
import { FileAdapter, Logger, TodoItem, TodosInFiles } from "../../types";
import { FileTodoParser } from "../parsers/file-todo-parser";
import { FolderTodoParser } from "../parsers/folder-todo-parser";

export interface TodoIndexDeps<T> {
  fileTodoParser: FileTodoParser<T>;
  folderTodoParser: FolderTodoParser<T>;
  logger: Logger;
}

export interface TodoIndexSettings {
  ignoreArchivedTodos: boolean;
  ignoredFolders: string[];
}

export class TodoIndex<T> {
  files: TodosInFiles<T>[] = [];
  private _todosCache: TodoItem<T>[] | null = null;

  get todos(): TodoItem<T>[] {
    if (this._todosCache === null) {
      this._todosCache = this.files.reduce((res, ts) => res.concat(ts.todos), [] as TodoItem<T>[]);
    }
    return this._todosCache;
  }

  private invalidateCache(): void {
    this._todosCache = null;
  }

  onUpdateEvent = new TaskPlannerEvent<TodoItem<T>[]>();

  constructor(
    private deps: TodoIndexDeps<T>,
    private settings: TodoIndexSettings
  ) {}

  private ignoreFile(file: FileAdapter<T>): boolean {
    // Only exclude archived folders at index level
    // Frontmatter-based ignore (shouldIgnore) is handled at display level
    // so "show ignored" mode can display those tasks
    if (this.settings.ignoreArchivedTodos) {
      const isIgnored = this.settings.ignoredFolders.some((folder) => file.isInFolder(folder));
      if (isIgnored) {
        this.deps.logger.debug(`TodoIndex: File ignored because archived: ${file.id}`);
        return true;
      }
    }
    return false;
  }

  async filesLoaded(files: FileAdapter<T>[]): Promise<void> {
    const filteredFiles = files.filter((file) => !this.ignoreFile(file));
    try {
      const todos = await this.deps.folderTodoParser.parseFiles(filteredFiles);
      this.files = todos;
      this.invalidateCache();
      await this.triggerUpdate();
    } catch (err) {
      this.deps.logger.error(`Failed to load files: ${err}`);
    }
  }

  async fileUpdated(file: FileAdapter<T>): Promise<void> {
    const fileIndex = this.files.findIndex((todosInFile) => todosInFile.file.id === file.id);
    const fileInIndex = fileIndex >= 0;

    // Check if file should be ignored (e.g., frontmatter changed to task-planner-ignore: true)
    if (this.ignoreFile(file)) {
      // If file was previously tracked, remove it from the index
      if (fileInIndex) {
        this.deps.logger.debug(`TodoIndex: File now ignored, removing from index: ${file.id}`);
        this.files.splice(fileIndex, 1);
        this.invalidateCache();
        await this.triggerUpdate();
      }
      return;
    }

    // If file is not in index but should be tracked, add it
    if (!fileInIndex) {
      this.deps.logger.debug(`TodoIndex: File no longer ignored, adding to index: ${file.id}`);
      try {
        const todos = await this.deps.fileTodoParser.parseMdFile(file);
        this.files.push({ todos, file });
        this.invalidateCache();
        await this.triggerUpdate();
      } catch (err) {
        this.deps.logger.error(`Failed to add previously ignored file ${file.id}: ${err}`);
      }
      return;
    }

    this.deps.logger.debug(`TodoIndex: File updated: ${file.id}`);
    try {
      const todos = await this.deps.fileTodoParser.parseMdFile(file);
      this.files[fileIndex].todos = todos;
      this.invalidateCache();
      await this.triggerUpdate();
    } catch (err) {
      this.deps.logger.error(`Failed to update file ${file.id}: ${err}`);
    }
  }

  async fileRenamed(id: string, file: FileAdapter<T>): Promise<void> {
    this.deps.logger.debug(`TodoIndex: File renamed: ${id} to ${file.id}`);

    // Find the old file entry by the old id
    const index = this.files.findIndex((todosInFile) => todosInFile.file.id === id);
    if (index < 0) {
      this.deps.logger.debug(`TodoIndex: File not found in index during rename: ${id}`);
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

    this.deps.logger.debug(`TodoIndex: File deleted: ${file.id}`);
    const index = this.findFileIndex(file);
    this.files.splice(index, 1);
    this.invalidateCache();
    await this.triggerUpdate();
  }

  async fileCreated(file: FileAdapter<T>): Promise<void> {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File created: ${file.id}`);
    try {
      const todos = await this.deps.fileTodoParser.parseMdFile(file);
      this.files.push({ todos, file });
      this.invalidateCache();
      await this.triggerUpdate();
    } catch (err) {
      this.deps.logger.error(`Failed to parse created file ${file.id}: ${err}`);
    }
  }

  private findFileIndex(file: FileAdapter<T>): number {
    const index = this.files.findIndex((todosInFile) => todosInFile.file.id === file.id);
    if (index < 0) {
      this.deps.logger.error(`Todos not found for file '${file.name}'`);
      throw Error(`TodoIndex: File not found in index: ${file.id}`);
    }
    return index;
  }

  private async triggerUpdate(): Promise<void> {
    try {
      await this.onUpdateEvent.fire(this.todos);
    } catch (err) {
      this.deps.logger.error(`Failed to trigger update event: ${err}`);
    }
  }
}
