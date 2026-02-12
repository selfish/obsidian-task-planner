import { createRoot } from "react-dom/client";

import { App, TFile, setIcon } from "obsidian";

import * as React from "react";

import { useIconRef } from "./hooks";
import { TodoItemComponent } from "./task-item-component";
import { TaskIndex } from "../core/index/task-index";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { TaskItem, TaskStatus } from "../types/task";
import { moment } from "../utils/moment";
import { findTaskDate } from "../utils/task-utils";

export interface TodoSidePanelComponentDeps {
  taskIndex: TaskIndex<TFile>;
  logger: Logger;
  app: App;
  settings: TaskPlannerSettings;
}

export interface TodoSidePanelComponentProps {
  deps: TodoSidePanelComponentDeps;
}

interface SectionProps {
  icon: string;
  title: string;
  count: number;
  variant?: "default" | "warning" | "accent" | "success" | "progress";
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ icon, title, count, variant = "default", collapsed, onToggle, children }: SectionProps): React.ReactElement {
  const isEmpty = count === 0;
  const iconRef = useIconRef(icon);

  const chevronRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) {
        node.replaceChildren();
        if (!isEmpty) {
          setIcon(node, collapsed ? "chevron-right" : "chevron-down");
        }
      }
    },
    [collapsed, isEmpty]
  );

  const headerClass = `sidebar-section-header ${variant}${isEmpty ? " empty" : ""}`;
  const handleClick = isEmpty ? undefined : onToggle;

  return (
    <div className={`sidebar-section${isEmpty ? " empty" : ""}`}>
      <button className={headerClass} onClick={handleClick}>
        <span ref={chevronRef} className="chevron" />
        <span ref={iconRef} className="icon" />
        <span className="title">{title}</span>
        <span className="count">{count}</span>
      </button>
      {!collapsed && count > 0 && <div className="sidebar-section-content">{children}</div>}
    </div>
  );
}

const STORAGE_KEY = "task-planner-sidebar-collapsed";

