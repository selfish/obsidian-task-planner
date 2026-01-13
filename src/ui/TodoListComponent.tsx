import * as React from "react";
import { IDictionary } from "../domain/IDictionary";
import { TodoItem, TodoStatus, getTodoId } from "../domain/TodoItem";
import { App, TFile } from "obsidian";
import { TodoItemComponent } from "./TodoItemComponent";
import { ProletarianWizardSettings } from "../domain/ProletarianWizardSettings";
import { ILogger } from "../domain/ILogger";
import { PwEvent } from "src/events/PwEvent";
import { Sound } from "./SoundPlayer";
import { Consts } from "../domain/Consts";

function getPriorityValue(todo: TodoItem<TFile>): number {
  if (!todo.attributes || !todo.attributes["priority"]) {
    return 0
  }
  const priority = todo.attributes["priority"] as string
  const priorities: IDictionary<number> = {
    critical: 10,
    high: 9,
    medium: 5,
    low: 3,
    lowest: -1,
  }
  return priorities[priority] || 0
};

function getStatusValue(todo: TodoItem<TFile>): number {
  switch (todo.status) {
    case TodoStatus.Canceled:
      return 0
    case TodoStatus.Complete:
      return 1
    default:
      return 10
  }
}

function sortTodos(todos: TodoItem<TFile>[]): TodoItem<TFile>[] {
  if (!todos) {
    return []
  }
  return todos.sort((a, b) => {
    const statusDiff = getStatusValue(b) - getStatusValue(a);
    if (statusDiff) {
      return statusDiff
    }
    const priorityDiff = getPriorityValue(b) - getPriorityValue(a);
    if (!priorityDiff) {
      return a.text.toLocaleLowerCase().localeCompare(b.text.toLocaleLowerCase())
    }
    return priorityDiff
  })
}

function cleanFileName(fileName: string): string {
  // Remove .md extension
  let name = fileName.replace(/\.md$/, '');

  // Remove leading numbers, symbols, and whitespace (e.g., "2024-01-12 Note" -> "Note")
  const cleaned = name.replace(/^[\d- ]+/, '').trim();

  // If we removed everything, return the original (without extension)
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
  logger: ILogger,
  app: App, 
  settings: ProletarianWizardSettings,
}

export interface TodoListComponentProps {
  todos: TodoItem<TFile>[], 
  deps: TodoListComponentDeps,
  playSound?: PwEvent<Sound>,
  dontCrossCompleted?: boolean,
}

export function TodoListComponent({todos, deps, playSound, dontCrossCompleted}: TodoListComponentProps) {
  const sortedTodos = React.useMemo(() => sortTodos(todos), [todos]);
  const groupedTodos = React.useMemo(() => groupTodosByFile(sortedTodos), [sortedTodos]);

  function getDisplayName(file: TFile): string {
    // Try to get title from frontmatter
    const cache = deps.app.metadataCache.getFileCache(file);
    const frontmatterTitle = cache?.frontmatter?.title;

    if (frontmatterTitle && typeof frontmatterTitle === 'string') {
      return frontmatterTitle;
    }

    // Fall back to cleaned filename
    return cleanFileName(file.name);
  }

  function onGroupDragStart(ev: React.DragEvent, fileTodos: TodoItem<TFile>[]) {
    // Collect all incomplete AND VISIBLE task IDs from this group
    const visibleIncompleteTodos = fileTodos.filter(todo => {
      // Must be incomplete
      if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) {
        return false;
      }
      // Must be in the current filtered list (sortedTodos contains only filtered items)
      return sortedTodos.includes(todo);
    });
    const todoIds = visibleIncompleteTodos.map(todo => getTodoId(todo)).join(',');
    ev.dataTransfer.setData(Consts.TodoGroupDragType, todoIds);
  }

  return <div>
    {Array.from(groupedTodos.entries()).map(([fileName, fileTodos]) => {
      const displayName = getDisplayName(fileTodos[0].file.file);
      // Use file path as key for better stability
      const fileKey = fileTodos[0].file.file.path;
      return (
        <div key={fileKey} className="th-task-group">
          <div
            className="th-task-group-header"
            draggable="true"
            onDragStart={(ev) => onGroupDragStart(ev, fileTodos)}
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
  </div>;
}
