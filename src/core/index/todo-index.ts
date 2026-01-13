import { TaskPlannerEvent } from "../../events/task-planner-event";
import { Logger } from "../../types/logger";
import { FileTodoParser } from "../parsers/file-todo-parser";
import { FolderTodoParser } from "../parsers/folder-todo-parser";
import { FileAdapter } from "../../types/file-adapter";
import { TodosInFiles } from "../../types/todos-in-files";
import { TodoItem } from "../../types/todo";

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
      const isIgnored = this.settings.ignoredFolders.some(folder => file.isInFolder(folder));
      if (isIgnored) {
        this.deps.logger.debug(`TodoIndex: File ignored because archived: ${file.id}`);
        return true;
      }
    }
    return false;
  }

  filesLoaded(files: FileAdapter<T>[]): void {
    const filteredFiles = files.filter(file => !this.ignoreFile(file));
    this.deps.folderTodoParser.ParseFilesAsync(filteredFiles).then(todos => {
      this.files = todos;
      this.triggerUpdate();
    });
  }

  fileUpdated(file: FileAdapter<T>): void {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File updated: ${file.id}`);
    const index = this.findFileIndex(file);
    this.deps.fileTodoParser.parseMdFileAsync(file).then(todos => {
      this.files[index].todos = todos;
      this.triggerUpdate();
    });
  }

  fileRenamed(id: string, file: FileAdapter<T>): void {
    this.deps.logger.debug(`TodoIndex: File renamed: ${id} to ${file.id}`);
    // Files update themselves, no action needed
  }

  fileDeleted(file: FileAdapter<T>): void {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File deleted: ${file.id}`);
    const index = this.findFileIndex(file);
    this.files.splice(index, 1);
    this.triggerUpdate();
  }

  fileCreated(file: FileAdapter<T>): void {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File created: ${file.id}`);
    this.deps.fileTodoParser.parseMdFileAsync(file).then(todos => {
      this.files.push({ todos, file });
      this.triggerUpdate();
    });
  }

  private findFileIndex(file: FileAdapter<T>): number {
    const index = this.files.findIndex(todosInFile => todosInFile.file.id === file.id);
    if (index < 0) {
      this.deps.logger.error(`Todos not found for file '${file.name}'`);
      throw Error(`TodoIndex: File not found in index: ${file.id}`);
    }
    return index;
  }

  private triggerUpdate(): void {
    this.onUpdateEvent.fireAsync(this.todos);
  }
}
