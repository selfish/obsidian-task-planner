import { App, Menu, TFile, setIcon } from "obsidian";

import * as React from "react";

import { FileOperations } from "../core/operations/file-operations";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { TaskItem, TaskStatus, getTaskId } from "../types/task";

function getStatusIcon(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.Complete:
      return "check-circle";
    case TaskStatus.AttentionRequired:
      return "alert-circle";
    case TaskStatus.Canceled:
      return "x-circle";
    case TaskStatus.Delegated:
      return "users";
    case TaskStatus.InProgress:
      return "clock";
    case TaskStatus.Todo:
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
  todo: TaskItem<TFile>;
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

  const addChangeStatusMenuItem = (menu: Menu, status: TaskStatus, label: string, icon: string) => {
    const fileOperations: FileOperations = new FileOperations(settings);
    menu.addItem((item) => {
      item.setTitle(label);
      item.setIcon(icon);
      item.onClick(() => {
        todo.status = status;
        void fileOperations.updateTaskStatus(todo, settings.completedDateAttribute);
      });
    });
  };

  const onauxclick = (evt: React.MouseEvent) => {
    if (evt.defaultPrevented) {
      return;
    }
    const menu = new Menu();
    addChangeStatusMenuItem(menu, TaskStatus.Todo, "Mark as todo", "circle");
    addChangeStatusMenuItem(menu, TaskStatus.Complete, "Mark as complete", "check-circle");
    addChangeStatusMenuItem(menu, TaskStatus.InProgress, "Mark as in progress", "clock");
    addChangeStatusMenuItem(menu, TaskStatus.AttentionRequired, "Mark as attention required", "alert-circle");
    addChangeStatusMenuItem(menu, TaskStatus.Delegated, "Mark as delegated", "users");
    addChangeStatusMenuItem(menu, TaskStatus.Canceled, "Mark as cancelled", "x-circle");
    menu.showAtMouseEvent(evt.nativeEvent);
    evt.preventDefault();
  };

  const toggleStatus = () => {
    const fileOperations: FileOperations = new FileOperations(settings);
    deps.logger.debug(`Changing status on ${getTaskId(todo)}`);
    const wasCompleted = todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled;
    const newStatus = wasCompleted ? TaskStatus.Todo : TaskStatus.Complete;
    const updatedTodo = { ...todo, status: newStatus };
    void fileOperations.updateTaskStatus(updatedTodo, settings.completedDateAttribute);
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
    todo.status === TaskStatus.Complete ? "completed" : todo.status === TaskStatus.Canceled ? "canceled" : todo.status === TaskStatus.InProgress ? "in progress" : todo.status === TaskStatus.Delegated ? "delegated" : todo.status === TaskStatus.AttentionRequired ? "attention required" : "todo";

  return <div ref={iconRef} className="checkbox" onClick={onclick} onAuxClick={onauxclick} onKeyDown={onKeyDown} tabIndex={0} role="checkbox" aria-checked={todo.status === TaskStatus.Complete} aria-label={`Task status: ${statusLabel}. Press to toggle.`} />;
}
