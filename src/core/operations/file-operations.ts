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

function groupTasksByFile<T>(tasks: TaskItem<T>[]): { file: FileAdapter<T>; tasks: TaskItem<T>[] }[] {
  const groups = new Map<string, { file: FileAdapter<T>; tasks: TaskItem<T>[] }>();
  for (const task of tasks) {
    let group = groups.get(task.file.id);
    if (!group) {
      group = { file: task.file, tasks: [] };
      groups.set(task.file.id, group);
    }
    group.tasks.push(task);
  }
  return [...groups.values()];
}

type TaskLineCandidate = { lineNumber: number; text: string; status: TaskStatus; tags: string[]; attributes: Record<string, string | boolean> };
type TaskIdentity = Pick<TaskItem<unknown>, "line" | "text" | "status" | "tags" | "attributes" | "sourceLine" | "sourceLineCount">;
type FileChange<T> = { file: FileAdapter<T>; tasks: TaskItem<T>[]; before: string; after: string };
export type TaskMutation<T> = {
  task: TaskItem<T>;
  attributes?: { name: string; value: string | boolean | undefined }[];
  tagsToAdd?: string[];
  tagsToRemove?: string[];
  status?: TaskStatus;
  completedDate?: string | null;
};

export class FileOperations {
  lineParser: LineParser;
  private statusOperations: StatusOperations;

  constructor(private settings?: TaskPlannerSettings) {
    this.lineParser = new LineParser(settings);
    this.statusOperations = new StatusOperations(settings);
  }

  private splitContent(content: string): { lines: string[]; separators: string[] } {
    return {
      lines: content.split(/\r\n|\r|\n/),
      separators: content.match(/\r\n|\r|\n/g) ?? [],
    };
  }

  private joinContent(lines: string[], separators: string[]): string {
    return lines.map((line, index) => line + (separators[index] ?? "")).join("");
  }

  private resolveTasks<T>(lines: string[], tasks: TaskItem<T>[], refreshStatus = false): { task: TaskItem<T>; lineNumber: number }[] {
    const taskLines = new Map<string, TaskLineCandidate[]>();
    const sourceLines = new Map<string, TaskLineCandidate[]>();
    const fencedLines = fencedCodeBlockLines(lines);
    for (let index = 0; index < lines.length; index++) {
      if (fencedLines.has(index)) continue;
      const parsed = this.lineParser.parseLine(lines[index]);
      if (!parsed.checkbox) continue;
      const attributes = this.lineParser.parseAttributes(parsed.line);
      const identity = attributes.textWithoutAttributes;
      const candidate = { lineNumber: index, text: attributes.textWithoutAttributes, status: this.statusOperations.markToStatus(parsed.checkbox[1]), tags: attributes.tags, attributes: attributes.attributes };
      taskLines.set(identity, [...(taskLines.get(identity) ?? []), candidate]);
      sourceLines.set(lines[index], [...(sourceLines.get(lines[index]) ?? []), candidate]);
    }

    const resolved = tasks.map((task) => {
      const matches = (task.sourceLine === undefined ? taskLines.get(task.text) : sourceLines.get(task.sourceLine)) ?? [];
      if (matches.length === 0) {
        throw new FileOperationError(`Task not found in current file: ${task.file.path}`, task.file.path, "write", "HIGH", { lineNumber: task.line, taskText: task.text });
      }
      if (matches.length > 1 || (task.sourceLineCount ?? 1) > 1) {
        throw new FileOperationError(`Task identity is ambiguous in current file: ${task.file.path}`, task.file.path, "write", "HIGH", { lineNumber: task.line, taskText: task.text, matches });
      }
      return { task, ...matches[0] };
    });

    if (new Set(resolved.map(({ lineNumber }) => lineNumber)).size !== resolved.length) {
      throw new FileOperationError(`Multiple updates resolved to the same task: ${tasks[0].file.path}`, tasks[0].file.path, "write", "HIGH");
    }
    return resolved.map(({ task, lineNumber, text, status, tags, attributes }) => {
      task.line = lineNumber;
      task.text = text;
      if (refreshStatus) task.status = status;
      task.tags = [...tags];
      task.attributes = { ...attributes };
      task.sourceLine = lines[lineNumber];
      task.sourceLineCount = 1;
      return { task, lineNumber };
    });
  }

