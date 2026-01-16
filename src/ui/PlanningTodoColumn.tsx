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

export function PlanningTodoColumn({ icon, title, hideIfEmpty, onTodoDropped, onBatchTodoDropped, todos, deps, substyle }: PlanningTodoColumnProps): React.ReactElement | null {
  const [isHovering, setIsHovering] = React.useState(false);
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
    setIsHovering(true);
  }

  function onDragLeave(ev: React.DragEvent): void {
    if (ev.currentTarget.contains(ev.relatedTarget as Node)) {
      return;
    }
    setIsHovering(false);
  }

  function onDrop(ev: React.DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    setIsHovering(false);

    const groupIds = ev.dataTransfer.getData(Consts.TodoGroupDragType);
    if (groupIds) {
      const todoIds = groupIds.split(",");

      if (onBatchTodoDropped) {
        void onBatchTodoDropped(todoIds);
      } else if (onTodoDropped) {
        todoIds.forEach((todoId, index) => {
          setTimeout(() => {
            onTodoDropped(todoId);
          }, index * 30);
        });
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

  // Build column classes
  const isToday = substyle?.includes("today");
  const columnClasses = ["column", isToday && "today", todos.length === 0 && !isToday && "empty"].filter(Boolean).join(" ");

  // Build content classes from substyle
  const contentModifiers: string[] = [];
  if (substyle) {
    if (substyle.includes("today")) contentModifiers.push("today");
    if (substyle.includes("cols-3") || substyle.includes("today-3-cols")) contentModifiers.push("cols-3");
    if (substyle.includes("cols-2") || substyle.includes("today-2-cols")) contentModifiers.push("cols-2");
    if (substyle.includes("overdue")) contentModifiers.push("overdue");
    if (substyle.includes("backlog")) contentModifiers.push("backlog");
    if (substyle.includes("done") || substyle.includes("today-done")) contentModifiers.push("done");
    if (substyle.includes("wip-exceeded")) contentModifiers.push("wip-exceeded");
  }
  if (isHovering) contentModifiers.push("hover");

  const contentClasses = ["content", ...contentModifiers].join(" ");

  return (
    <div className={columnClasses}>
      <div className="header">
        <span ref={iconRef} className="icon"></span>
        <span className="title">{title}</span>
      </div>
      <div className={contentClasses} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDrop}>
        <TodoListComponent deps={deps} todos={todos} />
      </div>
    </div>
  );
}
