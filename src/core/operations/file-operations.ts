import { FileOperationError } from "../../lib/errors";
import { TaskPlannerSettings } from "../../settings";
import { FileAdapter, LineStructure, TaskItem, TaskStatus } from "../../types";
import { moment } from "../../utils";
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

function groupTasksByFile<T>(tasks: TaskItem<T>[]): Map<FileAdapter<T>, TaskItem<T>[]> {
  const tasksByFile = new Map<FileAdapter<T>, TaskItem<T>[]>();
  for (const task of tasks) {
    const file = task.file;
    let fileTasks = tasksByFile.get(file);
    if (!fileTasks) {
      fileTasks = [];
      tasksByFile.set(file, fileTasks);
    }
    fileTasks.push(task);
  }
  return tasksByFile;
}

export class FileOperations {
  lineParser: LineParser;

  constructor(private settings?: TaskPlannerSettings) {
    this.lineParser = new LineParser(settings);
  }

  private getEOL(content: string): string {
    return content.includes("\r\n") ? "\r\n" : "\n";
  }

  async updateAttribute<T>(task: TaskItem<T>, attributeName: string, attributeValue: string | boolean | undefined): Promise<void> {
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

  async removeAttribute<T>(task: TaskItem<T>, attributeName: string): Promise<void> {
    await this.updateContentInFile(task, (line) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      delete attributes.attributes[attributeName];
      line.line = this.lineParser.attributesToString(attributes);
    });
  }

  async appendTag<T>(task: TaskItem<T>, tag: string): Promise<void> {
    if (task.tags?.includes(tag)) return;

    await this.updateContentInFile(task, (line) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      attributes.textWithoutAttributes = `${attributes.textWithoutAttributes} #${tag}`;
      line.line = this.lineParser.attributesToString(attributes);
    });
  }

  async removeTag<T>(task: TaskItem<T>, tag: string): Promise<void> {
    if (!task.tags?.includes(tag)) return;

    await this.updateContentInFile(task, (line) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      attributes.textWithoutAttributes = attributes.textWithoutAttributes.replace(new RegExp(`\\s*#${tag}\\b`, "g"), "").trim();
      line.line = this.lineParser.attributesToString(attributes);
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

  private async updateContentInFile<T>(task: TaskItem<T>, updateLine: (line: LineStructure) => void): Promise<void> {
    const file = task.file;
    const lineNumber = task.line;
    if (lineNumber === undefined) {
      return;
    }

    let content: string;
    try {
      content = await file.getContent();
    } catch (error) {
      throw new FileOperationError(`Failed to read file: ${file.path}`, file.path, "read", "HIGH", { originalError: error instanceof Error ? error.message : String(error), lineNumber });
    }

    const EOL = this.getEOL(content);
    const lines = content.split(EOL);
    const line = this.lineParser.parseLine(lines[lineNumber]);
    updateLine(line);
    lines[lineNumber] = this.lineParser.lineToString(line);
    const res = lines.join(EOL);

    try {
      await file.setContent(res);
    } catch (error) {
      throw new FileOperationError(`Failed to write file: ${file.path}`, file.path, "write", "HIGH", { originalError: error instanceof Error ? error.message : String(error), lineNumber });
    }
  }

  async batchUpdateAttribute<T>(tasks: TaskItem<T>[], attributeName: string, attributeValue: string | boolean | undefined): Promise<void> {
    if (tasks.length === 0) return;

    const tasksByFile = groupTasksByFile(tasks);
    for (const [, fileTasks] of tasksByFile) {
      await this.batchUpdateFile(fileTasks, (line) => {
        const attributes = this.lineParser.parseAttributes(line.line);
        if (attributeValue === false || attributeValue === undefined) {
          delete attributes.attributes[attributeName];
        } else {
          attributes.attributes[attributeName] = attributeValue;
        }
        line.line = this.lineParser.attributesToString(attributes);
      });
    }
  }

  async batchRemoveAttribute<T>(tasks: TaskItem<T>[], attributeName: string): Promise<void> {
    if (tasks.length === 0) return;

    const tasksByFile = groupTasksByFile(tasks);
    for (const [, fileTasks] of tasksByFile) {
      await this.batchUpdateFile(fileTasks, (line) => {
        const attributes = this.lineParser.parseAttributes(line.line);
        delete attributes.attributes[attributeName];
        line.line = this.lineParser.attributesToString(attributes);
      });
    }
  }

  async batchAppendTag<T>(tasks: TaskItem<T>[], tag: string): Promise<void> {
    const tasksNeedingTag = tasks.filter((t) => !t.tags?.includes(tag));
    if (tasksNeedingTag.length === 0) return;

    const tasksByFile = groupTasksByFile(tasksNeedingTag);
    for (const [, fileTasks] of tasksByFile) {
      await this.batchUpdateFile(fileTasks, (line) => {
        const attributes = this.lineParser.parseAttributes(line.line);
        attributes.textWithoutAttributes = `${attributes.textWithoutAttributes} #${tag}`;
        line.line = this.lineParser.attributesToString(attributes);
      });
    }
  }

  async batchRemoveTag<T>(tasks: TaskItem<T>[], tag: string): Promise<void> {
    const tasksWithTag = tasks.filter((t) => t.tags?.includes(tag));
    if (tasksWithTag.length === 0) return;

    const tasksByFile = groupTasksByFile(tasksWithTag);
    for (const [, fileTasks] of tasksByFile) {
      await this.batchUpdateFile(fileTasks, (line) => {
        const attributes = this.lineParser.parseAttributes(line.line);
        attributes.textWithoutAttributes = attributes.textWithoutAttributes.replace(new RegExp(`\\s*#${tag}\\b`, "g"), "").trim();
        line.line = this.lineParser.attributesToString(attributes);
      });
    }
  }

  async batchUpdateTaskStatus<T>(tasks: TaskItem<T>[], completedAttribute: string): Promise<void> {
    if (tasks.length === 0) return;

    const tasksByFile = groupTasksByFile(tasks);
    for (const [, fileTasks] of tasksByFile) {
      await this.batchUpdateFile(fileTasks, (line, task) => {
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

  private async batchUpdateFile<T>(tasks: TaskItem<T>[], updateLine: (line: LineStructure, task: TaskItem<T>) => void): Promise<void> {
    if (tasks.length === 0) return;

    const file = tasks[0].file;

    let content: string;
    try {
      content = await file.getContent();
    } catch (error) {
      throw new FileOperationError(`Failed to read file for batch update: ${file.path}`, file.path, "read", "HIGH", { originalError: error instanceof Error ? error.message : String(error), taskCount: tasks.length });
    }

    const EOL = this.getEOL(content);
    const lines = content.split(EOL);

    for (const task of tasks) {
      const lineNumber = task.line;
      if (lineNumber === undefined) {
        continue;
      }
      const line = this.lineParser.parseLine(lines[lineNumber]);
      updateLine(line, task);
      lines[lineNumber] = this.lineParser.lineToString(line);
    }

    const res = lines.join(EOL);

    try {
      await file.setContent(res);
    } catch (error) {
      throw new FileOperationError(`Failed to write file during batch update: ${file.path}`, file.path, "write", "HIGH", { originalError: error instanceof Error ? error.message : String(error), taskCount: tasks.length });
    }
  }
}
