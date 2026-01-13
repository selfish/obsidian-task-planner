import * as React from "react";
import { TodoItem, TodoStatus, getTodoId } from "../domain/TodoItem";
import { App, Menu, TFile, setIcon } from "obsidian";
import { FileOperations } from "../domain/FileOperations";
import { ILogger } from "../domain/ILogger";
import { TaskPlannerSettings } from "../domain/TaskPlannerSettings";
import { Sound } from "./SoundPlayer";
import { TaskPlannerEvent } from "../events/TaskPlannerEvent";

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
  logger: ILogger;
  app: App;
}

export interface TodoStatusComponentProps {
  todo: TodoItem<TFile>;
  deps: TodoStatusComponentDeps;
  settings: TaskPlannerSettings;
  playSound?: TaskPlannerEvent<Sound>;
}

export function TodoStatusComponent({todo, deps, settings, playSound}: TodoStatusComponentProps): React.ReactElement {
  const iconRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.innerHTML = '';
      setIcon(iconRef.current, getStatusIcon(todo.status));
    }
  }, [todo.status]);

  const addChangeStatusMenuItem = (menu: Menu, status: TodoStatus, label: string, icon: string) => {
    const fileOperations: FileOperations = new FileOperations(settings)
		menu.addItem((item) => {
      item.setTitle(label)
      item.setIcon(icon)
      item.onClick(() => {
        todo.status = status
				fileOperations.updateTodoStatus(todo, settings.completedDateAttribute)
      })
    })
  }

  const onauxclick = (evt: any) => {
    if (evt.defaultPrevented) {
      return
    }
    const menu = new Menu()
    addChangeStatusMenuItem(menu, TodoStatus.Todo, "Mark as todo", "circle")
    addChangeStatusMenuItem(menu, TodoStatus.Complete, "Mark as complete", "check-circle")
    addChangeStatusMenuItem(menu, TodoStatus.InProgress, "Mark as in progress", "clock")
    addChangeStatusMenuItem(menu, TodoStatus.AttentionRequired, "Mark as attention required", "alert-circle")
    addChangeStatusMenuItem(menu, TodoStatus.Delegated, "Mark as delegated", "users")
    addChangeStatusMenuItem(menu, TodoStatus.Canceled, "Mark as cancelled", "x-circle")
    menu.showAtMouseEvent(evt)
    evt.preventDefault();
  }

  const onclick = (evt: any) => {
		const fileOperations: FileOperations = new FileOperations(settings)
    if (evt.defaultPrevented) {
      return
    }
    deps.logger.debug(`Changing status on ${getTodoId(todo)}`);
    evt.preventDefault();
    const wasCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled
    if (!wasCompleted && playSound) {
      playSound.fireAsync("checked").then()
    }
		todo.status = wasCompleted ? TodoStatus.Todo : TodoStatus.Complete
		fileOperations.updateTodoStatus(todo, settings.completedDateAttribute)
  }

  return <div ref={iconRef} className="th-task-checkbox" onClick={onclick} onAuxClick={onauxclick}></div>;
}
