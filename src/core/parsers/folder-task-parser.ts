import { FileTaskParser } from "./file-task-parser";
import { ParseError } from "../../lib/errors";
import { FileAdapter, Logger, TasksInFiles } from "../../types";

export interface FolderTaskParserDeps<TFile> {
  fileTaskParser: FileTaskParser<TFile>;
  logger: Logger;
}

export class FolderTaskParser<TFile> {
  constructor(private deps: FolderTaskParserDeps<TFile>) {}

  private async parseFile(file: FileAdapter<TFile>): Promise<TasksInFiles<TFile>> {
    try {
      const tasks = await this.deps.fileTaskParser.parseMdFile(file);
      return {
        tasks,
        file,
      };
    } catch (error) {
      // Log the error and return empty tasks for this file to continue processing others
      const parseError = error instanceof ParseError ? error : new ParseError(`Failed to parse file: ${file.path}`, file.path, undefined, "MEDIUM", { originalError: error instanceof Error ? error.message : String(error) });
      this.deps.logger.error(parseError, { filePath: file.path });
      return {
        tasks: [],
        file,
      };
    }
  }

  public async parseFiles(files: FileAdapter<TFile>[]): Promise<TasksInFiles<TFile>[]> {
    const startTime = Date.now();
    this.deps.logger.debug(`Loading ${files.length} files`);
    const tasksByFile = await Promise.all(files.map((file) => this.parseFile(file)));
    this.deps.logger.debug(`Loaded ${tasksByFile.length} tasks in ${Date.now() - startTime}ms`);
    return tasksByFile;
  }
}
