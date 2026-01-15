import { moment } from "../../utils/moment";
import { LineStructure } from "../../types/parsing";
import { LineParser } from "../parsers/line-parser";
import { TaskPlannerSettings } from "../../settings/types";
import { TodoItem, TodoStatus } from "../../types/todo";
import { FileAdapter } from "../../types/file-adapter";

export class FileOperations {
  lineParser: LineParser;

  constructor(private settings?: TaskPlannerSettings) {
    this.lineParser = new LineParser(settings);
  }

  private getEOL(content: string): string {
    if (content.indexOf("\r\n") >= 0) {
      return "\r\n";
    }
    return "\n";
  }

  async updateAttributeAsync<T>(todo: TodoItem<T>, attributeName: string, attributeValue: string | boolean | undefined) {
    const updateLine = (line: LineStructure) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      if (attributeValue === false || attributeValue === undefined) {
        delete attributes.attributes[attributeName];
      } else {
        attributes.attributes[attributeName] = attributeValue;
      }
      line.line = this.lineParser.attributesToString(attributes);
    };
    await this.updateContentInFileAsync(todo, updateLine);
  }

  async removeAttributeAsync<T>(todo: TodoItem<T>, attributeName: string) {
    const updateLine = (line: LineStructure) => {
      const attributes = this.lineParser.parseAttributes(line.line);
      delete attributes.attributes[attributeName];
      line.line = this.lineParser.attributesToString(attributes);
    };
    await this.updateContentInFileAsync(todo, updateLine);
  }

  private async updateCheckboxAsync<T>(todo: TodoItem<T>, newCheckbox: string) {
    const updateLine = (line: LineStructure) => {
      line.checkbox = newCheckbox;
    };
    await this.updateContentInFileAsync(todo, updateLine);
  }

  async updateTodoStatus<T>(todo: TodoItem<T>, completedAttribute: string) {
    const isCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
    let newCheckBox;
    switch (todo.status) {
      case TodoStatus.Todo:
        newCheckBox = "[ ]";
        break;
      case TodoStatus.Canceled:
        newCheckBox = "[-]";
        break;
      case TodoStatus.AttentionRequired:
        newCheckBox = "[!]";
        break;
      case TodoStatus.Complete:
        newCheckBox = "[x]";
        break;
      case TodoStatus.Delegated:
        newCheckBox = "[d]";
        break;
      case TodoStatus.InProgress:
        newCheckBox = "[>]";
        break;
      default:
        newCheckBox = "";
    }
    await this.updateCheckboxAsync(todo, newCheckBox);
    const completedAttributeValue = isCompleted ? moment().format("YYYY-MM-DD") : undefined;
    await this.updateAttributeAsync(todo, completedAttribute, completedAttributeValue);
  }

  private async updateContentInFileAsync<T>(todo: TodoItem<T>, updateLine: (line: LineStructure) => void) {
    const file = todo.file;
    const lineNumber = todo.line;
    if (lineNumber === undefined) {
      console.error(`Todo '${todo.text}' is missing line (${lineNumber})`);
      return;
    }
    const content = await file.getContentAsync();
    const EOL = this.getEOL(content);
    const lines = content.split(EOL);
    const line = this.lineParser.parseLine(lines[lineNumber]);
    updateLine(line);
    lines[lineNumber] = this.lineParser.lineToString(line);
    const res = lines.join(EOL);
    await file.setContentAsync(res);
  }

  async batchUpdateAttributeAsync<T>(todos: TodoItem<T>[], attributeName: string, attributeValue: string | boolean | undefined) {
    if (todos.length === 0) return;

    // Group todos by file
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

    // Update each file once with all changes
    for (const [_file, fileTodos] of todosByFile) {
      await this.batchUpdateFileAsync(fileTodos, (line) => {
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

  async batchRemoveAttributeAsync<T>(todos: TodoItem<T>[], attributeName: string) {
    if (todos.length === 0) return;

    // Group todos by file
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

    // Update each file once with all changes
    for (const [_file, fileTodos] of todosByFile) {
      await this.batchUpdateFileAsync(fileTodos, (line) => {
        const attributes = this.lineParser.parseAttributes(line.line);
        delete attributes.attributes[attributeName];
        line.line = this.lineParser.attributesToString(attributes);
      });
    }
  }

  async batchUpdateTodoStatusAsync<T>(todos: TodoItem<T>[], completedAttribute: string) {
    if (todos.length === 0) return;

    // Group todos by file
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

    // Update each file once with all changes
    for (const [_file, fileTodos] of todosByFile) {
      await this.batchUpdateFileAsync(fileTodos, (line, todo) => {
        // Update checkbox
        let newCheckBox;
        switch (todo.status) {
          case TodoStatus.Todo:
            newCheckBox = "[ ]";
            break;
          case TodoStatus.Canceled:
            newCheckBox = "[-]";
            break;
          case TodoStatus.AttentionRequired:
            newCheckBox = "[!]";
            break;
          case TodoStatus.Complete:
            newCheckBox = "[x]";
            break;
          case TodoStatus.Delegated:
            newCheckBox = "[d]";
            break;
          case TodoStatus.InProgress:
            newCheckBox = "[>]";
            break;
          default:
            newCheckBox = "";
        }
        line.checkbox = newCheckBox;

        // Update completed attribute
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

  private async batchUpdateFileAsync<T>(todos: TodoItem<T>[], updateLine: (line: LineStructure, todo: TodoItem<T>) => void) {
    if (todos.length === 0) return;

    const file = todos[0].file;
    const content = await file.getContentAsync();
    const EOL = this.getEOL(content);
    const lines = content.split(EOL);

    // Update all lines in this file
    for (const todo of todos) {
      const lineNumber = todo.line;
      if (lineNumber === undefined) {
        console.error(`Todo '${todo.text}' is missing line (${lineNumber})`);
        continue;
      }
      const line = this.lineParser.parseLine(lines[lineNumber]);
      updateLine(line, todo);
      lines[lineNumber] = this.lineParser.lineToString(line);
    }

    // Write a file once with all changes
    const res = lines.join(EOL);
    await file.setContentAsync(res);
  }
}
