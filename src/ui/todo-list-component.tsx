import * as React from "react";
import { TodoItem, TodoStatus, getTodoId } from "../types/todo";
import { App, TFile } from "obsidian";
import { TodoItemComponent } from "./todo-item-component";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { Consts } from "../types/constants";
import { getFileDisplayName } from "../utils/file-utils";

function getPriorityValue(todo: TodoItem<TFile>): number {
  if (!todo.attributes || !todo.attributes["priority"]) {
    return 0;
  }
  const priority = todo.attributes["priority"] as string;
  const priorities: Record<string, number> = {
    critical: 10,
    high: 9,
    medium: 5,
    low: 3,
    lowest: -1,
  };
  return priorities[priority] || 0;
}

function getStatusValue(todo: TodoItem<TFile>): number {
  switch (todo.status) {
    case TodoStatus.Canceled:
      return 0;
    case TodoStatus.Complete:
      return 1;
    default:
      return 10;
  }
}

function sortTodos(todos: TodoItem<TFile>[]): TodoItem<TFile>[] {
  if (!todos) {
    return [];
  }
  return todos.sort((a, b) => {
    const statusDiff = getStatusValue(b) - getStatusValue(a);
    if (statusDiff) {
      return statusDiff;
    }
    const priorityDiff = getPriorityValue(b) - getPriorityValue(a);
    if (!priorityDiff) {
      return a.text.toLocaleLowerCase().localeCompare(b.text.toLocaleLowerCase());
    }
    return priorityDiff;
  });
}

function groupTodosByFile(todos: TodoItem<TFile>[]): Map<string, TodoItem<TFile>[]> {
  const groups = new Map<string, TodoItem<TFile>[]>();

  for (const todo of todos) {
    const fileName = todo.file.file.name;
    let fileTodos = groups.get(fileName);
    if (!fileTodos) {
      fileTodos = [];
      groups.set(fileName, fileTodos);
    }
    fileTodos.push(todo);
  }

  return groups;
}

export interface TodoListComponentDeps {
  logger: Logger;
  app: App;
  settings: TaskPlannerSettings;
}

export interface TodoListComponentProps {
  todos: TodoItem<TFile>[];
  deps: TodoListComponentDeps;
  dontCrossCompleted?: boolean;
}

export function TodoListComponent({ todos, deps, dontCrossCompleted }: TodoListComponentProps): React.ReactElement {
  const sortedTodos = React.useMemo(() => sortTodos(todos), [todos]);
  const groupedTodos = React.useMemo(() => groupTodosByFile(sortedTodos), [sortedTodos]);

  function onGroupDragStart(ev: React.DragEvent, fileTodos: TodoItem<TFile>[]): void {
    const visibleIncompleteTodos = fileTodos.filter((todo) => {
      if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) {
        return false;
      }
      return sortedTodos.includes(todo);
    });
    const todoIds = visibleIncompleteTodos.map((todo) => getTodoId(todo)).join(",");
    ev.dataTransfer.setData(Consts.TodoGroupDragType, todoIds);
  }

  return (
    <div>
      {Array.from(groupedTodos.entries()).map(([_fileName, fileTodos]) => {
        const displayName = getFileDisplayName(fileTodos[0].file.file, deps.app);
        const fileKey = fileTodos[0].file.file.path;
        return (
          <div key={fileKey} className="group">
            <div className="header" draggable="true" onDragStart={(ev) => onGroupDragStart(ev, fileTodos)}>
              {displayName}
            </div>
            {fileTodos.map((todo) => (
              <TodoItemComponent todo={todo} key={getTodoId(todo)} deps={deps} dontCrossCompleted={dontCrossCompleted} hideFileRef={true} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
