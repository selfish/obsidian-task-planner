import { FileAdapter } from "../../types/file-adapter";
import { FileTodoParser } from "./file-todo-parser";
import { Logger } from "../../types/logger";
import { TodosInFiles } from "../../types/todos-in-files";

export interface FolderTodoParserDeps<TFile> {
  fileTodoParser: FileTodoParser<TFile>;
  logger: Logger;
}

export class FolderTodoParser<TFile> {
  constructor(private deps: FolderTodoParserDeps<TFile>) {}

  private async ParseFileAsync(file: FileAdapter<TFile>): Promise<TodosInFiles<TFile>> {
    const todos = await this.deps.fileTodoParser.parseMdFileAsync(file);
    return {
      todos,
      file,
    };
  }

  public async ParseFilesAsync(files: FileAdapter<TFile>[]): Promise<TodosInFiles<TFile>[]> {
    const startTime = Date.now();
    this.deps.logger.debug(`Loading ${files.length} files`);
    const todosByFile = await Promise.all(files.map((file) => this.ParseFileAsync(file)));
    this.deps.logger.debug(`Loaded ${todosByFile.length} todos in ${Date.now() - startTime}ms`);
    return todosByFile;
  }
}
