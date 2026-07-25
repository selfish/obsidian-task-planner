import { TaskPlannerSettings } from "../../settings/types";
import { TaskItem } from "../../types/task";
import { moment } from "../../utils/moment";
import { FileOperations } from "../operations/file-operations";
import { LineParser } from "../parsers/line-parser";

export interface FollowUpOptions {
  /** Mark the original task as complete after creating the follow-up */
  completeOriginal?: boolean;
}

export class FollowUpCreator<T> {
  constructor(private settings: TaskPlannerSettings) {}

  async createFollowUp(todo: TaskItem<T>, dueDate: string | null, options?: FollowUpOptions): Promise<void> {
    const text = this.buildFollowUpText(todo);
    const attributes = this.buildFollowUpAttributes(todo, dueDate);
    const tags = this.buildFollowUpTags(todo);
    const taskLine = this.formatTaskLine(text, attributes, tags);

    await this.insertAfterOriginal(todo, taskLine, options?.completeOriginal);
  }

  private buildFollowUpText(todo: TaskItem<T>): string {
    const prefix = this.settings.followUp.textPrefix;
    // Strip existing prefix to avoid "Follow up: Follow up: Task"
    const textWithoutPrefix = this.stripExistingPrefix(todo.text, prefix);

    if (!prefix) {
      return textWithoutPrefix;
    }
    // Ensure there's a space between prefix and text
    const separator = prefix.endsWith(" ") ? "" : " ";
    return `${prefix}${separator}${textWithoutPrefix}`;
  }

  private stripExistingPrefix(text: string, prefix: string): string {
    if (!prefix) {
      return text;
    }
    const trimmedPrefix = prefix.trim();
    if (!trimmedPrefix) {
      return text;
    }
    // Check if text starts with the prefix (with or without trailing space)
    if (text.startsWith(trimmedPrefix + " ")) {
      return text.slice(trimmedPrefix.length + 1);
    }
    if (text.startsWith(trimmedPrefix)) {
      return text.slice(trimmedPrefix.length).trimStart();
    }
    return text;
  }

  private buildFollowUpAttributes(todo: TaskItem<T>, dueDate: string | null): Record<string, string | boolean> {
    const attributes: Record<string, string | boolean> = {};

    // Set due date if provided
    if (dueDate) {
      attributes[this.settings.dueDateAttribute] = dueDate;
    }

    // Copy priority if setting is enabled
    if (this.settings.followUp.copyPriority && todo.attributes?.["priority"]) {
      attributes["priority"] = todo.attributes["priority"];
    }

    return attributes;
  }

  private buildFollowUpTags(todo: TaskItem<T>): string[] {
    if (!this.settings.followUp.copyTags || !todo.tags) {
      return [];
    }
    const sourceLine = todo.sourceLine;
    if (!sourceLine) return [...todo.tags];
    const parser = new LineParser(this.settings);
    const concreteTags = new Set(parser.concreteTags(sourceLine));
    return todo.tags.filter((tag) => concreteTags.has(tag));
  }

  formatTaskLine(text: string, attributes: Record<string, string | boolean>, tags: string[]): string {
    let line = `- [ ] ${text}`;

    // Add tags
    for (const tag of tags) {
      line += ` #${tag}`;
    }

    // Add Dataview attributes
    for (const [key, value] of Object.entries(attributes)) {
      line += ` [${key}:: ${value}]`;
    }

    return line;
  }

  private getIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  /**
   * Mark a task as complete by changing [ ] to [x] and adding completed date attribute
   */
  private markTaskComplete(line: string): string {
    const parser = new LineParser(this.settings);
    const parsed = parser.parseLine(line);
    if (parsed.checkbox === "[ ]") parsed.checkbox = "[x]";

    const completedAttr = this.settings.completedDateAttribute;
    const escapedAttr = completedAttr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!(completedAttr in parser.parseAttributes(parsed.line).attributes) && !new RegExp(`\\[${escapedAttr}::[^\\]]*\\]`).test(parsed.line)) {
      parsed.line = parser.updateAttribute(parsed.line, completedAttr, moment().format("YYYY-MM-DD"));
    }
    return parser.lineToString(parsed);
  }

  async insertAfterOriginal(todo: TaskItem<T>, taskLine: string, completeOriginal?: boolean): Promise<void> {
    if (todo.line === undefined) {
      throw new Error("Cannot insert follow-up: original task has no line number");
    }

    await new FileOperations(this.settings).processTask(todo, (lines, lineNumber, separators) => {
      if (completeOriginal) {
        lines[lineNumber] = this.markTaskComplete(lines[lineNumber]);
      }

      let insertLine = lineNumber + 1;
      const originalIndent = this.getIndentation(lines[lineNumber]);
      while (insertLine < lines.length) {
        const currentLine = lines[insertLine];
        if (currentLine.trim() === "") {
          let nextLine = insertLine + 1;
          while (nextLine < lines.length && lines[nextLine].trim() === "") nextLine++;
          if (nextLine < lines.length && this.getIndentation(lines[nextLine]) > originalIndent) {
            insertLine = nextLine;
            continue;
          }
          break;
        }
        if (this.getIndentation(currentLine) <= originalIndent) break;
        insertLine++;
      }

      lines.splice(insertLine, 0, " ".repeat(originalIndent) + taskLine);
      const eol = separators[lineNumber] ?? separators[lineNumber - 1] ?? "\n";
      if (insertLine === separators.length + 1) {
        separators[insertLine - 1] = eol;
      } else {
        separators.splice(insertLine, 0, eol);
      }
    });
  }
}
