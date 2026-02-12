import { TaskPlannerSettings } from "../../settings/types";
import { TaskItem } from "../../types/task";
import { moment } from "../../utils/moment";

export interface FollowUpOptions {
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
    const textWithoutPrefix = this.stripExistingPrefix(todo.text, prefix);

    if (!prefix) {
      return textWithoutPrefix;
    }
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

    if (dueDate) {
      attributes[this.settings.dueDateAttribute] = dueDate;
    }

    if (this.settings.followUp.copyPriority && todo.attributes?.["priority"]) {
      attributes["priority"] = todo.attributes["priority"];
    }

    return attributes;
  }

  private buildFollowUpTags(todo: TaskItem<T>): string[] {
    if (!this.settings.followUp.copyTags || !todo.tags) {
      return [];
    }
    return [...todo.tags];
  }

  formatTaskLine(text: string, attributes: Record<string, string | boolean>, tags: string[]): string {
    let line = `- [ ] ${text}`;

    for (const tag of tags) {
      line += ` #${tag}`;
    }

    for (const [key, value] of Object.entries(attributes)) {
      line += ` [${key}:: ${value}]`;
    }

    return line;
  }

  private getIndentation(line: string): number {
    return line.length - line.trimStart().length;
  }

  private markTaskComplete(line: string): string {
    let updatedLine = line.replace(/^(\s*-\s*)\[[ ]\]/, "$1[x]");

    const completedAttr = this.settings.completedDateAttribute;
    const completedDate = moment().format("YYYY-MM-DD");
    const attrPattern = new RegExp(`\\[${completedAttr}::[^\\]]*\\]`);

    if (!attrPattern.test(updatedLine)) {
      updatedLine = `${updatedLine} [${completedAttr}:: ${completedDate}]`;
    }

    return updatedLine;
  }

  async insertAfterOriginal(todo: TaskItem<T>, taskLine: string, completeOriginal?: boolean): Promise<void> {
    if (todo.line === undefined) {
      throw new Error("Cannot insert follow-up: original task has no line number");
    }

    const content = await todo.file.getContent();
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(eol);

    if (completeOriginal) {
      lines[todo.line] = this.markTaskComplete(lines[todo.line]);
    }

    let insertLine = todo.line + 1;
    const originalIndent = this.getIndentation(lines[todo.line]);

    while (insertLine < lines.length) {
      const currentLine = lines[insertLine];
      if (currentLine.trim() === "") break;
      const lineIndent = this.getIndentation(currentLine);
      if (lineIndent <= originalIndent) break;
      insertLine++;
    }

    const indentedTaskLine = " ".repeat(originalIndent) + taskLine;
    lines.splice(insertLine, 0, indentedTaskLine);

    await todo.file.setContent(lines.join(eol));
  }
}
