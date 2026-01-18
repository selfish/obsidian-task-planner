import { FileTodoParser } from "./file-todo-parser";
import { ParseError } from "../../lib/errors";
import { FileAdapter, Logger, TodosInFiles } from "../../types";

export interface FolderTodoParserDeps<TFile> {
  fileTodoParser: FileTodoParser<TFile>;
  logger: Logger;
}

export class FolderTodoParser<TFile> {
  constructor(private deps: FolderTodoParserDeps<TFile>) {}

  private async parseFile(file: FileAdapter<TFile>): Promise<TodosInFiles<TFile>> {
    try {
      const todos = await this.deps.fileTodoParser.parseMdFile(file);
      return {
        todos,
        file,
      };
    } catch (error) {
      // Log the error and return empty todos for this file to continue processing others
      const parseError = error instanceof ParseError
        ? error
        : new ParseError(
            `Failed to parse file: ${file.path}`,
            file.path,
            undefined,
            'MEDIUM',
            { originalError: error instanceof Error ? error.message : String(error) }
          );
      this.deps.logger.error(parseError, { filePath: file.path });
      return {
        todos: [],
        file,
      };
    }
  }

  public async parseFiles(files: FileAdapter<TFile>[]): Promise<TodosInFiles<TFile>[]> {
    const startTime = Date.now();
    this.deps.logger.debug(`Loading ${files.length} files`);
    const todosByFile = await Promise.all(files.map((file) => this.parseFile(file)));
    this.deps.logger.debug(`Loaded ${todosByFile.length} todos in ${Date.now() - startTime}ms`);
    return todosByFile;
  }
}
