import { FileAdapter } from "../../types/file-adapter";
import { TodoParsingResult } from "../../types/parsing";
import { TaskPlannerSettings } from "../../settings/types";
import { TodoItem } from "../../types/todo";
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

      while (parent() && current.indentLevel <= parent()!.indentLevel) {
        popParent();
      }

      const currentParent = parent();
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

  async parseMdFileAsync(file: FileAdapter<TFile>): Promise<TodoItem<TFile>[]> {
    const content = await file.getContentAsync();
    const lines = content.split("\n");
    const parsingResults = lines.map((line, number) => this.statusOperations.toTodo<TFile>(line, number));

    const todoParsingResults = parsingResults.filter((result) => result.isTodo);
    this.createTodoTreeStructure(lines, todoParsingResults);

    const todos: TodoItem<TFile>[] = [];
    for (const result of todoParsingResults) {
      if (result.todo) {
        result.todo.file = file;
        todos.push(result.todo);
      }
    }

    this.removeSubtasksFromTree(todos);
    return todos;
  }
}
