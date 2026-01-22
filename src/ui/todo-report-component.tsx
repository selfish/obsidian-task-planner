import { App, TFile, setIcon } from "obsidian";

import * as React from "react";

import { createRoot } from "react-dom/client";

import { TodoListComponent } from "./todo-list-component";
import { TodoIndex } from "../core/index/todo-index";
import { TodoMatcher } from "../core/matchers/todo-matcher";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { TodoItem, TodoStatus } from "../types/todo";
import { moment, Moment } from "../utils/moment";
import { findTodoDate } from "../utils/todo-utils";

export interface TodoReportComponentDeps {
  logger: Logger;
  todoIndex: TodoIndex<TFile>;
  settings: TaskPlannerSettings;
  app: App;
}

export interface TodoReportComponentProps {
  deps: TodoReportComponentDeps;
  onOpenPlanning?: () => void;
}

interface Container {
  id: string;
  title: string;
  todos: TodoItem<TFile>[];
}

interface DateContainer extends Container {
  from: Moment;
  to: Moment;
}

type StatusFilter = "all" | "completed" | "canceled";

interface ReportSettings {
  searchPhrase: string;
  statusFilter: StatusFilter;
  collapsedSections: Record<string, boolean>;
}

function moveToPreviousDay(date: Moment): Moment {
  return date.clone().subtract(1, "days");
}

function moveToPreviousMonday(date: Moment): Moment {
  do {
    date = moveToPreviousDay(date);
  } while (date.isoWeekday() !== 1);
  return date;
}

function findTodoCompletionDate(todo: TodoItem<TFile>, settings: TaskPlannerSettings): Moment | null {
  let d = findTodoDate(todo, settings.completedDateAttribute);
  if (d) {
    return d;
  }
  d = findTodoDate(todo, settings.dueDateAttribute);
  if (d) {
    return d;
  }
  return null;
}

function formatInterval(from: Moment, to: Moment) {
  const format = from.year() === moment().year() ? "MMM D" : "MMM D, YYYY";
  return `${from.format(format)} - ${to.clone().subtract(1, "days").format(format)}`;
}

function getOneWeekFrom(startDate: Moment): DateContainer {
  const to = startDate;
  const from = moveToPreviousMonday(startDate);
  return {
    id: `week-${from.format("YYYY-MM-DD")}`,
    from,
    to,
    title: formatInterval(from, to),
    todos: [],
  };
}

function moveToPreviousMonth(date: Moment): Moment {
  do {
    date = moveToPreviousDay(date);
  } while (date.date() > 1);
  return date;
}

function getOneMonthFrom(startDate: Moment): DateContainer {
  const to = startDate;
  const from = moveToPreviousMonth(startDate);
  return {
    id: `month-${from.format("YYYY-MM")}`,
    from,
    to,
    title: from.format("MMMM YYYY"),
    todos: [],
  };
}

function getDateContainers(minDate: Moment, numberOfWeeks: number): DateContainer[] {
  let dateCursor = moment().add(1, "days").startOf("day");
  const containers: DateContainer[] = [];
  for (let i = 0; i < numberOfWeeks && dateCursor.diff(minDate) > 0; i++) {
    const week = getOneWeekFrom(dateCursor);
    containers.push(week);
    dateCursor = week.from;
  }
  while (dateCursor.diff(minDate) > 0) {
    const month = getOneMonthFrom(dateCursor);
    containers.push(month);
    dateCursor = month.from;
  }
  return containers;
}

function filterTodosByStatus(todos: TodoItem<TFile>[], statusFilter: StatusFilter): TodoItem<TFile>[] {
  return todos.filter((todo) => {
    if (statusFilter === "all") {
      return todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
    }
    if (statusFilter === "completed") {
      return todo.status === TodoStatus.Complete;
    }
    if (statusFilter === "canceled") {
      return todo.status === TodoStatus.Canceled;
    }
    return false;
  });
}

