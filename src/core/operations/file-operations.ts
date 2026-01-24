import { FileOperationError } from "../../lib/errors";
import { TaskPlannerSettings } from "../../settings";
import { FileAdapter, LineStructure, TodoItem, TodoStatus } from "../../types";
import { moment } from "../../utils";
import { LineParser } from "../parsers/line-parser";

function statusToCheckbox(status: TodoStatus): string {
  switch (status) {
    case TodoStatus.Todo:
      return "[ ]";
    case TodoStatus.Canceled:
      return "[-]";
    case TodoStatus.AttentionRequired:
      return "[!]";
    case TodoStatus.Complete:
      return "[x]";
    case TodoStatus.Delegated:
      return "[d]";
    case TodoStatus.InProgress:
      return "[>]";
    default:
      return "";
  }
}

function groupTodosByFile<T>(todos: TodoItem<T>[]): Map<FileAdapter<T>, TodoItem<T>[]> {
  const todosByFile = new Map<FileAdapter<T>, TodoItem<T>[]>();
  for (const todo of todos) {
    const file = todo.file;
    let fileTodos = todosByFile.get(file);
    if (!fileTodos) {
      fileTodos = [];
      todosByFile.set(file, fileTodos);
    }
    fileTodos.push(todo);
  }
  return todosByFile;
}

export class FileOperations {
  lineParser: LineParser;

  constructor(private settings?: TaskPlannerSettings) {
    this.lineParser = new LineParser(settings);
  }

  private getEOL(content: string): string {
    return content.includes("\r\n") ? "\r\n" : "\n";
  }