function loadCollapsedState(app: App): Record<string, boolean> {
  try {
    const stored = app.loadLocalStorage(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveCollapsedState(app: App, state: Record<string, boolean>): void {
  try {
    app.saveLocalStorage(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function TodoSidePanelComponent({ deps }: TodoSidePanelComponentProps) {
  const { settings, app, logger } = deps;
  const [todos, setTodos] = React.useState<TaskItem<TFile>[]>(deps.taskIndex.tasks);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => loadCollapsedState(app));

  React.useEffect(() => {
    const unsubscribe = deps.taskIndex.onUpdateEvent.listen((updatedTodos: TaskItem<TFile>[]) => {
      setTodos(updatedTodos);
      return Promise.resolve();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [deps.taskIndex]);

  const toggleSection = (section: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      saveCollapsedState(app, next);
      return next;
    });
  };

  // Filter functions
  const isIncomplete = (todo: TaskItem<TFile>) => todo.status !== TaskStatus.Complete && todo.status !== TaskStatus.Canceled;

  const pinnedTodos = React.useMemo(() => {
    return todos.filter((todo) => isIncomplete(todo) && !!todo.attributes?.[settings.selectedAttribute]);
  }, [todos, settings.selectedAttribute]);

  const overdueTodos = React.useMemo(() => {
    const today = moment().startOf("day");
    return todos.filter((todo) => {
      if (!isIncomplete(todo)) return false;
      const dueDate = findTaskDate(todo, settings.dueDateAttribute);
      return dueDate && dueDate.isBefore(today);
    });
  }, [todos, settings.dueDateAttribute]);

  const todayTodos = React.useMemo(() => {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    return todos.filter((todo) => {
      if (!isIncomplete(todo)) return false;
      // Don't include pinned tasks here to avoid duplication
      if (todo.attributes?.[settings.selectedAttribute]) return false;
      // Don't include in-progress tasks here
      if (todo.status === TaskStatus.InProgress || todo.status === TaskStatus.AttentionRequired || todo.status === TaskStatus.Delegated) return false;
      const dueDate = findTaskDate(todo, settings.dueDateAttribute);
      return dueDate && dueDate.isSameOrAfter(today) && dueDate.isBefore(tomorrow);
    });
  }, [todos, settings.dueDateAttribute, settings.selectedAttribute]);

  const startedTodos = React.useMemo(() => {
    return todos.filter((todo) => {
      return todo.status === TaskStatus.InProgress || todo.status === TaskStatus.AttentionRequired || todo.status === TaskStatus.Delegated;
    });
  }, [todos]);

  const doneTodayTodos = React.useMemo(() => {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    return todos.filter((todo) => {
      if (todo.status !== TaskStatus.Complete && todo.status !== TaskStatus.Canceled) return false;
      const completedDate = findTaskDate(todo, settings.completedDateAttribute);
      return completedDate && completedDate.isSameOrAfter(today) && completedDate.isBefore(tomorrow);
    });
  }, [todos, settings.completedDateAttribute]);

  const componentDeps = { app, settings, logger };

  const totalActionable = pinnedTodos.length + overdueTodos.length + todayTodos.length + startedTodos.length;

  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <span className="sidebar-title">Today Focus</span>
        {totalActionable > 0 && <span className="sidebar-total">{totalActionable}</span>}
      </div>

      <div className="sidebar-content">
        <Section icon="pin" title="Pinned" count={pinnedTodos.length} variant="accent" collapsed={!!collapsed.pinned} onToggle={() => toggleSection("pinned")}>
          {pinnedTodos.map((todo) => (
            <TodoItemComponent key={`${todo.file.file.path}:${todo.line}`} todo={todo} deps={componentDeps} hideFileRef={false} />
          ))}
        </Section>

        <Section icon="alert-triangle" title="Overdue" count={overdueTodos.length} variant="warning" collapsed={!!collapsed.overdue} onToggle={() => toggleSection("overdue")}>
          {overdueTodos.map((todo) => (
            <TodoItemComponent key={`${todo.file.file.path}:${todo.line}`} todo={todo} deps={componentDeps} hideFileRef={false} />
          ))}
        </Section>

        <Section icon="sun" title="Today" count={todayTodos.length} variant="default" collapsed={!!collapsed.today} onToggle={() => toggleSection("today")}>
          {todayTodos.map((todo) => (
            <TodoItemComponent key={`${todo.file.file.path}:${todo.line}`} todo={todo} deps={componentDeps} hideFileRef={false} />
          ))}
        </Section>

        <Section icon="clock" title="Started" count={startedTodos.length} variant="progress" collapsed={!!collapsed.started} onToggle={() => toggleSection("started")}>
          {startedTodos.map((todo) => (
            <TodoItemComponent key={`${todo.file.file.path}:${todo.line}`} todo={todo} deps={componentDeps} hideFileRef={false} />
          ))}
        </Section>

        <Section icon="check-circle" title="Done Today" count={doneTodayTodos.length} variant="success" collapsed={!!collapsed.done} onToggle={() => toggleSection("done")}>
          {doneTodayTodos.map((todo) => (
            <TodoItemComponent key={`${todo.file.file.path}:${todo.line}`} todo={todo} deps={componentDeps} hideFileRef={false} dontCrossCompleted={true} />
          ))}
        </Section>

        {totalActionable === 0 && doneTodayTodos.length === 0 && (
          <div className="sidebar-all-clear">
            <span className="emoji">✨</span>
            <span className="message">All clear for today!</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function mountSidePanelComponent(onElement: HTMLElement, props: TodoSidePanelComponentProps) {
  onElement.addClass("task-planner");
  onElement.addClass("sidebar");
  const root = createRoot(onElement);
  root.render(<TodoSidePanelComponent {...props} />);
}
