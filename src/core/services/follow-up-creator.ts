import { TaskPlannerSettings } from "../../settings/types";
import { TodoItem } from "../../types/todo";

export class FollowUpCreator<T> {
  constructor(private settings: TaskPlannerSettings) {}

  async createFollowUp(todo: TodoItem<T>, dueDate: string | null): Promise<void> {
    const text = this.buildFollowUpText(todo);
    const attributes = this.buildFollowUpAttributes(todo, dueDate);
    const tags = this.buildFollowUpTags(todo);
    const taskLine = this.formatTaskLine(text, attributes, tags);

    await this.insertAfterOriginal(todo, taskLine);
  }

  private buildFollowUpText(todo: TodoItem<T>): string {
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

  private buildFollowUpAttributes(todo: TodoItem<T>, dueDate: string | null): Record<string, string | boolean> {
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

  private buildFollowUpTags(todo: TodoItem<T>): string[] {
    if (!this.settings.followUp.copyTags || !todo.tags) {
      return [];
    }
    return [...todo.tags];
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

  async insertAfterOriginal(todo: TodoItem<T>, taskLine: string): Promise<void> {
    if (todo.line === undefined) {
      throw new Error("Cannot insert follow-up: original task has no line number");
    }

    const content = await todo.file.getContent();
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(eol);

    // Find insertion point (after original task, accounting for subtasks)
    let insertLine = todo.line + 1;
    const originalIndent = this.getIndentation(lines[todo.line]);

    // Skip past any subtasks (lines with greater indentation)
    while (insertLine < lines.length) {
      const currentLine = lines[insertLine];
      // Stop at empty lines or lines with same/less indentation
      if (currentLine.trim() === "") break;
      const lineIndent = this.getIndentation(currentLine);
      if (lineIndent <= originalIndent) break;
      insertLine++;
    }

    // Insert the follow-up task with same indentation as original
    const indentedTaskLine = " ".repeat(originalIndent) + taskLine;
    lines.splice(insertLine, 0, indentedTaskLine);

    await todo.file.setContent(lines.join(eol));
  }
}
