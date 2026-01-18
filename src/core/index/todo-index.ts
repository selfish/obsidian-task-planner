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

  get todos(): TodoItem<T>[] {
    return this.files.reduce((res, ts) => res.concat(ts.todos), [] as TodoItem<T>[]);
  }

  onUpdateEvent = new TaskPlannerEvent<TodoItem<T>[]>();

  constructor(
    private deps: TodoIndexDeps<T>,
    private settings: TodoIndexSettings
  ) {}

  private ignoreFile(file: FileAdapter<T>): boolean {
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
      await this.triggerUpdate();
    } catch (err) {
      this.deps.logger.error(`Failed to load files: ${err}`);
    }
  }

  async fileUpdated(file: FileAdapter<T>): Promise<void> {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File updated: ${file.id}`);
    const index = this.findFileIndex(file);
    try {
      const todos = await this.deps.fileTodoParser.parseMdFile(file);
      this.files[index].todos = todos;
      await this.triggerUpdate();
    } catch (err) {
      this.deps.logger.error(`Failed to update file ${file.id}: ${err}`);
    }
  }

  fileRenamed(id: string, file: FileAdapter<T>): void {
    this.deps.logger.debug(`TodoIndex: File renamed: ${id} to ${file.id}`);
  }

  async fileDeleted(file: FileAdapter<T>): Promise<void> {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File deleted: ${file.id}`);
    const index = this.findFileIndex(file);
    this.files.splice(index, 1);
    await this.triggerUpdate();
  }

  async fileCreated(file: FileAdapter<T>): Promise<void> {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File created: ${file.id}`);
    try {
      const todos = await this.deps.fileTodoParser.parseMdFile(file);
      this.files.push({ todos, file });
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