  async updateAttribute<T>(todo: TodoItem<T>, attributeName: string, attributeValue: string | boolean | undefined) {
    const updateLine = (line: LineStructure) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      if (attributeValue === false || attributeValue === undefined) {
        delete attributes.attributes[attributeName];
      } else {
        attributes.attributes[attributeName] = attributeValue;
      }
      line.line = this.lineParser.attributesToString(attributes);
    };
    await this.updateContentInFile(todo, updateLine);
  }

  async removeAttribute<T>(todo: TodoItem<T>, attributeName: string) {
    const updateLine = (line: LineStructure) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      delete attributes.attributes[attributeName];
      line.line = this.lineParser.attributesToString(attributes);
    };
    await this.updateContentInFile(todo, updateLine);
  }

  async appendTag<T>(todo: TodoItem<T>, tag: string) {
    if (todo.tags?.includes(tag)) return;

    const updateLine = (line: LineStructure) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      attributes.textWithoutAttributes = `${attributes.textWithoutAttributes} #${tag}`;
      line.line = this.lineParser.attributesToString(attributes);
    };
    await this.updateContentInFile(todo, updateLine);
  }

  async removeTag<T>(todo: TodoItem<T>, tag: string) {
    if (!todo.tags?.includes(tag)) return;

    const updateLine = (line: LineStructure) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      attributes.textWithoutAttributes = attributes.textWithoutAttributes.replace(new RegExp(`\\s*#${tag}\\b`, "g"), "").trim();
      line.line = this.lineParser.attributesToString(attributes);
    };
    await this.updateContentInFile(todo, updateLine);
  }

  private async updateCheckbox<T>(todo: TodoItem<T>, newCheckbox: string) {
    const updateLine = (line: LineStructure) => {
      line.checkbox = newCheckbox;
    };
    await this.updateContentInFile(todo, updateLine);
  }

  async updateTodoStatus<T>(todo: TodoItem<T>, completedAttribute: string): Promise<void> {
    const isCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
    const completedAttributeValue = isCompleted ? moment().format("YYYY-MM-DD") : undefined;

    // Combined update: checkbox + completed attribute in a single file write
    const updateLine = (line: LineStructure) => {
      line.checkbox = statusToCheckbox(todo.status);

      const attributes = this.lineParser.parseAttributes(line.line);
      if (completedAttributeValue === undefined) {
        delete attributes.attributes[completedAttribute];
      } else {
        attributes.attributes[completedAttribute] = completedAttributeValue;
      }
      line.line = this.lineParser.attributesToString(attributes);
    };
    await this.updateContentInFile(todo, updateLine);
  }

  private async updateContentInFile<T>(todo: TodoItem<T>, updateLine: (line: LineStructure) => void) {
    const file = todo.file;
    const lineNumber = todo.line;
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

  async batchUpdateAttribute<T>(todos: TodoItem<T>[], attributeName: string, attributeValue: string | boolean | undefined): Promise<void> {
    if (todos.length === 0) return;

    const todosByFile = groupTodosByFile(todos);
    for (const [, fileTodos] of todosByFile) {
      await this.batchUpdateFile(fileTodos, (line) => {
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

  async batchRemoveAttribute<T>(todos: TodoItem<T>[], attributeName: string): Promise<void> {
    if (todos.length === 0) return;

    const todosByFile = groupTodosByFile(todos);
    for (const [, fileTodos] of todosByFile) {
      await this.batchUpdateFile(fileTodos, (line) => {
        const attributes = this.lineParser.parseAttributes(line.line);
        delete attributes.attributes[attributeName];
        line.line = this.lineParser.attributesToString(attributes);
      });
    }
  }

  async batchAppendTag<T>(todos: TodoItem<T>[], tag: string): Promise<void> {
    const todosNeedingTag = todos.filter((t) => !t.tags?.includes(tag));
    if (todosNeedingTag.length === 0) return;

    const todosByFile = groupTodosByFile(todosNeedingTag);
    for (const [, fileTodos] of todosByFile) {
      await this.batchUpdateFile(fileTodos, (line) => {
        const attributes = this.lineParser.parseAttributes(line.line);
        attributes.textWithoutAttributes = `${attributes.textWithoutAttributes} #${tag}`;
        line.line = this.lineParser.attributesToString(attributes);
      });
    }
  }

  async batchRemoveTag<T>(todos: TodoItem<T>[], tag: string): Promise<void> {
    const todosWithTag = todos.filter((t) => t.tags?.includes(tag));
    if (todosWithTag.length === 0) return;

    const todosByFile = groupTodosByFile(todosWithTag);
    for (const [, fileTodos] of todosByFile) {
      await this.batchUpdateFile(fileTodos, (line) => {
        const attributes = this.lineParser.parseAttributes(line.line);
        attributes.textWithoutAttributes = attributes.textWithoutAttributes.replace(new RegExp(`\\s*#${tag}\\b`, "g"), "").trim();
        line.line = this.lineParser.attributesToString(attributes);
      });
    }
  }

  async batchUpdateTodoStatus<T>(todos: TodoItem<T>[], completedAttribute: string): Promise<void> {
    if (todos.length === 0) return;

    const todosByFile = groupTodosByFile(todos);
    for (const [, fileTodos] of todosByFile) {
      await this.batchUpdateFile(fileTodos, (line, todo) => {
        line.checkbox = statusToCheckbox(todo.status);

        const isCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
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

  private async batchUpdateFile<T>(todos: TodoItem<T>[], updateLine: (line: LineStructure, todo: TodoItem<T>) => void) {
    if (todos.length === 0) return;

    const file = todos[0].file;

    let content: string;
    try {
      content = await file.getContent();
    } catch (error) {
      throw new FileOperationError(`Failed to read file for batch update: ${file.path}`, file.path, "read", "HIGH", { originalError: error instanceof Error ? error.message : String(error), todoCount: todos.length });
    }

    const EOL = this.getEOL(content);
    const lines = content.split(EOL);

    for (const todo of todos) {
      const lineNumber = todo.line;
      if (lineNumber === undefined) {
        continue;
      }
      const line = this.lineParser.parseLine(lines[lineNumber]);
      updateLine(line, todo);
      lines[lineNumber] = this.lineParser.lineToString(line);
    }

    const res = lines.join(EOL);

    try {
      await file.setContent(res);
    } catch (error) {
      throw new FileOperationError(`Failed to write file during batch update: ${file.path}`, file.path, "write", "HIGH", { originalError: error instanceof Error ? error.message : String(error), todoCount: todos.length });
    }
  }
}
