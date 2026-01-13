import * as React from "react";
import { IDictionary } from "../domain/IDictionary";
import { TodoItem, TodoStatus, getTodoId } from "../domain/TodoItem";
import { App, TFile } from "obsidian";
import { TodoItemComponent } from "./TodoItemComponent";
import { TaskPlannerSettings } from "../domain/TaskPlannerSettings";
import { ILogger } from "../domain/ILogger";
import { TaskPlannerEvent } from "../events/TaskPlannerEvent";
import { Sound } from "./SoundPlayer";
import { Consts } from "../domain/Consts";

function getPriorityValue(todo: TodoItem<TFile>): number {
  if (!todo.attributes || !todo.attributes["priority"]) {
    return 0;
  }
  const priority = todo.attributes["priority"] as string;
  const priorities: IDictionary<number> = {
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

function cleanFileName(fileName: string): string {
  let name = fileName.replace(/\.md$/, "");
  const cleaned = name.replace(/^[\d- ]+/, "").trim();
  return cleaned || name;
}

function groupTodosByFile(todos: TodoItem<TFile>[]): Map<string, TodoItem<TFile>[]> {
  const groups = new Map<string, TodoItem<TFile>[]>();

  for (const todo of todos) {
    const fileName = todo.file.file.name;
    if (!groups.has(fileName)) {
      groups.set(fileName, []);
    }
    groups.get(fileName)!.push(todo);
  }

  return groups;
}

export interface TodoListComponentDeps {
  logger: ILogger;
  app: App;
  settings: TaskPlannerSettings;
}

export interface TodoListComponentProps {
  todos: TodoItem<TFile>[];
  deps: TodoListComponentDeps;
  playSound?: TaskPlannerEvent<Sound>;
  dontCrossCompleted?: boolean;
}

export function TodoListComponent({ todos, deps, playSound, dontCrossCompleted }: TodoListComponentProps): React.ReactElement {
  const sortedTodos = React.useMemo(() => sortTodos(todos), [todos]);
  const groupedTodos = React.useMemo(() => groupTodosByFile(sortedTodos), [sortedTodos]);

  function getDisplayName(file: TFile): string {
    const cache = deps.app.metadataCache.getFileCache(file);
    const frontmatterTitle = cache?.frontmatter?.title;

    if (frontmatterTitle && typeof frontmatterTitle === "string") {
      return frontmatterTitle;
    }

    return cleanFileName(file.name);
  }

  function onGroupDragStart(ev: React.DragEvent, fileTodos: TodoItem<TFile>[]): void {
    const visibleIncompleteTodos = fileTodos.filter(todo => {
      if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) {
        return false;
      }
      return sortedTodos.includes(todo);
    });
    const todoIds = visibleIncompleteTodos.map(todo => getTodoId(todo)).join(",");
    ev.dataTransfer.setData(Consts.TodoGroupDragType, todoIds);
  }

  return (
    <div>
      {Array.from(groupedTodos.entries()).map(([fileName, fileTodos]) => {
        const displayName = getDisplayName(fileTodos[0].file.file);
        const fileKey = fileTodos[0].file.file.path;
        return (
          <div key={fileKey} className="th-task-group">
            <div
              className="th-task-group-header"
              draggable="true"
              onDragStart={ev => onGroupDragStart(ev, fileTodos)}
            >
              {displayName}
            </div>
            {fileTodos.map(todo => (
              <TodoItemComponent
                todo={todo}
                key={getTodoId(todo)}
                deps={deps}
                playSound={playSound}
                dontCrossCompleted={dontCrossCompleted}
                hideFileRef={true}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
