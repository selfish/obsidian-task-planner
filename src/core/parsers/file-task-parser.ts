import { fencedCodeBlockLines } from "./code-block";
import { ParseError } from "../../lib/errors";
import { TaskPlannerSettings } from "../../settings";
import { FileAdapter, TaskItem, TaskParsingResult } from "../../types";
import { StatusOperations } from "../operations/status-operations";

export class FileTaskParser<TFile> {
  private statusOperations: StatusOperations;

  constructor(settings: TaskPlannerSettings) {
    this.statusOperations = new StatusOperations(settings);
  }

  private createTaskTreeStructure(lines: string[], parsingResults: TaskParsingResult<TFile>[]): void {
    const parentStack: TaskParsingResult<TFile>[] = [];
    const parent = (): TaskParsingResult<TFile> | undefined => parentStack[parentStack.length - 1];
    const pushParent = (p: TaskParsingResult<TFile>): void => {
      parentStack.push(p);
    };
    const popParent = (): void => {
      parentStack.pop();
    };

    parsingResults.forEach((current) => {
      if (lines[current.lineNumber]?.match(/^\s*$/)) {
        return;
      }

      let currentParent = parent();
      while (currentParent && current.indentLevel <= currentParent.indentLevel) {
        popParent();
        currentParent = parent();
      }

      if (currentParent?.task && current.isTask && current.task) {
        if (!currentParent.task.subtasks) {
          currentParent.task.subtasks = [];
        }
        currentParent.task.subtasks.push(current.task);
      }

      if (current.isTask) {
        pushParent(current);
      }
    });
  }

  private setFileOnSubtasks(task: TaskItem<TFile>, file: FileAdapter<TFile>): void {
    if (task.subtasks) {
      for (const subtask of task.subtasks) {
        subtask.file = file;
        this.setFileOnSubtasks(subtask, file);
      }
    }
  }

  private removeSubtasksFromTree(tasks: TaskItem<TFile>[]): void {
    const toRemove: TaskItem<TFile>[] = [];
    for (const task of tasks) {
      if (task.subtasks) {
        toRemove.push(...task.subtasks);
      }
    }
    for (const subtask of toRemove) {
      const idx = tasks.findIndex((t) => t === subtask);
      if (idx >= 0) {
        tasks.splice(idx, 1);
      }
    }
  }

  async parseMdFile(file: FileAdapter<TFile>): Promise<TaskItem<TFile>[]> {
    let content: string;
    try {
      content = await file.getContent();
    } catch (error) {
      throw new ParseError(`Failed to read file content: ${file.path}`, file.path, undefined, "MEDIUM", { originalError: error instanceof Error ? error.message : String(error) });
    }

    const lines = content.split(/\r\n|\r|\n/);
    const fencedLines = fencedCodeBlockLines(lines);

    const parsingResults = lines.map((line, number) => {
      if (fencedLines.has(number)) {
        return {
          lineNumber: number,
          isTask: false,
          indentLevel: 0,
        };
      }

      const result = this.statusOperations.toTask<TFile>(line, number);
      if (result.task) result.task.sourceLine = line;
      return result;
    });

    const sourceLineCounts = new Map<string, number>();
    for (const { task } of parsingResults) {
      if (task?.sourceLine !== undefined) sourceLineCounts.set(task.sourceLine, (sourceLineCounts.get(task.sourceLine) ?? 0) + 1);
    }
    for (const { task } of parsingResults) {
      if (task?.sourceLine !== undefined) task.sourceLineCount = sourceLineCounts.get(task.sourceLine);
    }

    const taskParsingResults = parsingResults.filter((result) => result.isTask);
    this.createTaskTreeStructure(lines, taskParsingResults);

    const tasks: TaskItem<TFile>[] = [];
    for (const result of taskParsingResults) {
      if (result.task) {
        result.task.file = file;
        // Also set file on subtasks recursively
        this.setFileOnSubtasks(result.task, file);
        tasks.push(result.task);
      }
    }

    this.removeSubtasksFromTree(tasks);
    return tasks;
  }
}
