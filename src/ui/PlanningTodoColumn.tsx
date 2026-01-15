import { App, TFile, setIcon } from "obsidian";
import * as React from "react";
import { Consts } from "../types/constants";
import { TodoItem } from "../types/todo";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { TodoListComponent } from "./TodoListComponent";

export interface PlanningTodoColumnDeps {
  app: App;
  settings: TaskPlannerSettings;
  logger: Logger;
}

export interface PlanningTodoColumnProps {
  icon: string;
  title: string;
  todos: TodoItem<TFile>[];
  onTodoDropped: ((todoId: string) => void) | null;
  onBatchTodoDropped?: ((todoIds: string[]) => Promise<void>) | null;
  hideIfEmpty: boolean;
  deps: PlanningTodoColumnDeps;
  substyle?: string;
}

const CLASSNAME_NORMAL = "";
const CLASSNAME_HOVER = "th-column-content--hover";

export function PlanningTodoColumn({ icon, title, hideIfEmpty, onTodoDropped, onBatchTodoDropped, todos, deps, substyle }: PlanningTodoColumnProps): React.ReactElement | null {
  const [hoverClassName, setHoverClassName] = React.useState(CLASSNAME_NORMAL);
  const iconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (iconRef.current && icon) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, icon);
    }
  }, [icon]);

  function onDragOver(ev: React.DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
  }

  function onDragEnter(ev: React.DragEvent): void {
    ev.stopPropagation();
    setHoverClassName(CLASSNAME_HOVER);
  }

  function onDragLeave(ev: React.DragEvent): void {
    if (ev.currentTarget.contains(ev.relatedTarget as Node)) {
      return;
    }
    setHoverClassName(CLASSNAME_NORMAL);
  }

  async function onDrop(ev: React.DragEvent): Promise<void> {
    ev.preventDefault();
    ev.stopPropagation();
    setHoverClassName(CLASSNAME_NORMAL);

    const groupIds = ev.dataTransfer.getData(Consts.TodoGroupDragType);
    if (groupIds) {
      const todoIds = groupIds.split(",");

      if (onBatchTodoDropped) {
        await onBatchTodoDropped(todoIds);
      } else if (onTodoDropped) {
        const promises = todoIds.map(
          (todoId, index) =>
            new Promise((resolve) => {
              setTimeout(() => {
                onTodoDropped(todoId);
                resolve(undefined);
              }, index * 30);
            })
        );
        await Promise.all(promises);
      }
      return;
    }

    const todoId = ev.dataTransfer.getData(Consts.TodoItemDragType);
    if (todoId && onTodoDropped) {
      onTodoDropped(todoId);
    }
  }

  if (hideIfEmpty && todos.length === 0) {
    return null;
  }

  const isEmpty = todos.length === 0;
  const isToday = substyle && substyle.includes("today");
  const emptyClass = isEmpty && !isToday ? "th-column--empty" : "";

  return (
    <div className={`th-column ${substyle ? `th-column--${substyle}` : ""} ${emptyClass}`.trim()}>
      <div className="th-column-header">
        <span ref={iconRef} className="th-column-icon"></span>
        <span className="th-column-title">{title}</span>
      </div>
      <div className={`th-column-content ${substyle ? `th-column-content--${substyle}` : ""} ${hoverClassName}`} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDrop}>
        <TodoListComponent deps={deps} todos={todos} />
      </div>
    </div>
  );
}