function groupTodos(todos: TodoItem<TFile>[], containers: DateContainer[], settings: TaskPlannerSettings): Container[] {
  const assignedTodoIds = new Set<string>();

  containers.forEach((container) => {
    container.todos = todos.filter((todo) => {
      const date = findTodoCompletionDate(todo, settings);
      if (!date) {
        return false;
      }
      const isInRange = container.from.diff(date) <= 0 && container.to.diff(date) > 0;
      if (isInRange) {
        assignedTodoIds.add(`${todo.file.path}-${todo.line}`);
      }
      return isInRange;
    });
  });

  const emptyContainer: Container = {
    id: "no-date",
    title: "No date",
    todos: todos.filter((todo) => !findTodoCompletionDate(todo, settings)),
  };

  // Only add no-date container if it has todos
  const result: Container[] = containers.filter((c) => c.todos.length > 0);
  if (emptyContainer.todos.length > 0) {
    result.push(emptyContainer);
  }

  return result;
}

function getMinDate(todos: TodoItem<TFile>[], settings: TaskPlannerSettings): Moment {
  return todos.reduce((min, thisTodo) => {
    const completionDate = findTodoCompletionDate(thisTodo, settings);
    if (completionDate) {
      return min.diff(completionDate) > 0 ? completionDate : min;
    }
    return min;
  }, moment());
}

function assembleTodosByDate(todos: TodoItem<TFile>[], numberOfWeeks: number, settings: TaskPlannerSettings): Container[] {
  // Return empty array early if no todos
  if (todos.length === 0) {
    return [];
  }
  const minDate = getMinDate(todos, settings);
  const containers = getDateContainers(minDate, numberOfWeeks);
  return groupTodos(todos, containers, settings);
}

function ReportHeader({ reportSettings, setReportSettings, stats, app, onOpenPlanning }: { reportSettings: ReportSettings; setReportSettings: (settings: ReportSettings) => void; stats: { total: number; completed: number; canceled: number }; app: App; onOpenPlanning?: () => void }) {
  const { searchPhrase, statusFilter } = reportSettings;

  // Use callback refs to ensure icons render on mount
  const setPlanningIconRef = React.useCallback((node: HTMLButtonElement | null) => {
    if (node) {
      node.replaceChildren();
      setIcon(node, "calendar");
    }
  }, []);

  const setDropdownChevronRef = React.useCallback((node: HTMLSpanElement | null) => {
    if (node) {
      node.replaceChildren();
      setIcon(node, "chevron-down");
    }
  }, []);

  function onSearchChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setReportSettings({
      ...reportSettings,
      searchPhrase: ev.target.value,
    });
  }

  function onStatusFilterChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    setReportSettings({
      ...reportSettings,
      statusFilter: ev.target.value as StatusFilter,
    });
  }

  return (
    <div className="header">
      <div className="title">
        <h1>Completed Tasks</h1>
        <div className="stats">
          <span className="stat">{stats.total} total</span>
          <span className="stat separator">•</span>
          <span className="stat completed">{stats.completed} completed</span>
          <span className="stat separator">•</span>
          <span className="stat canceled">{stats.canceled} canceled</span>
        </div>
      </div>
      <div className="controls">
        <input type="text" className="search" placeholder="Filter tasks..." onChange={onSearchChange} value={searchPhrase} />
        <span className="status-filter-wrapper">
          <select className="status-filter" value={statusFilter} onChange={onStatusFilterChange}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
          <span ref={setDropdownChevronRef} className="status-filter-chevron" />
        </span>
        {onOpenPlanning && <button ref={setPlanningIconRef} className="settings-btn" onClick={onOpenPlanning} aria-label="Open planning board" />}
      </div>
    </div>
  );
}

function ReportSection({ container, deps, isCollapsed, onToggle }: { container: Container; deps: TodoReportComponentDeps; isCollapsed: boolean; onToggle: () => void }) {
  // Use callback ref to ensure icon renders on mount and updates on collapse change
  const setChevronRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) {
        node.replaceChildren();
        setIcon(node, isCollapsed ? "chevron-right" : "chevron-down");
      }
    },
    [isCollapsed]
  );

  return (
    <div className={`report-section ${isCollapsed ? "collapsed" : ""}`}>
      <button className="section-header" onClick={onToggle}>
        <span ref={setChevronRef} className="chevron"></span>
        <span className="section-title">{container.title}</span>
        <span className="section-count">{container.todos.length}</span>
      </button>
      {!isCollapsed && (
        <div className="section-content">
          <TodoListComponent deps={deps} todos={container.todos} dontCrossCompleted={true} />
        </div>
      )}
    </div>
  );
}