  private refreshSourceLineCounts<T>(lines: string[], tasks: TaskItem<T>[]): void {
    const fencedLines = fencedCodeBlockLines(lines);
    for (const task of tasks) {
      task.sourceLineCount = lines.reduce((count, line, index) => count + (line === task.sourceLine && !fencedLines.has(index) ? 1 : 0), 0);
    }
  }

  private async restoreIdentityOnFailure<T>(tasks: TaskItem<T>[], operation: () => Promise<void>): Promise<void> {
    const identities: TaskIdentity[] = tasks.map(({ line, text, status, tags, attributes, sourceLine, sourceLineCount }) => ({
      line,
      text,
      status,
      tags: tags && [...tags],
      attributes: attributes && { ...attributes },
      sourceLine,
      sourceLineCount,
    }));
    try {
      await operation();
    } catch (error) {
      tasks.forEach((task, index) => Object.assign(task, identities[index]));
      throw error;
    }
  }

  private updateContent<T>(content: string, tasks: TaskItem<T>[], updateLine: (line: LineStructure, task: TaskItem<T>) => boolean | void): string {
    const { lines, separators } = this.splitContent(content);
    for (const { task, lineNumber } of this.resolveTasks(lines, tasks)) {
      const line = this.lineParser.parseLine(lines[lineNumber]);
      if (updateLine(line, task) === false) continue;
      lines[lineNumber] = this.lineParser.lineToString(line);
      const attributes = this.lineParser.parseAttributes(line.line);
      task.text = attributes.textWithoutAttributes;
      task.tags = [...attributes.tags];
      task.attributes = { ...attributes.attributes };
      task.sourceLine = lines[lineNumber];
    }
    this.refreshSourceLineCounts(lines, tasks);
    return this.joinContent(lines, separators);
  }

  private addErrorContext<T>(error: FileOperationError, tasks: TaskItem<T>[]): FileOperationError {
    error.context = {
      ...error.context,
      taskCount: tasks.length,
      ...(tasks.length === 1 ? { lineNumber: tasks[0].line } : {}),
    };
    return error;
  }

  private async readFile<T>(file: FileAdapter<T>, tasks: TaskItem<T>[], batch: boolean): Promise<string> {
    try {
      return await file.getContent();
    } catch (error) {
      if (error instanceof FileOperationError) throw this.addErrorContext(error, tasks);
      throw new FileOperationError(batch ? `Failed to read file for batch update: ${file.path}` : `Failed to read file: ${file.path}`, file.path, "read", "HIGH", {
        originalError: error instanceof Error ? error.message : String(error),
        taskCount: tasks.length,
        ...(tasks.length === 1 ? { lineNumber: tasks[0].line } : {}),
      });
    }
  }

  private async processFile<T>(file: FileAdapter<T>, tasks: TaskItem<T>[], transform: (content: string) => string, batch: boolean): Promise<FileChange<T> | undefined> {
    if (file.processContent) {
      let change: FileChange<T> | undefined;
      try {
        await file.processContent((content) => {
          const updated = transform(content);
          change = { file, tasks, before: content, after: updated };
          return updated;
        });
        return change;
      } catch (error) {
        if (error instanceof FileOperationError) throw this.addErrorContext(error, tasks);
        throw new FileOperationError(`Failed to update file: ${file.path}`, file.path, "write", "HIGH", {
          originalError: error instanceof Error ? error.message : String(error),
          taskCount: tasks.length,
          ...(tasks.length === 1 ? { lineNumber: tasks[0].line } : {}),
        });
      }
    }

    const content = await this.readFile(file, tasks, batch);
    const updated = transform(content);
    const change = { file, tasks, before: content, after: updated };
    if (updated === content) return change;
    try {
      await file.setContent(updated);
      return change;
    } catch (error) {
      throw new FileOperationError(batch ? `Failed to write file during batch update: ${file.path}` : `Failed to write file: ${file.path}`, file.path, "write", "HIGH", {
        originalError: error instanceof Error ? error.message : String(error),
        taskCount: tasks.length,
        ...(tasks.length === 1 ? { lineNumber: tasks[0].line } : {}),
      });
    }
  }

  private async updateFile<T>(file: FileAdapter<T>, tasks: TaskItem<T>[], updateLine: (line: LineStructure, task: TaskItem<T>) => boolean | void, batch: boolean): Promise<FileChange<T> | undefined> {
    let change: FileChange<T> | undefined;
    await this.restoreIdentityOnFailure(tasks, async () => {
      change = await this.processFile(file, tasks, (content) => this.updateContent(content, tasks, updateLine), batch);
    });
    return change;
  }

