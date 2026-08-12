import { StatusOperations } from "./status-operations";
import { FileOperationError } from "../../lib/errors";
import { TaskPlannerSettings } from "../../settings";
import { FileAdapter, LineStructure, TaskItem, TaskStatus } from "../../types";
import { moment } from "../../utils";
import { fencedCodeBlockLines } from "../parsers/code-block";
import { LineParser } from "../parsers/line-parser";

function statusToCheckbox(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.Todo:
      return "[ ]";
    case TaskStatus.Canceled:
      return "[-]";
    case TaskStatus.AttentionRequired:
      return "[!]";
    case TaskStatus.Complete:
      return "[x]";
    case TaskStatus.Delegated:
      return "[d]";
    case TaskStatus.InProgress:
      return "[>]";
    default:
      return "";
  }
}

type ResolvedTask<T> = { task: TaskItem<T>; lineNumber: number };
type TaskIdentity = Pick<TaskItem<unknown>, "line" | "sourceLine" | "sourceLineCount" | "text" | "status" | "tags" | "attributes">;

function groupTasksByFile<T>(tasks: TaskItem<T>[]): { file: FileAdapter<T>; tasks: TaskItem<T>[] }[] {
  const groups = new Map<FileAdapter<T>, { file: FileAdapter<T>; tasks: TaskItem<T>[] }>();
  for (const task of tasks) {
    let group = groups.get(task.file);
    if (!group) {
      group = { file: task.file, tasks: [] };
      groups.set(task.file, group);
    }
    group.tasks.push(task);
  }
  return Array.from(groups.values());
}

export class FileOperations {
  lineParser: LineParser;
  private statusOperations: StatusOperations;

  constructor(private settings?: TaskPlannerSettings) {
    this.lineParser = new LineParser(settings);
    this.statusOperations = new StatusOperations(settings);
  }

  private splitContent(content: string): { lines: string[]; separators: string[] } {
    return { lines: content.split(/\r\n|\r|\n/), separators: content.match(/\r\n|\r|\n/g) ?? [] };
  }

  private joinContent(lines: string[], separators: string[]): string {
    return lines.map((line, index) => line + (separators[index] ?? "")).join("");
  }

  private resolveTasks<T>(lines: string[], tasks: TaskItem<T>[]): ResolvedTask<T>[] {
    const bySource = new Map<string, number[]>();
    const fenced = fencedCodeBlockLines(lines);

    lines.forEach((raw, lineNumber) => {
      if (fenced.has(lineNumber)) return;
      const line = this.lineParser.parseLine(raw);
      if (!line.checkbox) return;
      bySource.set(raw, [...(bySource.get(raw) ?? []), lineNumber]);
    });

    const resolved = tasks.map((task) => {
      if (task.sourceLine === undefined) {
        const lineNumber = task.line;
        if (lineNumber === undefined) {
          throw new FileOperationError(`Task has no safe source identity in current file: ${task.file.path}`, task.file.path, "write", "HIGH", { lineNumber: task.line, taskText: task.text });
        }
        const raw = lines[lineNumber];
        if (raw === undefined || fenced.has(lineNumber) || !this.lineParser.parseLine(raw).checkbox) {
          throw new FileOperationError(`Task has no safe source identity in current file: ${task.file.path}`, task.file.path, "write", "HIGH", { lineNumber: task.line, taskText: task.text });
        }
        const currentText = this.lineParser.parseAttributes(this.lineParser.parseLine(raw).line).textWithoutAttributes;
        if (currentText !== task.text) {
          throw new FileOperationError(`Task has no safe source identity in current file: ${task.file.path}`, task.file.path, "write", "HIGH", { lineNumber: task.line, taskText: task.text });
        }
        return { task, lineNumber };
      }
      if ((task.sourceLineCount ?? 1) > 1) {
        throw new FileOperationError(`Task identity is ambiguous in current file: ${task.file.path}`, task.file.path, "write", "HIGH", { lineNumber: task.line, taskText: task.text });
      }
      const matches = bySource.get(task.sourceLine) ?? [];
      if (matches.length === 0) {
        throw new FileOperationError(`Task not found in current file: ${task.file.path}`, task.file.path, "write", "HIGH", { lineNumber: task.line, taskText: task.text });
      }
      if (matches.length > 1) {
        throw new FileOperationError(`Task identity is ambiguous in current file: ${task.file.path}`, task.file.path, "write", "HIGH", { lineNumber: task.line, taskText: task.text, matches });
      }
      return { task, lineNumber: matches[0] };
    });

    if (new Set(resolved.map(({ lineNumber }) => lineNumber)).size !== resolved.length) {
      throw new FileOperationError(`Multiple updates resolved to the same task: ${tasks[0].file.path}`, tasks[0].file.path, "write", "HIGH");
    }
    return resolved;
  }

