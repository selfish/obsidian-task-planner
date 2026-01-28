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

  private isCodeBlockFence(line: string): boolean {
    return /^\s*```/.test(line);
  }

  async parseMdFile(file: FileAdapter<TFile>): Promise<TaskItem<TFile>[]> {
    let content: string;
    try {
      content = await file.getContent();
    } catch (error) {
      throw new ParseError(`Failed to read file content: ${file.path}`, file.path, undefined, "MEDIUM", { originalError: error instanceof Error ? error.message : String(error) });
    }

    const lines = content.split("\n");

    // Track code block state to skip tasks inside fenced code blocks
    let insideCodeBlock = false;

    const parsingResults = lines.map((line, number) => {
      // Check for code block fence (``` with optional language specifier)
      if (this.isCodeBlockFence(line)) {
        insideCodeBlock = !insideCodeBlock;
      }

      // Skip parsing tasks inside code blocks
      if (insideCodeBlock && !this.isCodeBlockFence(line)) {
        return {
          lineNumber: number,
          isTask: false,
          indentLevel: 0,
        };
      }

      return this.statusOperations.toTask<TFile>(line, number);
    });

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
