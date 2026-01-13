import { TaskPlannerEvent } from "../events/TaskPlannerEvent";
import { ILogger } from "./ILogger";
import { FileTodoParser } from "./FileTodoParser";
import { FolderTodoParser } from "./FolderTodoParser";
import { IFile } from "./IFile";
import { ITodosInFiles } from "./ITodosInFiles";
import { TodoItem } from "./TodoItem";

export interface TodoIndexDeps<T> {
  fileTodoParser: FileTodoParser<T>;
  folderTodoParser: FolderTodoParser<T>;
  logger: ILogger;
}

export interface TodoIndexSettings {
  ignoreArchivedTodos: boolean;
  ignoredFolders: string[];
}

export class TodoIndex<T> {
  files: ITodosInFiles<T>[] = [];

  get todos(): TodoItem<T>[] {
    return this.files.reduce((res, ts) => res.concat(ts.todos), [] as TodoItem<T>[]);
  }

  onUpdateEvent = new TaskPlannerEvent<TodoItem<T>[]>();

  constructor(
    private deps: TodoIndexDeps<T>,
    private settings: TodoIndexSettings
  ) {}

  private ignoreFile(file: IFile<T>): boolean {
    if (this.settings.ignoreArchivedTodos) {
      const isIgnored = this.settings.ignoredFolders.some(folder => file.isInFolder(folder));
      if (isIgnored) {
        this.deps.logger.debug(`TodoIndex: File ignored because archived: ${file.id}`);
        return true;
      }
    }
    return false;
  }

  filesLoaded(files: IFile<T>[]): void {
    const filteredFiles = files.filter(file => !this.ignoreFile(file));
    this.deps.folderTodoParser.ParseFilesAsync(filteredFiles).then(todos => {
      this.files = todos;
      this.triggerUpdate();
    });
  }

  fileUpdated(file: IFile<T>): void {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File updated: ${file.id}`);
    const index = this.findFileIndex(file);
    this.deps.fileTodoParser.parseMdFileAsync(file).then(todos => {
      this.files[index].todos = todos;
      this.triggerUpdate();
    });
  }

  fileRenamed(id: string, file: IFile<T>): void {
    this.deps.logger.debug(`TodoIndex: File renamed: ${id} to ${file.id}`);
    // Files update themselves, no action needed
  }

  fileDeleted(file: IFile<T>): void {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File deleted: ${file.id}`);
    const index = this.findFileIndex(file);
    this.files.splice(index, 1);
    this.triggerUpdate();
  }

  fileCreated(file: IFile<T>): void {
    if (this.ignoreFile(file)) return;

    this.deps.logger.debug(`TodoIndex: File created: ${file.id}`);
    this.deps.fileTodoParser.parseMdFileAsync(file).then(todos => {
      this.files.push({ todos, file });
      this.triggerUpdate();
    });
  }

  private findFileIndex(file: IFile<T>): number {
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
