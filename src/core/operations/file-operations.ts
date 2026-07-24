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

type TaskLineCandidate = { lineNumber: number; text: string; tags: string[]; attributes: Record<string, string | boolean> };
type TaskIdentity = Pick<TaskItem<unknown>, "line" | "text" | "tags" | "attributes" | "sourceLine" | "sourceLineCount">;
type FileChange<T> = { file: FileAdapter<T>; tasks: TaskItem<T>[]; before: string; after: string };

export class FileOperations {
  lineParser: LineParser;

  constructor(private settings?: TaskPlannerSettings) {
    this.lineParser = new LineParser(settings);
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

  private resolveTasks<T>(lines: string[], tasks: TaskItem<T>[]): { task: TaskItem<T>; lineNumber: number }[] {
    const taskLines = new Map<string, TaskLineCandidate[]>();
    const sourceLines = new Map<string, TaskLineCandidate[]>();
    const fencedLines = fencedCodeBlockLines(lines);
    for (let index = 0; index < lines.length; index++) {
      if (fencedLines.has(index)) continue;
      const parsed = this.lineParser.parseLine(lines[index]);
      if (!parsed.checkbox) continue;
      const attributes = this.lineParser.parseAttributes(parsed.line);
      const identity = attributes.textWithoutAttributes;
      const candidate = { lineNumber: index, text: attributes.textWithoutAttributes, tags: attributes.tags, attributes: attributes.attributes };
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
    return resolved.map(({ task, lineNumber, text, tags, attributes }) => {
      task.line = lineNumber;
      task.text = text;
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
    const identities: TaskIdentity[] = tasks.map(({ line, text, tags, attributes, sourceLine, sourceLineCount }) => ({
      line,
      text,
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
        this.resolveTasks(this.splitContent(content).lines, fileTasks);
      })
    );
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
      const attributes = this.lineParser.parseAttributes(line.line);
      if (attributeValue === false || attributeValue === undefined) {
        delete attributes.attributes[attributeName];
      } else {
        attributes.attributes[attributeName] = attributeValue;
      }
      line.line = this.lineParser.attributesToString(attributes);
    });
  }

  async removeAttribute<T>(task: TaskItem<T>, attributeName: string) {
    await this.updateContentInFile(task, (line) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      delete attributes.attributes[attributeName];
      line.line = this.lineParser.attributesToString(attributes);
    });
  }

  async appendTag<T>(task: TaskItem<T>, tag: string) {
    await this.updateContentInFile(task, (line, currentTask) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      if (attributes.tags.includes(tag)) return false;
      attributes.textWithoutAttributes = `${attributes.textWithoutAttributes} #${tag}`;
      line.line = this.lineParser.attributesToString(attributes);
      currentTask.text = attributes.textWithoutAttributes;
      currentTask.tags = [...attributes.tags, tag];
      return true;
    });
  }

  async removeTag<T>(task: TaskItem<T>, tag: string) {
    await this.updateContentInFile(task, (line, currentTask) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      if (!attributes.tags.includes(tag)) return false;
      attributes.textWithoutAttributes = attributes.textWithoutAttributes.replace(new RegExp(`\\s*#${tag}\\b`, "g"), "").trim();
      line.line = this.lineParser.attributesToString(attributes);
      currentTask.text = attributes.textWithoutAttributes;
      currentTask.tags = attributes.tags.filter((currentTag) => currentTag !== tag);
      return true;
    });
  }

  async updateTaskStatus<T>(task: TaskItem<T>, completedAttribute: string): Promise<void> {
    const isCompleted = task.status === TaskStatus.Complete || task.status === TaskStatus.Canceled;
    const completedAttributeValue = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

    await this.updateContentInFile(task, (line) => {
      line.checkbox = statusToCheckbox(task.status);
      const attributes = this.lineParser.parseAttributes(line.line);
      if (completedAttributeValue === undefined) {
        delete attributes.attributes[completedAttribute];
      } else {
        attributes.attributes[completedAttribute] = completedAttributeValue;
      }
      line.line = this.lineParser.attributesToString(attributes);
    });
  }

  private async updateContentInFile<T>(task: TaskItem<T>, updateLine: (line: LineStructure, task: TaskItem<T>) => boolean | void) {
    if (task.line === undefined) return;
    await this.updateFile(task.file, [task], updateLine, false);
  }

  async batchUpdateAttribute<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined): Promise<void> {
    await this.updateBatches(tasks, (line) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      if (attributeValue === false || attributeValue === undefined) {
        delete attributes.attributes[attributeName];
      } else {
        attributes.attributes[attributeName] = attributeValue;
      }
      line.line = this.lineParser.attributesToString(attributes);
    });
  }

  async batchRemoveAttribute<T>(tasks: TaskItem<T>[], attributeName: string): Promise<void> {
    await this.updateBatches(tasks, (line) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      delete attributes.attributes[attributeName];
      line.line = this.lineParser.attributesToString(attributes);
    });
  }

  async batchAppendTag<T>(tasks: TaskItem<T>[], tag: string): Promise<void> {
    await this.updateBatches(tasks, (line, task) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      if (attributes.tags.includes(tag)) return false;
      attributes.textWithoutAttributes = `${attributes.textWithoutAttributes} #${tag}`;
      line.line = this.lineParser.attributesToString(attributes);
      task.text = attributes.textWithoutAttributes;
      task.tags = [...attributes.tags, tag];
      return true;
    });
  }

  async batchRemoveTag<T>(tasks: TaskItem<T>[], tag: string): Promise<void> {
    await this.updateBatches(tasks, (line, task) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      if (!attributes.tags.includes(tag)) return false;
      attributes.textWithoutAttributes = attributes.textWithoutAttributes.replace(new RegExp(`\\s*#${tag}\\b`, "g"), "").trim();
      line.line = this.lineParser.attributesToString(attributes);
      task.text = attributes.textWithoutAttributes;
      task.tags = attributes.tags.filter((currentTag) => currentTag !== tag);
      return true;
    });
  }

  async batchUpdateTaskStatus<T>(tasks: TaskItem<T>[], completedAttribute: string): Promise<void> {
    await this.updateBatches(tasks, (line, task) => {
      line.checkbox = statusToCheckbox(task.status);
      const isCompleted = task.status === TaskStatus.Complete || task.status === TaskStatus.Canceled;
      const completedAttributeValue = isCompleted ? moment().format("YYYY-MM-DD") : undefined;
      const attributes = this.lineParser.parseAttributes(line.line);
      if (completedAttributeValue === undefined) {
        delete attributes.attributes[completedAttribute];
      } else {
        attributes.attributes[completedAttribute] = completedAttributeValue;
      }
      line.line = this.lineParser.attributesToString(attributes);
    });
  }
}
