import { App, TFile } from "obsidian";

import * as React from "react";

import { useFileDisplayName } from "./hooks";
import { ColumnType } from "./planning-task-column";
import { TodoItemComponent } from "./task-item-component";
import { TaskPlannerSettings } from "../settings/types";
import { Consts } from "../types/constants";
import { Logger } from "../types/logger";
import { TaskItem, TaskStatus, getTaskId } from "../types/task";

const PRIORITY_VALUES: Record<string, number> = {
  critical: 10,
  high: 9,
  medium: 5,
  low: 3,
  lowest: -1,
};

function getPriorityValue(todo: TaskItem<TFile>): number {
  const priority = todo.attributes?.["priority"] as string | undefined;
  return priority ? PRIORITY_VALUES[priority] ?? 0 : 0;
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
  if (!todos) return [];
  return todos.sort((a, b) => {
    const statusDiff = getStatusValue(b) - getStatusValue(a);
    if (statusDiff) return statusDiff;
    const priorityDiff = getPriorityValue(b) - getPriorityValue(a);
    if (priorityDiff) return priorityDiff;
    return a.text.toLocaleLowerCase().localeCompare(b.text.toLocaleLowerCase());
  });
}

function groupTodosByFile(todos: TaskItem<TFile>[]): Map<string, TaskItem<TFile>[]> {
  const groups = new Map<string, TaskItem<TFile>[]>();
  for (const todo of todos) {
    const fileName = todo.file.file.name;
    const fileTodos = groups.get(fileName) ?? [];
    if (!groups.has(fileName)) groups.set(fileName, fileTodos);
    fileTodos.push(todo);
  }
  return groups;
}

interface GroupHeaderProps {
  file: TFile;
  app: App;
  onDragStart: (ev: React.DragEvent) => void;
}

function GroupHeader({ file, app, onDragStart }: GroupHeaderProps): React.ReactElement {
  const displayName = useFileDisplayName(file, app);

  function onKeyDown(evt: React.KeyboardEvent): void {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
    }
  }

  return (
    <div className="header" draggable="true" onDragStart={onDragStart} onKeyDown={onKeyDown} tabIndex={0} role="group" aria-label={`File group: ${displayName}. Drag to move all tasks from this file.`}>
      {displayName}
    </div>
  );
}

export interface TodoListComponentDeps {
  logger: Logger;
  app: App;
  settings: TaskPlannerSettings;
  columnType?: ColumnType;
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
      if (todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled) return false;
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
              <TodoItemComponent todo={todo} key={getTaskId(todo)} deps={deps} dontCrossCompleted={dontCrossCompleted} hideFileRef={true} columnType={deps.columnType} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
