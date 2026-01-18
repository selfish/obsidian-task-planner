import { App, TFile, setIcon } from "obsidian";

import * as React from "react";

import { TodoListComponent } from "./todo-list-component";
import { TaskPlannerSettings, HorizonColor } from "../settings/types";
import { Consts } from "../types/constants";
import { Logger } from "../types/logger";
import { TodoItem } from "../types/todo";

const HORIZON_COLOR_CSS_VAR: Record<HorizonColor, string> = {
  red: "var(--color-red)",
  orange: "var(--color-orange)",
  yellow: "var(--color-yellow)",
  green: "var(--color-green)",
  cyan: "var(--color-cyan)",
  blue: "var(--color-blue)",
  purple: "var(--color-purple)",
  pink: "var(--color-pink)",
  accent: "var(--text-accent)",
  success: "var(--text-success)",
  warning: "var(--text-warning)",
  error: "var(--text-error)",
};

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
  customColor?: HorizonColor;
}

export function PlanningTodoColumn({ icon, title, hideIfEmpty, onTodoDropped, onBatchTodoDropped, todos, deps, substyle, customColor }: PlanningTodoColumnProps): React.ReactElement | null {
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

  // "today-horizon" is in the future section, not a true today column
  const isToday = substyle?.includes("today") && !substyle?.includes("today-horizon");
  const columnClasses = ["column", isToday && "today", todos.length === 0 && !isToday && "empty"].filter(Boolean).join(" ");

  const contentModifiers: string[] = [];
  if (substyle) {
    if (substyle.includes("today") && !substyle.includes("today-horizon")) contentModifiers.push("today");
    if (substyle.includes("cols-3") || substyle.includes("today-3-cols")) contentModifiers.push("cols-3");
    if (substyle.includes("cols-2") || substyle.includes("today-2-cols")) contentModifiers.push("cols-2");
    if (substyle.includes("overdue")) contentModifiers.push("overdue");
    if (substyle.includes("backlog")) contentModifiers.push("backlog");
    if (substyle.includes("done") || substyle.includes("today-done")) contentModifiers.push("done");
    if (substyle.includes("wip-exceeded")) contentModifiers.push("wip-exceeded");
    if (substyle.includes("today-horizon")) contentModifiers.push("today-horizon");
  }
  if (customColor) contentModifiers.push("custom-horizon");
  if (isHovering) contentModifiers.push("hover");

  const contentClasses = ["content", ...contentModifiers].join(" ");

  const columnStyle: React.CSSProperties | undefined = customColor ? ({ "--custom-horizon-color": HORIZON_COLOR_CSS_VAR[customColor] } as React.CSSProperties) : undefined;

  return (
    <div className={columnClasses} style={columnStyle}>
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
