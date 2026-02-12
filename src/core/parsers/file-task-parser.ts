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

    for (const current of parsingResults) {
      if (lines[current.lineNumber]?.match(/^\s*$/)) {
        continue;
      }

      while (parentStack.length > 0 && current.indentLevel <= parentStack[parentStack.length - 1].indentLevel) {
        parentStack.pop();
      }

      const currentParent = parentStack[parentStack.length - 1];
      if (currentParent?.task && current.isTask && current.task) {
        if (!currentParent.task.subtasks) {
          currentParent.task.subtasks = [];
        }
        currentParent.task.subtasks.push(current.task);
      }

      if (current.isTask) {
        parentStack.push(current);
      }
    }
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
    let insideCodeBlock = false;

    const parsingResults = lines.map((line, number) => {
      if (this.isCodeBlockFence(line)) {
        insideCodeBlock = !insideCodeBlock;
      }

      if (insideCodeBlock && !this.isCodeBlockFence(line)) {
        return { lineNumber: number, isTask: false, indentLevel: 0 };
      }

      return this.statusOperations.toTask<TFile>(line, number);
    });

    const taskParsingResults = parsingResults.filter((result) => result.isTask);
    this.createTaskTreeStructure(lines, taskParsingResults);

    const tasks: TaskItem<TFile>[] = [];
    for (const result of taskParsingResults) {
      if (result.task) {
        result.task.file = file;
        this.setFileOnSubtasks(result.task, file);
        tasks.push(result.task);
      }
    }

    this.removeSubtasksFromTree(tasks);
    return tasks;
  }
}
