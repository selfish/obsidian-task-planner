import { TFile, setIcon } from "obsidian";

import * as React from "react";

import { StandardDependencies } from "./standard-dependencies";
import { TaskListComponent } from "./task-list-component";
import { HorizonColor } from "../settings/types";
import { Consts } from "../types/constants";
import { TaskItem } from "../types/task";

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

export type PlanningTodoColumnDeps = StandardDependencies & {
  /** Column type for context-specific rendering (e.g., due date badges in in-progress) */
  columnType?: ColumnType;
};

export type ColumnType = "backlog" | "overdue" | "today-todo" | "today-in-progress" | "today-done" | "future";

export interface ColumnHeaderAction {
  icon: string;
  label: string;
  onClick: () => void;
}

export interface PlanningTodoColumnProps {
  icon: string;
  title: string;
  todos: TaskItem<TFile>[];
  onTodoDropped: ((taskId: string) => void) | null;
  onBatchTodoDropped?: ((todoIds: string[]) => Promise<void>) | null;
  hideIfEmpty: boolean;
  deps: PlanningTodoColumnDeps;
  substyle?: string;
  customColor?: HorizonColor;
  columnType?: ColumnType;
  headerActions?: ColumnHeaderAction[];
}

function getEmptyStateMessage(columnType?: ColumnType): string {
  switch (columnType) {
    case "backlog":
      return "Tasks without due dates live here";
    case "overdue":
      return "All caught up!";
    case "today-todo":
      return "Nothing scheduled for today";
    case "today-in-progress":
      return "Drag a task here to start working";
    case "today-done":
      return "Complete tasks to see them here";
    case "future":
    default:
      return "No tasks scheduled";
  }
}

export function PlanningTaskColumn({ icon, title, hideIfEmpty, onTodoDropped, onBatchTodoDropped, todos, deps, substyle, customColor, columnType, headerActions }: PlanningTodoColumnProps): React.ReactElement | null {
  const [isHovering, setIsHovering] = React.useState(false);

  // Parse title for main title and optional subtitle (separated by \n)
  const [mainTitle, subtitle] = React.useMemo(() => {
    const parts = title.split("\n");
    return [parts[0], parts[1] || null];
  }, [title]);

  // Use callback ref to ensure icon renders on mount (fixes Preact re-render issue)
  const setIconRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      if (node && icon) {
        node.replaceChildren();
        setIcon(node, icon);
      }
    },
    [icon]
  );

  // Create callback refs for header action icons
  const createActionIconRef = React.useCallback(
    (iconName: string) => (node: HTMLSpanElement | null) => {
      if (node && iconName) {
        node.replaceChildren();
        setIcon(node, iconName);
      }
    },
    []
  );

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

    const groupIds = ev.dataTransfer.getData(Consts.TaskGroupDragType);
    if (groupIds) {
      const todoIds = groupIds.split(Consts.TaskIdDelimiter);

      if (onBatchTodoDropped) {
        void onBatchTodoDropped(todoIds);
      } else if (onTodoDropped) {
        todoIds.forEach((taskId, index) => {
          setTimeout(() => {
            onTodoDropped(taskId);
          }, index * 30);
        });
      }
      return;
    }

    const taskId = ev.dataTransfer.getData(Consts.TaskItemDragType);
    if (taskId && onTodoDropped) {
      onTodoDropped(taskId);
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
  const columnClassList = [columnClasses].filter(Boolean).join(" ");

  return (
    <div className={columnClassList} style={columnStyle}>
      <div className="header">
        <div className="header-row primary">
          <span ref={setIconRef} className="icon"></span>
          <span className="title">{mainTitle}</span>
        </div>
        <div className="header-row secondary">
          <span className="subtitle">{subtitle || "\u00A0"}</span>
          <span className={`count ${todos.length === 0 ? "hidden" : ""}`}>({todos.length || 0})</span>
        </div>
        {headerActions && headerActions.length > 0 && todos.length > 0 && (
          <div className="header-actions">
            {headerActions.map((action, index) => (
              <button key={index} className="header-action-btn" onClick={action.onClick} title={action.label} aria-label={action.label}>
                <span ref={createActionIconRef(action.icon)} className="icon"></span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={contentClasses} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDrop}>
        {todos.length === 0 ? (
          <div className="empty-state-content">
            <span className="empty-state-text">{getEmptyStateMessage(columnType)}</span>
          </div>
        ) : (
          <TaskListComponent deps={{ ...deps, columnType }} todos={todos} />
        )}
      </div>
    </div>
  );
}