  private async updateBatches<T>(tasks: TaskItem<T>[], updateLine: (line: LineStructure, task: TaskItem<T>) => boolean | void): Promise<void> {
    const tasksWithLines = tasks.filter((task) => task.line !== undefined);
    const groups = groupTasksByFile(tasksWithLines);
    await this.restoreIdentityOnFailure(tasksWithLines, async () => {
      await this.refreshTasks(tasksWithLines);
      const completed: FileChange<T>[] = [];
      try {
        for (const { file, tasks: fileTasks } of groups) {
          const change = await this.updateFile(file, fileTasks, updateLine, true);
          if (change && change.before !== change.after) completed.push(change);
        }
      } catch (error) {
        const rollbackErrors: string[] = [];
        // ponytail: Obsidian has no cross-file transaction; compensate only while each committed file still matches our write.
        for (const change of completed.reverse()) {
          try {
            await this.processFile(
              change.file,
              change.tasks,
              (content) => {
                if (content !== change.after) throw new FileOperationError(`File changed before batch rollback: ${change.file.path}`, change.file.path, "write", "HIGH");
                return change.before;
              },
              true
            );
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
          }
        }
        if (rollbackErrors.length) {
          const originalError = error instanceof Error ? error.message : String(error);
          const path = error instanceof FileOperationError ? error.filePath : (completed[0]?.file.path ?? "unknown");
          throw new FileOperationError(`Batch update failed and rollback was incomplete: ${path}`, path, "write", "HIGH", { originalError, rollbackErrors });
        }
        throw error;
      }
    });
  }

  async refreshTasks<T>(tasks: TaskItem<T>[]): Promise<void> {
    await Promise.all(
      groupTasksByFile(tasks.filter((task) => task.line !== undefined)).map(async ({ file, tasks: fileTasks }) => {
        const content = await this.readFile(file, fileTasks, true);
        this.resolveTasks(this.splitContent(content).lines, fileTasks, true);
      })
    );
  }

  async hasSourceLineAt<T>(task: TaskItem<T>, lineNumber: number, sourceLine: string): Promise<boolean> {
    try {
      return this.splitContent(await task.file.getContent()).lines[lineNumber] === sourceLine;
    } catch {
      return false;
    }
  }

  async processTask<T>(task: TaskItem<T>, update: (lines: string[], lineNumber: number, separators: string[]) => void): Promise<void> {
    if (task.line === undefined) return;
    await this.restoreIdentityOnFailure([task], async () => {
      await this.processFile(
        task.file,
        [task],
        (content) => {
          const { lines, separators } = this.splitContent(content);
          const [{ lineNumber }] = this.resolveTasks(lines, [task]);
          update(lines, lineNumber, separators);
          const parsed = this.lineParser.parseLine(lines[lineNumber]);
          const attributes = this.lineParser.parseAttributes(parsed.line);
          task.text = attributes.textWithoutAttributes;
          task.status = this.statusOperations.markToStatus(parsed.checkbox?.[1] ?? " ");
          task.tags = [...attributes.tags];
          task.attributes = { ...attributes.attributes };
          task.sourceLine = lines[lineNumber];
          this.refreshSourceLineCounts(lines, [task]);
          return this.joinContent(lines, separators);
        },
        false
      );
    });
  }

  async updateAttribute<T>(task: TaskItem<T>, attributeName: string, attributeValue: string | boolean | undefined) {
    await this.updateContentInFile(task, (line) => {
      line.line = this.lineParser.updateAttribute(line.line, attributeName, attributeValue);
    });
  }

  async removeAttribute<T>(task: TaskItem<T>, attributeName: string) {
    await this.updateContentInFile(task, (line) => {
      line.line = this.lineParser.updateAttribute(line.line, attributeName, undefined);
    });
  }

  async appendTag<T>(task: TaskItem<T>, tag: string) {
    await this.updateContentInFile(task, (line) => {
      if (this.lineParser.hasTag(line.line, tag)) return false;
      line.line = this.lineParser.appendTag(line.line, tag);
      return true;
    });
  }

  async removeTag<T>(task: TaskItem<T>, tag: string) {
    await this.updateContentInFile(task, (line) => {
      if (!this.lineParser.hasTag(line.line, tag)) return false;
      const updated = this.lineParser.removeTag(line.line, tag);
      if (updated === line.line) return false;
      line.line = updated;
      return true;
    });
  }