export function TodoReportComponent({ deps, onOpenPlanning }: TodoReportComponentProps) {
  const [todos, setTodos] = React.useState(deps.todoIndex.todos);
  const [numberOfWeeks] = React.useState(4);
  const [reportSettings, setReportSettings] = React.useState<ReportSettings>({
    searchPhrase: "",
    statusFilter: "all",
    collapsedSections: {},
  });

  React.useEffect(() => {
    const unsubscribe = deps.todoIndex.onUpdateEvent.listen((todos) => {
      setTodos(todos);
      return Promise.resolve();
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [deps.todoIndex]);

  // Filter todos by status
  const statusFilteredTodos = React.useMemo(() => filterTodosByStatus(todos, reportSettings.statusFilter), [todos, reportSettings.statusFilter]);

  // Filter by search
  const filteredTodos = React.useMemo(() => {
    if (!reportSettings.searchPhrase) return statusFilteredTodos;
    const filter = new TodoMatcher(reportSettings.searchPhrase, deps.settings.fuzzySearch);
    return statusFilteredTodos.filter((todo) => filter.matches(todo));
  }, [statusFilteredTodos, reportSettings.searchPhrase, deps.settings.fuzzySearch]);

  // Group into containers
  const containers = React.useMemo(() => assembleTodosByDate(filteredTodos, numberOfWeeks, deps.settings), [filteredTodos, numberOfWeeks, deps.settings]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const completed = todos.filter((t) => t.status === TodoStatus.Complete).length;
    const canceled = todos.filter((t) => t.status === TodoStatus.Canceled).length;
    return {
      total: completed + canceled,
      completed,
      canceled,
    };
  }, [todos]);

  function toggleSection(id: string) {
    setReportSettings((prev) => ({
      ...prev,
      collapsedSections: {
        ...prev.collapsedSections,
        [id]: !prev.collapsedSections[id],
      },
    }));
  }

  function collapseAll() {
    const allCollapsed: Record<string, boolean> = {};
    containers.forEach((c) => {
      allCollapsed[c.id] = true;
    });
    setReportSettings((prev) => ({
      ...prev,
      collapsedSections: allCollapsed,
    }));
  }

  function expandAll() {
    setReportSettings((prev) => ({
      ...prev,
      collapsedSections: {},
    }));
  }

  const allCollapsed = containers.length > 0 && containers.every((c) => reportSettings.collapsedSections[c.id]);

  return (
    <div className="report-container">
      <ReportHeader reportSettings={reportSettings} setReportSettings={setReportSettings} stats={stats} app={deps.app} onOpenPlanning={onOpenPlanning} />
      <div className="report-actions">
        <button className="action-btn" onClick={allCollapsed ? expandAll : collapseAll}>
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>
        <span className="result-count">
          {filteredTodos.length} {filteredTodos.length === 1 ? "task" : "tasks"} in {containers.length} {containers.length === 1 ? "period" : "periods"}
        </span>
      </div>
      <div className="report-content">
        {containers.length === 0 ? (
          <div className="empty-state">
            <span>{reportSettings.statusFilter === "all" ? "No completed or canceled tasks found" : reportSettings.statusFilter === "completed" ? "No completed tasks found" : "No canceled tasks found"}</span>
          </div>
        ) : (
          containers.map((container) => <ReportSection key={container.id} container={container} deps={deps} isCollapsed={!!reportSettings.collapsedSections[container.id]} onToggle={() => toggleSection(container.id)} />)
        )}
      </div>
    </div>
  );
}

export function mountTodoReportComponent(onElement: HTMLElement, props: TodoReportComponentProps) {
  onElement.addClass("task-planner");
  onElement.addClass("report");
  const client = createRoot(onElement);
  client.render(<TodoReportComponent {...props}></TodoReportComponent>);
}
