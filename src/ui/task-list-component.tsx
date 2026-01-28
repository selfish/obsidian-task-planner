import { App, TFile } from "obsidian";

import * as React from "react";

import { TodoItemComponent } from "./task-item-component";
import { TaskPlannerSettings } from "../settings/types";
import { Consts } from "../types/constants";
import { Logger } from "../types/logger";
import { TaskItem, TaskStatus, getTaskId } from "../types/task";
import { getFileDisplayName } from "../utils/file-utils";

// Hook to get file display name with metadata cache updates
function useFileDisplayName(file: TFile, app: App): string {
  const [displayName, setDisplayName] = React.useState(() => getFileDisplayName(file, app));

  React.useEffect(() => {
    setDisplayName(getFileDisplayName(file, app));

    const onCacheChanged = (changedFile: TFile) => {
      if (changedFile.path === file.path) {
        setDisplayName(getFileDisplayName(file, app));
      }
    };

    const ref = app.metadataCache.on("changed", onCacheChanged as () => void);
    return () => {
      app.metadataCache.offref(ref);
    };
  }, [file, app]);

  return displayName;
}

// Component for group header that properly handles metadata cache
function GroupHeader({ file, app, onDragStart }: { file: TFile; app: App; onDragStart: (ev: React.DragEvent) => void }) {
  const displayName = useFileDisplayName(file, app);

  const onKeyDown = (evt: React.KeyboardEvent) => {
    // Allow Enter or Space to initiate drag (or other future actions)
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      // Group headers are primarily for drag - keyboard users can drag individual tasks
    }
  };

  return (
    <div className="header" draggable="true" onDragStart={onDragStart} onKeyDown={onKeyDown} tabIndex={0} role="group" aria-label={`File group: ${displayName}. Drag to move all tasks from this file.`}>
      {displayName}
    </div>
  );
}

function getPriorityValue(todo: TaskItem<TFile>): number {
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

function getStatusValue(todo: TaskItem<TFile>): number {
  switch (todo.status) {
    case TaskStatus.Canceled:
      return 0;
    case TaskStatus.Complete:
      return 1;
    default:
      return 10;
  }
}

function sortTodos(todos: TaskItem<TFile>[]): TaskItem<TFile>[] {
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

function groupTodosByFile(todos: TaskItem<TFile>[]): Map<string, TaskItem<TFile>[]> {
  const groups = new Map<string, TaskItem<TFile>[]>();

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
  todos: TaskItem<TFile>[];
  deps: TodoListComponentDeps;
  dontCrossCompleted?: boolean;
}

export function TaskListComponent({ todos, deps, dontCrossCompleted }: TodoListComponentProps): React.ReactElement {
  const sortedTodos = React.useMemo(() => sortTodos(todos), [todos]);
  const groupedTodos = React.useMemo(() => groupTodosByFile(sortedTodos), [sortedTodos]);

  function onGroupDragStart(ev: React.DragEvent, fileTodos: TaskItem<TFile>[]): void {
    const sortedTodoIds = new Set(sortedTodos.map(getTaskId));
    const visibleIncompleteTodos = fileTodos.filter((todo) => {
      if (todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled) {
        return false;
      }
      return sortedTodoIds.has(getTaskId(todo));
    });
    const todoIds = visibleIncompleteTodos.map((todo) => getTaskId(todo)).join(Consts.TaskIdDelimiter);
    ev.dataTransfer.setData(Consts.TaskGroupDragType, todoIds);
  }

  return (
    <div>
      {Array.from(groupedTodos.entries()).map(([_fileName, fileTodos]) => {
        const fileKey = fileTodos[0].file.file.path;
        return (
          <div key={fileKey} className="group">
            <GroupHeader file={fileTodos[0].file.file} app={deps.app} onDragStart={(ev) => onGroupDragStart(ev, fileTodos)} />
            {fileTodos.map((todo) => (
              <TodoItemComponent todo={todo} key={getTaskId(todo)} deps={deps} dontCrossCompleted={dontCrossCompleted} hideFileRef={true} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
