import { ParseError } from "../../lib/errors";
import { TaskPlannerSettings } from "../../settings";
import { FileAdapter, TodoItem, TodoParsingResult } from "../../types";
import { StatusOperations } from "../operations/status-operations";

export class FileTodoParser<TFile> {
  private statusOperations: StatusOperations;

  constructor(settings: TaskPlannerSettings) {
    this.statusOperations = new StatusOperations(settings);
  }

  private createTodoTreeStructure(lines: string[], parsingResults: TodoParsingResult<TFile>[]): void {
    const parentStack: TodoParsingResult<TFile>[] = [];
    const parent = (): TodoParsingResult<TFile> | undefined => parentStack[parentStack.length - 1];
    const pushParent = (p: TodoParsingResult<TFile>): void => {
      parentStack.push(p);
    };
    const popParent = (): void => {
      parentStack.pop();
    };

    parsingResults.forEach((current) => {
      if (lines[current.lineNumber]?.match(/^\s*$/)) {
        return;
      }

      let currentParent = parent();
      while (currentParent && current.indentLevel <= currentParent.indentLevel) {
        popParent();
        currentParent = parent();
      }

      if (currentParent?.todo && current.isTodo && current.todo) {
        if (!currentParent.todo.subtasks) {
          currentParent.todo.subtasks = [];
        }
        currentParent.todo.subtasks.push(current.todo);
      }

      if (current.isTodo) {
        pushParent(current);
      }
    });
  }

  private setFileOnSubtasks(todo: TodoItem<TFile>, file: FileAdapter<TFile>): void {
    if (todo.subtasks) {
      for (const subtask of todo.subtasks) {
        subtask.file = file;
        this.setFileOnSubtasks(subtask, file);
      }
    }
  }

  private removeSubtasksFromTree(todos: TodoItem<TFile>[]): void {
    const toRemove: TodoItem<TFile>[] = [];
    for (const todo of todos) {
      if (todo.subtasks) {
        toRemove.push(...todo.subtasks);
      }
    }
    for (const subtask of toRemove) {
      const idx = todos.findIndex((t) => t === subtask);
      if (idx >= 0) {
        todos.splice(idx, 1);
      }
    }
  }

  private isCodeBlockFence(line: string): boolean {
    return /^\s*```/.test(line);
  }

  async parseMdFile(file: FileAdapter<TFile>): Promise<TodoItem<TFile>[]> {
    let content: string;
    try {
      content = await file.getContent();
    } catch (error) {
      throw new ParseError(`Failed to read file content: ${file.path}`, file.path, undefined, "MEDIUM", { originalError: error instanceof Error ? error.message : String(error) });
    }

    const lines = content.split("\n");

    // Track code block state to skip tasks inside fenced code blocks
    let insideCodeBlock = false;

    const parsingResults = lines.map((line, number) => {
      // Check for code block fence (``` with optional language specifier)
      if (this.isCodeBlockFence(line)) {
        insideCodeBlock = !insideCodeBlock;
      }

      // Skip parsing tasks inside code blocks
      if (insideCodeBlock && !this.isCodeBlockFence(line)) {
        return {
          lineNumber: number,
          isTodo: false,
          indentLevel: 0,
        };
      }

      return this.statusOperations.toTodo<TFile>(line, number);
    });

    const todoParsingResults = parsingResults.filter((result) => result.isTodo);
    this.createTodoTreeStructure(lines, todoParsingResults);

    const todos: TodoItem<TFile>[] = [];
    for (const result of todoParsingResults) {
      if (result.todo) {
        result.todo.file = file;
        // Also set file on subtasks recursively
        this.setFileOnSubtasks(result.todo, file);
        todos.push(result.todo);
      }
    }

    this.removeSubtasksFromTree(todos);
    return todos;
  }
}