  private identity(lines: string[], sourceLineCounts: Map<string, number>, { task, lineNumber }: ResolvedTask<unknown>): TaskIdentity {
    const raw = lines[lineNumber];
    const line = this.lineParser.parseLine(raw);
    const parsed = this.lineParser.parseAttributes(line.line);
    return {
      line: lineNumber,
      sourceLine: raw,
      sourceLineCount: sourceLineCounts.get(raw),
      text: parsed.textWithoutAttributes,
      status: line.checkbox ? this.statusOperations.markToStatus(line.checkbox[1]) : task.status,
      tags: [...parsed.tags],
      attributes: { ...parsed.attributes },
    };
  }

  private async atomicUpdate<T>(file: FileAdapter<T>, tasks: TaskItem<T>[], update: (lines: string[], separators: string[], resolved: ResolvedTask<T>[]) => void): Promise<void> {
    if (!file.processContent) {
      throw new FileOperationError(`Atomic file updates are unavailable: ${file.path}`, file.path, "write", "HIGH", { taskCount: tasks.length });
    }

    let identities: TaskIdentity[] = [];
    try {
      await file.processContent((content) => {
        const { lines, separators } = this.splitContent(content);
        const resolved = this.resolveTasks(lines, tasks);
        update(lines, separators, resolved);
        const fenced = fencedCodeBlockLines(lines);
        const sourceLineCounts = new Map<string, number>();
        lines.forEach((raw, index) => {
          if (!fenced.has(index)) sourceLineCounts.set(raw, (sourceLineCounts.get(raw) ?? 0) + 1);
        });
        identities = resolved.map((item) => this.identity(lines, sourceLineCounts, item as ResolvedTask<unknown>));
        return this.joinContent(lines, separators);
      });
    } catch (error) {
      if (error instanceof FileOperationError) throw error;
      throw new FileOperationError(`Failed to update file: ${file.path}`, file.path, "write", "HIGH", {
        originalError: error instanceof Error ? error.message : String(error),
        taskCount: tasks.length,
      });
    }

    tasks.forEach((task, index) => {
      try {
        Object.assign(task, identities[index]);
      } catch {
        // The atomic write already committed; immutable callers can refresh from the task index.
      }
    });
  }

  private async updateFile<T>(file: FileAdapter<T>, tasks: TaskItem<T>[], updateLine: (line: LineStructure, task: TaskItem<T>) => boolean | void): Promise<void> {
    await this.atomicUpdate(file, tasks, (lines, _separators, resolved) => {
      for (const { task, lineNumber } of resolved) {
        const line = this.lineParser.parseLine(lines[lineNumber]);
        if (updateLine(line, task) !== false) lines[lineNumber] = this.lineParser.lineToString(line);
      }
    });
  }

  private async updateContentInFile<T>(task: TaskItem<T>, updateLine: (line: LineStructure, task: TaskItem<T>) => boolean | void): Promise<void> {
    if (task.line === undefined) return;
    await this.updateFile(task.file, [task], updateLine);
  }

  private async updateBatches<T>(tasks: TaskItem<T>[], updateLine: (line: LineStructure, task: TaskItem<T>) => boolean | void): Promise<void> {
    for (const { file, tasks: fileTasks } of groupTasksByFile(tasks.filter((task) => task.line !== undefined))) {
      await this.updateFile(file, fileTasks, updateLine);
    }
  }

  async processTask<T>(task: TaskItem<T>, update: (lines: string[], lineNumber: number, separators: string[]) => void): Promise<void> {
    if (task.line === undefined) return;
    await this.atomicUpdate(task.file, [task], (lines, separators, [resolved]) => update(lines, resolved.lineNumber, separators));
  }

  async updateAttribute<T>(task: TaskItem<T>, attributeName: string, attributeValue: string | boolean | undefined): Promise<void> {
    await this.updateContentInFile(task, (line) => {
      line.line = this.lineParser.updateAttribute(line.line, attributeName, attributeValue);
    });
  }