  async updateTaskStatus<T>(task: TaskItem<T>, completedAttribute: string, completedDate?: string | null): Promise<void> {
    const isCompleted = task.status === TaskStatus.Complete || task.status === TaskStatus.Canceled;
    const completedAttributeValue = isCompleted ? (completedDate === undefined ? moment().format("YYYY-MM-DD") : (completedDate ?? undefined)) : undefined;

    await this.updateContentInFile(task, (line) => {
      line.checkbox = statusToCheckbox(task.status);
      line.line = this.lineParser.updateAttribute(line.line, completedAttribute, completedAttributeValue);
    });
  }

  private async updateContentInFile<T>(task: TaskItem<T>, updateLine: (line: LineStructure, task: TaskItem<T>) => boolean | void) {
    if (task.line === undefined) return;
    await this.updateFile(task.file, [task], updateLine, false);
  }

  async batchUpdateAttribute<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined): Promise<void> {
    await this.updateBatches(tasks, (line) => {
      line.line = this.lineParser.updateAttribute(line.line, attributeName, attributeValue);
    });
  }

  async batchRemoveAttribute<T>(tasks: TaskItem<T>[], attributeName: string): Promise<void> {
    await this.updateBatches(tasks, (line) => {
      line.line = this.lineParser.updateAttribute(line.line, attributeName, undefined);
    });
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
      const updated = this.lineParser.removeTag(line.line, tag);
      if (updated === line.line) return false;
      line.line = updated;
      return true;
    });
  }

  async batchUpdateTaskStatus<T>(tasks: TaskItem<T>[], completedAttribute: string): Promise<void> {
    const statuses = new Map(tasks.map((task) => [task, task.status]));
    await this.updateBatches(tasks, (line, task) => {
      task.status = statuses.get(task) ?? task.status;
      line.checkbox = statusToCheckbox(task.status);
      const isCompleted = task.status === TaskStatus.Complete || task.status === TaskStatus.Canceled;
      line.line = this.lineParser.updateAttribute(line.line, completedAttribute, isCompleted ? moment().format("YYYY-MM-DD") : undefined);
    });
  }

  async batchApplyMutations<T>(mutations: TaskMutation<T>[], completedAttribute: string): Promise<void> {
    const byTask = new Map(mutations.map((mutation) => [mutation.task, mutation]));
    await this.updateBatches(
      mutations.map(({ task }) => task),
      (line, task) => {
        const mutation = byTask.get(task);
        if (!mutation) throw new Error("Missing task mutation");
        for (const attribute of mutation.attributes ?? []) line.line = this.lineParser.updateAttribute(line.line, attribute.name, attribute.value);
        for (const tag of mutation.tagsToAdd ?? []) {
          if (!this.lineParser.hasTag(line.line, tag)) line.line = this.lineParser.appendTag(line.line, tag);
        }
        for (const tag of mutation.tagsToRemove ?? []) {
          if (this.lineParser.hasTag(line.line, tag)) line.line = this.lineParser.removeTag(line.line, tag);
        }
        if (mutation.status !== undefined) {
          task.status = mutation.status;
          line.checkbox = statusToCheckbox(mutation.status);
          const completed = mutation.status === TaskStatus.Complete || mutation.status === TaskStatus.Canceled;
          line.line = this.lineParser.updateAttribute(line.line, completedAttribute, completed ? (mutation.completedDate ?? undefined) : undefined);
        }
      }
    );
  }

  async batchMove<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined, completedAttribute: string, tag?: string, newStatus?: TaskStatus, tagsToRemove: string[] = []): Promise<void> {
    await this.updateBatches(tasks, (line, task) => {
      line.line = this.lineParser.updateAttribute(line.line, attributeName, attributeValue);
      if (tag && !this.lineParser.hasTag(line.line, tag)) line.line = this.lineParser.appendTag(line.line, tag);
      for (const removedTag of tagsToRemove) {
        if (this.lineParser.hasTag(line.line, removedTag)) line.line = this.lineParser.removeTag(line.line, removedTag);
      }
      if (newStatus !== undefined) {
        task.status = newStatus;
        line.checkbox = statusToCheckbox(newStatus);
        const isCompleted = newStatus === TaskStatus.Complete || newStatus === TaskStatus.Canceled;
        line.line = this.lineParser.updateAttribute(line.line, completedAttribute, isCompleted ? moment().format("YYYY-MM-DD") : undefined);
      }
    });
  }
}
