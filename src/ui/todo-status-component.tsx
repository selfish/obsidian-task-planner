import { App, Menu, TFile, setIcon } from "obsidian";

import * as React from "react";

import { FileOperations } from "../core/operations/file-operations";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { TodoItem, TodoStatus, getTodoId } from "../types/todo";

function getStatusIcon(status: TodoStatus): string {
  switch (status) {
    case TodoStatus.Complete:
      return "check-circle";
    case TodoStatus.AttentionRequired:
      return "alert-circle";
    case TodoStatus.Canceled:
      return "x-circle";
    case TodoStatus.Delegated:
      return "users";
    case TodoStatus.InProgress:
      return "clock";
    case TodoStatus.Todo:
      return "circle";
    default:
      return "circle";
  }
}

export interface TodoStatusComponentDeps {
  logger: Logger;
  app: App;
}

export interface TodoStatusComponentProps {
  todo: TodoItem<TFile>;
  deps: TodoStatusComponentDeps;
  settings: TaskPlannerSettings;
}

export function TodoStatusComponent({ todo, deps, settings }: TodoStatusComponentProps): React.ReactElement {
  const iconRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, getStatusIcon(todo.status));
    }
  }, [todo.status]);

  const addChangeStatusMenuItem = (menu: Menu, status: TodoStatus, label: string, icon: string) => {
    const fileOperations: FileOperations = new FileOperations(settings);
    menu.addItem((item) => {
      item.setTitle(label);
      item.setIcon(icon);
      item.onClick(() => {
        todo.status = status;
        void fileOperations.updateTodoStatus(todo, settings.completedDateAttribute);
      });
    });
  };

  const onauxclick = (evt: React.MouseEvent) => {
    if (evt.defaultPrevented) {
      return;
    }
    const menu = new Menu();
    addChangeStatusMenuItem(menu, TodoStatus.Todo, "Mark as todo", "circle");
    addChangeStatusMenuItem(menu, TodoStatus.Complete, "Mark as complete", "check-circle");
    addChangeStatusMenuItem(menu, TodoStatus.InProgress, "Mark as in progress", "clock");
    addChangeStatusMenuItem(menu, TodoStatus.AttentionRequired, "Mark as attention required", "alert-circle");
    addChangeStatusMenuItem(menu, TodoStatus.Delegated, "Mark as delegated", "users");
    addChangeStatusMenuItem(menu, TodoStatus.Canceled, "Mark as cancelled", "x-circle");
    menu.showAtMouseEvent(evt.nativeEvent);
    evt.preventDefault();
  };

  const toggleStatus = () => {
    const fileOperations: FileOperations = new FileOperations(settings);
    deps.logger.debug(`Changing status on ${getTodoId(todo)}`);
    const wasCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
    const newStatus = wasCompleted ? TodoStatus.Todo : TodoStatus.Complete;
    const updatedTodo = { ...todo, status: newStatus };
    void fileOperations.updateTodoStatus(updatedTodo, settings.completedDateAttribute);
  };

  const onclick = (evt: React.MouseEvent) => {
    if (evt.defaultPrevented) {
      return;
    }
    evt.preventDefault();
    evt.stopPropagation();
    toggleStatus();
  };

  const onKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      evt.stopPropagation();
      toggleStatus();
    }
  };

  const statusLabel =
    todo.status === TodoStatus.Complete ? "completed" : todo.status === TodoStatus.Canceled ? "canceled" : todo.status === TodoStatus.InProgress ? "in progress" : todo.status === TodoStatus.Delegated ? "delegated" : todo.status === TodoStatus.AttentionRequired ? "attention required" : "todo";

  return <div ref={iconRef} className="checkbox" onClick={onclick} onAuxClick={onauxclick} onKeyDown={onKeyDown} tabIndex={0} role="checkbox" aria-checked={todo.status === TodoStatus.Complete} aria-label={`Task status: ${statusLabel}. Press to toggle.`} />;
}
