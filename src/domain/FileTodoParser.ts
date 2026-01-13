import { IFile } from "./IFile";
import { ITodoParsingResult, LineOperations } from "./LineOperations";
import { TaskPlannerSettings } from "./TaskPlannerSettings";
import { TodoItem } from "./TodoItem";

export class FileTodoParser<TFile> {
  private lineOperations: LineOperations;

  constructor(settings: TaskPlannerSettings) {
    this.lineOperations = new LineOperations(settings);
  }

  private createTodoTreeStructure(
    lines: string[],
    parsingResults: ITodoParsingResult<TFile>[]
  ): void {
    const parentStack: ITodoParsingResult<TFile>[] = [];
    const parent = (): ITodoParsingResult<TFile> | undefined => parentStack[parentStack.length - 1];
    const pushParent = (p: ITodoParsingResult<TFile>): void => {
      parentStack.push(p);
    };
    const popParent = (): void => {
      parentStack.pop();
    };

    parsingResults.forEach(current => {
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
      const idx = todos.findIndex(t => t === subtask);
      if (idx >= 0) {
        todos.splice(idx, 1);
      }
    }
  }

  async parseMdFileAsync(file: IFile<TFile>): Promise<TodoItem<TFile>[]> {
    const content = await file.getContentAsync();
    const lines = content.split("\n");
    const parsingResults = lines.map((line, number) =>
      this.lineOperations.toTodo<TFile>(line, number)
    );

    const todoParsingResults = parsingResults.filter(result => result.isTodo);
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