  async removeAttribute<T>(task: TaskItem<T>, attributeName: string): Promise<void> {
    await this.updateAttribute(task, attributeName, undefined);
  }

  async appendTag<T>(task: TaskItem<T>, tag: string): Promise<void> {
    await this.updateContentInFile(task, (line) => {
      if (this.lineParser.hasTag(line.line, tag)) return false;
      line.line = this.lineParser.appendTag(line.line, tag);
      return true;
    });
  }

  async removeTag<T>(task: TaskItem<T>, tag: string): Promise<void> {
    await this.updateContentInFile(task, (line) => {
      if (!this.lineParser.hasTag(line.line, tag)) return false;
      line.line = this.lineParser.removeTag(line.line, tag);
      return true;
    });
  }

  async updateTaskStatus<T>(task: TaskItem<T>, completedAttribute: string, completedDateOverride?: string | null): Promise<void> {
    const completed = task.status === TaskStatus.Complete || task.status === TaskStatus.Canceled;
    const completedDate = completed ? (completedDateOverride === undefined ? moment().format("YYYY-MM-DD") : completedDateOverride === null ? undefined : completedDateOverride) : undefined;
    await this.updateContentInFile(task, (line) => {
      line.checkbox = statusToCheckbox(task.status);
      line.line = this.lineParser.updateAttribute(line.line, completedAttribute, completedDate);
    });
  }

  async batchUpdateAttribute<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined): Promise<void> {
    await this.updateBatches(tasks, (line) => {
      line.line = this.lineParser.updateAttribute(line.line, attributeName, attributeValue);
    });
  }

  async batchRemoveAttribute<T>(tasks: TaskItem<T>[], attributeName: string): Promise<void> {
    await this.batchUpdateAttribute(tasks, attributeName, undefined);
  }

  async batchAppendTag<T>(tasks: TaskItem<T>[], tag: string): Promise<void> {
    await this.updateBatches(tasks, (line) => {
      if (this.lineParser.hasTag(line.line, tag)) return false;
      line.line = this.lineParser.appendTag(line.line, tag);
      return true;
    });
  }

  async batchRemoveTag<T>(tasks: TaskItem<T>[], tag: string): Promise<void> {
    await this.updateBatches(tasks, (line) => {
      if (!this.lineParser.hasTag(line.line, tag)) return false;
      line.line = this.lineParser.removeTag(line.line, tag);
      return true;
    });
  }

  async batchMove<T>(
    tasks: TaskItem<T>[],
    options: {
      attributeName: string;
      attributeValue: string | boolean | undefined;
      completedAttribute: string;
      completedDate?: string;
      tag?: string;
      tagsToRemove?: string[];
      newStatus?: TaskStatus;
    }
  ): Promise<void> {
    await this.updateBatches(tasks, (line) => {
      line.line = this.lineParser.updateAttribute(line.line, options.attributeName, options.attributeValue);
      if (options.tag && !this.lineParser.hasTag(line.line, options.tag)) line.line = this.lineParser.appendTag(line.line, options.tag);
      for (const tag of options.tagsToRemove ?? []) {
        if (this.lineParser.hasTag(line.line, tag)) line.line = this.lineParser.removeTag(line.line, tag);
      }
      if (options.newStatus !== undefined) {
        line.checkbox = statusToCheckbox(options.newStatus);
        const completed = options.newStatus === TaskStatus.Complete || options.newStatus === TaskStatus.Canceled;
        line.line = this.lineParser.updateAttribute(line.line, options.completedAttribute, completed ? (options.completedDate ?? moment().format("YYYY-MM-DD")) : undefined);
      }
    });
  }

  async batchUpdateTaskStatus<T>(tasks: TaskItem<T>[], completedAttribute: string, completedDateOverride?: string): Promise<void> {
    const statuses = new Map(tasks.map((task) => [task, task.status]));
    await this.updateBatches(tasks, (line, task) => {
      const status = statuses.get(task);
      line.checkbox = statusToCheckbox(status);
      const completed = status === TaskStatus.Complete || status === TaskStatus.Canceled;
      line.line = this.lineParser.updateAttribute(line.line, completedAttribute, completed ? (completedDateOverride ?? moment().format("YYYY-MM-DD")) : undefined);
    });
  }
}
