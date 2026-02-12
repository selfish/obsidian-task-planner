import { createRoot } from "react-dom/client";

import { App, TFile, setIcon } from "obsidian";

import * as React from "react";

import { createMoveOperations, getDateLabel } from "./planning-move-ops";
import { PlanningSettingsComponent } from "./planning-settings-component";
import { PlanningSettingsStore } from "./planning-settings-store";
import { PlanningTaskColumn, ColumnType, ColumnHeaderAction } from "./planning-task-column";
import {
  TaskFilterContext,
  getTodosByDate as filterByDate,
  getTodosWithNoDate as filterNoDate,
  getTodosByDateAndStatus as filterByDateStatus,
  getInProgressTodos,
  getInProgressTaskIds,
  getOverdueTodos as filterOverdue,
  getCustomDateHorizonTodos as filterCustomHorizon,
  markTasksAsAssigned,
} from "./planning-task-filters";
import { UndoToastContainer } from "./undo-toast";
import { TaskIndex } from "../core/index/task-index";
import { TaskMatcher } from "../core/matchers/task-matcher";
import { UndoManager } from "../core/operations/undo-manager";
import { UndoableFileOperations } from "../core/operations/undoable-file-ops";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { TaskItem, TaskStatus, getTaskId } from "../types/task";
import { moment, Moment } from "../utils/moment";
import { findTaskDate } from "../utils/task-utils";

export interface PlanningComponentDeps {
  logger: Logger;
  taskIndex: TaskIndex<TFile>;
  undoManager?: UndoManager;
}

export interface PlanningComponentProps {
  deps: PlanningComponentDeps;
  settings: TaskPlannerSettings;
  app: App;
  onRefresh?: () => void;
  onOpenReport?: () => void;
  onQuickAdd?: () => void;
}

export function PlanningComponent({ deps, settings, app, onRefresh, onOpenReport, onQuickAdd }: PlanningComponentProps) {
  const settingsStore = React.useMemo(() => new PlanningSettingsStore(app), [app]);
  const savedSettings = React.useMemo(() => settingsStore.getSettings(), [settingsStore]);
  const [planningSettings, setPlanningSettingsState] = React.useState(savedSettings);
  const [todos, setTodos] = React.useState<TaskItem<TFile>[]>(deps.taskIndex.tasks);

  // Define findTodo early so it can be used by undo handler
  const findTodo = React.useCallback(
    (taskId: string): TaskItem<TFile> | undefined => {
      function searchRecursive(items: TaskItem<TFile>[]): TaskItem<TFile> | undefined {
        for (const todo of items) {
          if (getTaskId(todo) === taskId) {
            return todo;
          }
          if (todo.subtasks && todo.subtasks.length > 0) {
            const found = searchRecursive(todo.subtasks);
            if (found) return found;
          }
        }
        return undefined;
      }
      return searchRecursive(todos);
    },
    [todos]
  );

  const setPlanningSettings = React.useMemo(() => settingsStore.decorateSetterWithSaveSettings(setPlanningSettingsState), [settingsStore, setPlanningSettingsState]);
  const { searchParameters, hideEmpty, hideDone, wipLimit, viewMode } = planningSettings;

  // Show ignored is session-only state (not persisted)
  const [showIgnored, setShowIgnored] = React.useState(false);
  const hideEmptyBeforeIgnoredRef = React.useRef<boolean | null>(null);

  // Auto-toggle hideEmpty when entering/exiting show ignored mode
  React.useEffect(() => {
    if (showIgnored) {
      // Entering show ignored mode - save current hideEmpty and force it on
      hideEmptyBeforeIgnoredRef.current = hideEmpty;
      if (!hideEmpty) {
        setPlanningSettingsState((prev) => ({ ...prev, hideEmpty: true }));
      }
    } else if (hideEmptyBeforeIgnoredRef.current !== null) {
      // Exiting show ignored mode - restore previous hideEmpty
      const previousValue = hideEmptyBeforeIgnoredRef.current;
      hideEmptyBeforeIgnoredRef.current = null;
      if (hideEmpty !== previousValue) {
        setPlanningSettingsState((prev) => ({ ...prev, hideEmpty: previousValue }));
      }
    }
  }, [hideEmpty, showIgnored]);

  // Undo manager setup
  const undoManager = React.useMemo(() => {
    if (deps.undoManager) return deps.undoManager;
    return new UndoManager({
      maxHistorySize: settings.undo.undoHistorySize,
      maxHistoryAgeMs: settings.undo.undoHistoryMaxAgeSeconds * 1000,
      enabled: settings.undo.enableUndo,
    });
  }, [deps.undoManager, settings.undo.undoHistorySize, settings.undo.undoHistoryMaxAgeSeconds, settings.undo.enableUndo]);

  const undoableFileOps = React.useMemo(() => new UndoableFileOperations({ settings, undoManager }), [settings, undoManager]);

  // Move operations - created once and memoized
  const moveOps = React.useMemo(
    () => createMoveOperations({ settings, undoableFileOps, findTodo }),
    [settings, undoableFileOps, findTodo]
  );

  // Undo toast state
  const [undoToast, setUndoToast] = React.useState<{ message: string; id: string; isUndone?: boolean } | null>(null);

  // Subscribe to undo manager events to show toast
  React.useEffect(() => {
    if (!settings.undo.showUndoToast) return undefined;

    const unsubscribe = undoManager.onOperationRecorded.listen(async (operation) => {
      setUndoToast({ message: operation.description, id: operation.id });
      await Promise.resolve(); // Satisfy async requirement
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [undoManager, settings.undo.showUndoToast]);

  // Handle undo action
  const handleUndo = React.useCallback(async () => {
    const operation = undoManager.popForUndo();
    if (operation) {
      const success = await undoableFileOps.applyUndo(operation, findTodo);
      if (success) {
        setUndoToast({ message: `Undone: ${operation.description}`, id: `${operation.id}-undone`, isUndone: true });
      } else {
        deps.logger.warn("Undo operation partially failed - some tasks may have changed");
        setUndoToast({ message: `Partially undone: ${operation.description}`, id: `${operation.id}-partial`, isUndone: true });
      }
    }
  }, [undoManager, undoableFileOps, deps.logger, findTodo]);

  // Handle keyboard shortcut for undo (Mod+Z)
  React.useEffect(() => {
    if (!settings.undo.enableUndo) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "z" && !e.shiftKey) {
        if (undoManager.canUndo()) {
          e.preventDefault();
          e.stopPropagation();
          void handleUndo();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settings.undo.enableUndo, undoManager, handleUndo]);

  // Flatten todos to include subtasks with their own due dates as independent items
  const flattenedTodos = React.useMemo(() => {
    const result: TaskItem<TFile>[] = [];
    const subtasksWithDates = new Set<TaskItem<TFile>>();

    // First pass: identify subtasks that have their own due dates
    function collectDatedSubtasks(todo: TaskItem<TFile>) {
      if (todo.subtasks) {
        for (const subtask of todo.subtasks) {
          const subtaskDate = findTaskDate(subtask, settings.dueDateAttribute);
          if (subtaskDate) {
            subtasksWithDates.add(subtask);
          }
          collectDatedSubtasks(subtask);
        }
      }
    }

    for (const todo of todos) {
      collectDatedSubtasks(todo);
      result.push(todo);
    }

    // Add subtasks with dates as independent items
    for (const subtask of subtasksWithDates) {
      result.push(subtask);
    }

    return { todos: result, subtasksWithDates };
  }, [todos, settings.dueDateAttribute]);

  const filteredTodos = React.useMemo(() => {
    const filter = new TaskMatcher(searchParameters.searchPhrase, settings.fuzzySearch);
    return flattenedTodos.todos.filter((todo) => {
      // Check both task-level and file-level ignore
      const isTaskIgnored = todo.attributes?.["ignore"] === true || todo.attributes?.["ignore"] === "true";
      const isFileIgnored = todo.file.shouldIgnore?.() === true;
      const isIgnored = isTaskIgnored || isFileIgnored;

      // Show ignored mode: show ONLY ignored tasks
      if (showIgnored) {
        return isIgnored && filter.matches(todo);
      }
      // Normal mode: hide ignored tasks
      if (isIgnored) return false;
      return filter.matches(todo);
    });
  }, [flattenedTodos.todos, searchParameters.searchPhrase, settings.fuzzySearch, showIgnored]);

  // Set of subtask IDs that have their own dates (to hide from parent's subtask list)
  const promotedSubtaskIds = React.useMemo(() => {
    return new Set(Array.from(flattenedTodos.subtasksWithDates).map((t) => getTaskId(t)));
  }, [flattenedTodos.subtasksWithDates]);

  React.useEffect(() => {
    const unsubscribe = deps.taskIndex.onUpdateEvent.listen((todos) => {
      setTodos(todos);
      return Promise.resolve();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [deps.taskIndex]);

  // Filter context for task filtering utilities
  const filterCtx: TaskFilterContext = React.useMemo(() => ({ settings, filteredTodos }), [settings, filteredTodos]);

  // Shorthand filter functions bound to current context
  const getTodosByDate = (from: Moment | null, to: Moment | null, includeSelected = false, excludeIds?: Set<string>) =>
    filterByDate(filterCtx, from, to, includeSelected, excludeIds);
  const getTodosWithNoDate = (excludeIds?: Set<string>) => filterNoDate(filterCtx, excludeIds);
  const getTodosByDateAndStatus = (from: Moment, to: Moment, statuses: TaskStatus[]) => filterByDateStatus(filterCtx, from, to, statuses);
  const getOverdueTodos = (excludeIds?: Set<string>) => filterOverdue(filterCtx, moment().startOf("day"), excludeIds);
  const getCustomDateHorizonTodos = (date: string, tag?: string, excludeIds?: Set<string>) => filterCustomHorizon(filterCtx, date, tag, excludeIds, moment);

  // Shorthand aliases for move operations
  const { moveToDate, batchMoveToDate, moveToDateAndTag, batchMoveToDateAndTag, moveToDateAndStatus, batchMoveToDateAndStatus, changeStatusOnly, batchChangeStatusOnly, removeDate, batchRemoveDate } = moveOps;

  // Set of in-progress task IDs (to exclude from date-based columns)
  const inProgressTaskIds = React.useMemo(() => getInProgressTaskIds(filteredTodos), [filteredTodos]);

  function todoColumn(
    icon: string,
    title: string,
    todos: TaskItem<TFile>[],
    hideIfEmpty = hideEmpty,
    onTodoDropped: ((taskId: string) => void) | null = null,
    onBatchTodoDropped?: ((todoIds: string[]) => Promise<void>) | null,
    substyle?: string,
    customColor?: string,
    columnType?: ColumnType,
    headerActions?: ColumnHeaderAction[]
  ) {
    return (
      <PlanningTaskColumn
        hideIfEmpty={hideIfEmpty}
        icon={icon}
        title={title}
        key={title}
        onTodoDropped={onTodoDropped}
        onBatchTodoDropped={onBatchTodoDropped}
        todos={todos}
        deps={{
          app,
          settings,
          logger: deps.logger,
          promotedSubtaskIds,
        }}
        substyle={substyle}
        customColor={customColor as Parameters<typeof PlanningTaskColumn>[0]["customColor"]}
        columnType={columnType}
        headerActions={headerActions}
      />
    );
  }

  function* getTodayColumns() {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    const columnCount = hideDone ? 2 : 3;

    yield todoColumn("circle", "Todo\nNot started", getTodosByDateAndStatus(today, tomorrow, [TaskStatus.Todo]), false, moveToDateAndStatus(today, TaskStatus.Todo), batchMoveToDateAndStatus(today, TaskStatus.Todo), `today cols-${columnCount}`, undefined, "today-todo");

    // In Progress column shows ALL tasks with in-progress status regardless of due date
    // Dropping into this column only changes status, not the due date
    yield todoColumn("clock", "In Progress\nWorking on", getInProgressTodos(filteredTodos), false, changeStatusOnly(TaskStatus.InProgress), batchChangeStatusOnly(TaskStatus.InProgress), `today cols-${columnCount}`, undefined, "today-in-progress");

    if (!hideDone) {
      yield todoColumn(
        "check-circle",
        "Completed\nDone today",
        getTodosByDateAndStatus(today, tomorrow, [TaskStatus.Canceled, TaskStatus.Complete]),
        false,
        moveToDateAndStatus(today, TaskStatus.Complete),
        batchMoveToDateAndStatus(today, TaskStatus.Complete),
        `today cols-${columnCount} done`,
        undefined,
        "today-done"
      );
    }
  }

  function getWipStyle(todos: TaskItem<TFile>[]) {
    if (wipLimit.isLimited) {
      if (todos.length > wipLimit.dailyLimit) {
        return "wip-exceeded";
      }
    }
    return "";
  }

  function* getColumns() {
    const { horizonVisibility, customHorizons } = settings;

    const today = moment().startOf("day");

    // Track assigned task IDs to prevent duplicates across horizons
    const assignedTaskIds = new Set<string>(inProgressTaskIds);

    // PRE-CLAIM: Custom horizons have priority over builtins.
    // Calculate and claim their tasks FIRST, before any builtin processing.
    const customHorizonTodos = new Map<number, TaskItem<TFile>[]>();
    if (customHorizons) {
      for (let i = 0; i < customHorizons.length; i++) {
        const horizon = customHorizons[i];
        // Get todos matching this custom horizon (respects earlier custom horizon claims)
        const todos = getCustomDateHorizonTodos(horizon.date, horizon.tag, assignedTaskIds);
        customHorizonTodos.set(i, todos);
        markTasksAsAssigned(todos, assignedTaskIds); // Pre-claim these tasks
      }
    }

    // Helper to render a custom horizon column
    function* renderCustomHorizon(index: number) {
      if (!customHorizons) return;
      const horizon = customHorizons[index];
      const todos = customHorizonTodos.get(index) ?? [];
      const horizonDate = moment(horizon.date);
      const onDrop = horizon.tag ? moveToDateAndTag(horizonDate, horizon.tag) : moveToDate(horizonDate);
      const onBatchDrop = horizon.tag ? batchMoveToDateAndTag(horizonDate, horizon.tag) : batchMoveToDate(horizonDate);
      const subtitle = horizon.tag ? `${horizonDate.format("MMM D")} · #${horizon.tag}` : horizonDate.format("MMM D");
      const label = `${horizon.label}\n${subtitle}`;
      yield todoColumn("calendar-days", label, todos, hideEmpty, onDrop, onBatchDrop, undefined, horizon.color, "future");
    }

    // Track which inline horizons have been rendered
    const renderedInlineHorizons = new Set<number>();

    // Helper to check and yield inline custom horizons before a date range starts
    function* yieldInlineHorizonsBefore(rangeStart: Moment) {
      if (!customHorizons) return;
      for (let i = 0; i < customHorizons.length; i++) {
        if (renderedInlineHorizons.has(i)) continue;
        const horizon = customHorizons[i];
        if (horizon.position !== "inline") continue;
        const horizonDate = moment(horizon.date);
        // Yield if horizon date is before this range starts
        if (horizonDate.isBefore(rangeStart)) {
          renderedInlineHorizons.add(i);
          yield* renderCustomHorizon(i);
        }
      }
    }

    // Helper to yield inline horizon if it matches a specific day
    function* yieldInlineHorizonForDay(dayStart: Moment) {
      if (!customHorizons) return;
      const dayEnd = dayStart.clone().add(1, "days");
      for (let i = 0; i < customHorizons.length; i++) {
        if (renderedInlineHorizons.has(i)) continue;
        const horizon = customHorizons[i];
        if (horizon.position !== "inline") continue;
        const horizonDate = moment(horizon.date).startOf("day");
        // Yield if horizon date is the same day
        if (horizonDate.isSameOrAfter(dayStart) && horizonDate.isBefore(dayEnd)) {
          renderedInlineHorizons.add(i);
          yield* renderCustomHorizon(i);
        }
      }
    }

    // Pre-calculate larger horizon ranges to prevent overlaps
    const monthHorizonRanges: Array<{ start: Moment; end: Moment }> = [];
    const quarterHorizonRanges: Array<{ start: Moment; end: Moment }> = [];
    const yearHorizonRanges: Array<{ start: Moment; end: Moment }> = [];

    let monthCalcStart = today.clone().add(1, "days");

    if (horizonVisibility.weeksToShow > 0) {
      const firstWeekday = settings.firstWeekday ?? 1;
      let endOfWeek = today.clone();
      const daysUntilNextWeek = (firstWeekday - endOfWeek.isoWeekday() + 7) % 7 || 7;
      endOfWeek = endOfWeek.add(daysUntilNextWeek, "days");
      monthCalcStart = endOfWeek.clone().add(horizonVisibility.weeksToShow, "weeks");
    }

    if (horizonVisibility.monthsToShow > 0) {
      let monthStart = monthCalcStart.clone().startOf("month");
      if (monthStart.isBefore(monthCalcStart)) {
        monthStart = monthStart.add(1, "months");
      }
      for (let i = 0; i < horizonVisibility.monthsToShow; i++) {
        const monthEnd = monthStart.clone().add(1, "months");
        monthHorizonRanges.push({ start: monthStart.clone(), end: monthEnd });
        monthStart = monthEnd;
      }
    }

    let quarterCalcStart = monthCalcStart.clone();
    if (horizonVisibility.monthsToShow > 0) {
      let tempMonth = monthCalcStart.clone().startOf("month");
      if (tempMonth.isBefore(monthCalcStart)) {
        tempMonth = tempMonth.add(1, "months");
      }
      quarterCalcStart = tempMonth.add(horizonVisibility.monthsToShow, "months");
    }

    if (horizonVisibility.showQuarters) {
      const endOfYear = today.clone().endOf("year").add(1, "days").startOf("day");
      let quarterStart = quarterCalcStart.clone().startOf("quarter");
      if (quarterStart.isBefore(quarterCalcStart)) {
        quarterStart = quarterStart.add(1, "quarters");
      }
      while (quarterStart.isBefore(endOfYear)) {
        const quarterEnd = quarterStart.clone().add(1, "quarters");
        quarterHorizonRanges.push({ start: quarterStart.clone(), end: quarterEnd });
        quarterStart = quarterEnd;
      }
    }

    if (horizonVisibility.showNextYear) {
      const nextYearStart = today.clone().add(1, "years").startOf("year");
      const nextYearEnd = nextYearStart.clone().add(1, "years");
      if (nextYearStart.year() > today.year()) {
        yearHorizonRanges.push({ start: nextYearStart, end: nextYearEnd });
      }
    }

    function isWeekOverlapping(start: Moment, end: Moment): boolean {
      const allLarger = [...monthHorizonRanges, ...quarterHorizonRanges, ...yearHorizonRanges];
      return allLarger.some((horizon) => start.isSameOrAfter(horizon.start) && end.isSameOrBefore(horizon.end));
    }

    function isMonthOverlapping(start: Moment, end: Moment): boolean {
      const allLarger = [...quarterHorizonRanges, ...yearHorizonRanges];
      return allLarger.some((horizon) => start.isSameOrAfter(horizon.start) && end.isSameOrBefore(horizon.end));
    }

    function isQuarterOverlapping(start: Moment, end: Moment): boolean {
      return yearHorizonRanges.some((horizon) => start.isSameOrAfter(horizon.start) && end.isSameOrBefore(horizon.end));
    }

    // Render custom horizons with position "before"
    if (customHorizons) {
      for (let i = 0; i < customHorizons.length; i++) {
        if (customHorizons[i].position === "before") {
          yield* renderCustomHorizon(i);
        }
      }
    }

    if (horizonVisibility.showBacklog) {
      const backlogTodos = getTodosWithNoDate(assignedTaskIds);
      markTasksAsAssigned(backlogTodos, assignedTaskIds);
      yield todoColumn("inbox", "Backlog\nNo due date", backlogTodos, false, removeDate(), batchRemoveDate(), "backlog", undefined, "backlog");
    }

    if (horizonVisibility.showOverdue || horizonVisibility.showPast) {
      const overdueTodos = getOverdueTodos(assignedTaskIds);
      markTasksAsAssigned(overdueTodos, assignedTaskIds);
      const overdueHeaderActions: ColumnHeaderAction[] = [
        {
          icon: "calendar-check",
          label: "Reschedule all to Today",
          onClick: () => {
            const todoIds = overdueTodos.map((todo) => getTaskId(todo));
            void batchMoveToDate(today)(todoIds);
          },
        },
        {
          icon: "inbox",
          label: "Move all to Backlog",
          onClick: () => {
            const todoIds = overdueTodos.map((todo) => getTaskId(todo));
            void batchRemoveDate()(todoIds);
          },
        },
      ];
      yield todoColumn("alert-triangle", "Overdue\nBefore today", overdueTodos, true, null, null, "overdue", undefined, "overdue", overdueHeaderActions);
    }

    if (viewMode === "future") {
      const tomorrow = today.clone().add(1, "day");
      const todayTodos = filteredTodos.filter((todo) => {
        if (assignedTaskIds.has(getTaskId(todo))) return false;
        if (todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled) return false;
        const dueDate = findTaskDate(todo, settings.dueDateAttribute);
        return dueDate && dueDate.isSameOrAfter(today) && dueDate.isBefore(tomorrow);
      });
      markTasksAsAssigned(todayTodos, assignedTaskIds);
      const todayLabel = `Today\n${today.format("MMM D")}`;
      yield todoColumn("sunrise", todayLabel, todayTodos, false, moveToDate(today), batchMoveToDate(today), "today-horizon", undefined, "future");
    }

    // Render custom horizons with position "after"
    if (customHorizons) {
      for (let i = 0; i < customHorizons.length; i++) {
        if (customHorizons[i].position === "after") {
          yield* renderCustomHorizon(i);
        }
      }
    }

    let currentDate = today.clone().add(1, "days");
    const weekdaySettings = [
      { day: 1, key: "showMonday", label: "Monday" },
      { day: 2, key: "showTuesday", label: "Tuesday" },
      { day: 3, key: "showWednesday", label: "Wednesday" },
      { day: 4, key: "showThursday", label: "Thursday" },
      { day: 5, key: "showFriday", label: "Friday" },
      { day: 6, key: "showSaturday", label: "Saturday" },
      { day: 7, key: "showSunday", label: "Sunday" },
    ];

    const firstWeekday = settings.firstWeekday ?? 1;
    let endOfWeek = today.clone();
    const daysUntilNextWeekStart = (firstWeekday - endOfWeek.isoWeekday() + 7) % 7 || 7;
    endOfWeek = endOfWeek.add(daysUntilNextWeekStart, "days");

    // Helper to generate human-friendly label with date subtitle
    function formatDayLabel(date: Moment, isTomorrow: boolean): string {
      if (isTomorrow) {
        return `Tomorrow\n${date.format("MMM D")}`;
      }
      return `${date.format("dddd")}\n${date.format("MMM D")}`;
    }

    // This week's days
    let isFirstDay = true;
    while (currentDate.isBefore(endOfWeek)) {
      const weekday = currentDate.isoWeekday();
      const setting = weekdaySettings.find((s) => s.day === weekday);

      if (setting && horizonVisibility[setting.key]) {
        // Yield any inline custom horizons that fall on this day (before the builtin)
        yield* yieldInlineHorizonForDay(currentDate);

        const nextDay = currentDate.clone().add(1, "days");
        const todos = getTodosByDate(currentDate, nextDay, false, assignedTaskIds);
        markTasksAsAssigned(todos, assignedTaskIds);
        const style = getWipStyle(todos);
        const label = formatDayLabel(currentDate, isFirstDay);

        yield todoColumn(isFirstDay ? "calendar-clock" : "calendar", label, todos, hideEmpty, moveToDate(currentDate), batchMoveToDate(currentDate), style, undefined, "future");

        isFirstDay = false;
      }

      currentDate = currentDate.clone().add(1, "days");
    }

    // Next week handling
    const endOfNextWeek = endOfWeek.clone().add(7, "days");
    const nextWeekMode = horizonVisibility.nextWeekMode ?? "collapsed";
    // For rolling-week mode: only show days up to 7 days from today
    const rollingWeekEnd = today.clone().add(8, "days"); // 8 days because we check isBefore

    if (nextWeekMode === "collapsed") {
      // Single "Next week" column
      if (!isWeekOverlapping(endOfWeek, endOfNextWeek)) {
        // Yield any inline horizons that fall within this week (before the builtin)
        yield* yieldInlineHorizonsBefore(endOfNextWeek);

        const todos = getTodosByDate(endOfWeek, endOfNextWeek, false, assignedTaskIds);
        markTasksAsAssigned(todos, assignedTaskIds);
        const style = getWipStyle(todos);
        const label = `Next week\n${endOfWeek.format("MMM D")} - ${endOfNextWeek.clone().subtract(1, "days").format("MMM D")}`;
        yield todoColumn("calendar", label, todos, hideEmpty, moveToDate(endOfWeek), batchMoveToDate(endOfWeek), `${style}`, undefined, "future");
      }
      currentDate = endOfNextWeek.clone();
    } else {
      // Individual days for next week
      let nextWeekDate = endOfWeek.clone();

      while (nextWeekDate.isBefore(endOfNextWeek)) {
        const weekday = nextWeekDate.isoWeekday();
        const setting = weekdaySettings.find((s) => s.day === weekday);

        // Check if day is enabled in settings
        const isDayEnabled = setting && horizonVisibility[setting.key as keyof typeof horizonVisibility];
        // For rolling-week: also check if within 7-day rolling window
        const isWithinRollingWindow = nextWeekMode !== "rolling-week" || nextWeekDate.isBefore(rollingWeekEnd);

        const showThisDay = isDayEnabled && isWithinRollingWindow;

        if (showThisDay) {
          // Yield any inline custom horizons that fall on this day (before the builtin)
          yield* yieldInlineHorizonForDay(nextWeekDate);

          const nextDay = nextWeekDate.clone().add(1, "days");
          const todos = getTodosByDate(nextWeekDate, nextDay, false, assignedTaskIds);
          markTasksAsAssigned(todos, assignedTaskIds);
          const label = `${nextWeekDate.format("dddd")}\n${nextWeekDate.format("MMM D")}`;

          yield todoColumn("calendar", label, todos, hideEmpty, moveToDate(nextWeekDate), batchMoveToDate(nextWeekDate), undefined, undefined, "future");
        }

        nextWeekDate = nextWeekDate.clone().add(1, "days");
      }
      currentDate = endOfNextWeek.clone();
    }

    // Weeks after next (weeksToShow now counts from after next week)
    if (horizonVisibility.weeksToShow > 0) {
      let weekStart = endOfNextWeek.clone();

      for (let i = 2; i <= horizonVisibility.weeksToShow + 1; i++) {
        const weekEnd = weekStart.clone().add(1, "weeks");

        if (!isWeekOverlapping(weekStart, weekEnd)) {
          // Yield any inline horizons that fall within this week
          yield* yieldInlineHorizonsBefore(weekEnd);

          const label = `In ${i} weeks\n${weekStart.format("MMM D")} - ${weekEnd.clone().subtract(1, "days").format("MMM D")}`;
          const todos = getTodosByDate(weekStart, weekEnd, false, assignedTaskIds);
          markTasksAsAssigned(todos, assignedTaskIds);
          const style = getWipStyle(todos);
          yield todoColumn("calendar", label, todos, hideEmpty, moveToDate(weekStart), batchMoveToDate(weekStart), style, undefined, "future");
        }
        weekStart = weekEnd;
      }
      currentDate = weekStart;
    }

    if (horizonVisibility.monthsToShow > 0) {
      let monthStart = currentDate.clone().startOf("month");
      if (monthStart.isBefore(currentDate)) {
        monthStart = monthStart.add(1, "months");
      }

      for (let i = 1; i <= horizonVisibility.monthsToShow; i++) {
        const monthEnd = monthStart.clone().add(1, "months");

        if (!isMonthOverlapping(monthStart, monthEnd)) {
          // Yield any inline horizons that fall within this month
          yield* yieldInlineHorizonsBefore(monthEnd);

          // Use month name as primary label
          const label = `${monthStart.format("MMMM")}\n${monthStart.format("MMM D")} - ${monthEnd.clone().subtract(1, "days").format("MMM D")}`;
          const todos = getTodosByDate(monthStart, monthEnd, false, assignedTaskIds);
          markTasksAsAssigned(todos, assignedTaskIds);
          const style = getWipStyle(todos);
          yield todoColumn("calendar-range", label, todos, hideEmpty, moveToDate(monthStart), batchMoveToDate(monthStart), style, undefined, "future");
        }
        monthStart = monthEnd;
      }
      currentDate = monthStart;
    }

    if (horizonVisibility.showQuarters) {
      const endOfYear = today.clone().endOf("year").add(1, "days").startOf("day");

      let quarterStart = currentDate.clone().startOf("quarter");
      if (quarterStart.isBefore(currentDate)) {
        quarterStart = quarterStart.add(1, "quarters");
      }

      while (quarterStart.isBefore(endOfYear)) {
        const quarterEnd = quarterStart.clone().add(1, "quarters");

        if (!isQuarterOverlapping(quarterStart, quarterEnd)) {
          // Yield any inline horizons that fall within this quarter
          yield* yieldInlineHorizonsBefore(quarterEnd);

          const quarterNum = Math.ceil((quarterStart.month() + 1) / 3);
          const label = `Q${quarterNum} ${quarterStart.year()}\n${quarterStart.format("MMM D")} - ${quarterEnd.clone().subtract(1, "days").format("MMM D")}`;
          const todos = getTodosByDate(quarterStart, quarterEnd, false, assignedTaskIds);
          markTasksAsAssigned(todos, assignedTaskIds);
          const style = getWipStyle(todos);
          yield todoColumn("calendar-range", label, todos, hideEmpty, moveToDate(quarterStart), batchMoveToDate(quarterStart), style, undefined, "future");
        }
        quarterStart = quarterEnd;
      }
      currentDate = quarterStart;
    }

    if (horizonVisibility.showNextYear) {
      const nextYearStart = today.clone().add(1, "years").startOf("year");
      const nextYearEnd = nextYearStart.clone().add(1, "years");

      // Yield any inline horizons that fall within next year
      yield* yieldInlineHorizonsBefore(nextYearEnd);

      const label = `${nextYearStart.year()}\nNext year`;
      const todos = getTodosByDate(nextYearStart, nextYearEnd, false, assignedTaskIds);
      markTasksAsAssigned(todos, assignedTaskIds);
      yield todoColumn("calendar", label, todos, hideEmpty, moveToDate(nextYearStart), batchMoveToDate(nextYearStart), undefined, undefined, "future");
      currentDate = nextYearEnd;
    }

    if (horizonVisibility.showLater) {
      // Yield any remaining inline horizons before "Later"
      yield* yieldInlineHorizonsBefore(moment("9999-12-31"));

      const laterTodos = getTodosByDate(currentDate, null, false, assignedTaskIds);
      markTasksAsAssigned(laterTodos, assignedTaskIds);
      yield todoColumn("calendar-plus", `Later\nSomeday · ${currentDate.format("MMM D, YYYY")} and later`, laterTodos, hideEmpty, moveToDate(currentDate), batchMoveToDate(currentDate), undefined, undefined, "future");
    }

    // Render custom horizons with position "end"
    if (customHorizons) {
      for (let i = 0; i < customHorizons.length; i++) {
        if (customHorizons[i].position === "end") {
          yield* renderCustomHorizon(i);
        }
      }
    }
  }

  deps.logger.debug(`Rendering planning view`);

  const totalTasks = React.useMemo(() => {
    return filteredTodos.filter((todo) => todo.status !== TaskStatus.Complete && todo.status !== TaskStatus.Canceled).length;
  }, [filteredTodos]);

  const completedToday = React.useMemo(() => {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    const dateIsInRange = (date: Moment | null) => date && date.isSameOrAfter(today) && date.isBefore(tomorrow);
    const completedTodos = filteredTodos.filter((todo) => {
      if (todo.status !== TaskStatus.Complete) return false;
      if (!todo.attributes) return false;
      const completedDate = findTaskDate(todo, settings.completedDateAttribute);
      return dateIsInRange(completedDate);
    });
    return completedTodos.length;
  }, [filteredTodos, settings.completedDateAttribute]);

  const futureSectionRef = React.useRef<HTMLDivElement>(null);
  const scrollIntervalRef = React.useRef<number | null>(null);

  // Auto-scroll during drag
  React.useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (!futureSectionRef.current) return;

      const container = futureSectionRef.current;
      const rect = container.getBoundingClientRect();
      const scrollThreshold = 200;
      const scrollSpeed = 10;

      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }

      if (e.clientX - rect.left < scrollThreshold && e.clientX > rect.left) {
        scrollIntervalRef.current = window.setInterval(() => {
          container.scrollLeft -= scrollSpeed;
        }, 16);
      } else if (rect.right - e.clientX < scrollThreshold && e.clientX < rect.right) {
        scrollIntervalRef.current = window.setInterval(() => {
          container.scrollLeft += scrollSpeed;
        }, 16);
      }
    };

    const handleDragEnd = () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragend", handleDragEnd);
    document.addEventListener("drop", handleDragEnd);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragend", handleDragEnd);
      document.removeEventListener("drop", handleDragEnd);
    };
  }, []);

  const boardClass = `board${viewMode !== "default" ? ` mode-${viewMode}` : ""}`;

  return (
    <div className={boardClass}>
      <PlanningSettingsComponent
        planningSettings={planningSettings}
        setPlanningSettings={setPlanningSettings}
        showIgnored={showIgnored}
        setShowIgnored={setShowIgnored}
        totalTasks={totalTasks}
        completedToday={completedToday}
        app={app}
        onRefresh={onRefresh}
        onOpenReport={onOpenReport}
        onQuickAdd={onQuickAdd}
      />
      {viewMode !== "future" && (
        <div className="today-section">
          <div className="header">
            <span
              className="icon"
              ref={(node) => {
                if (node) {
                  node.replaceChildren();
                  setIcon(node, "sun");
                }
              }}
            />
            <span>Today</span>
          </div>
          <div className="columns">{Array.from(getTodayColumns())}</div>
        </div>
      )}
      {viewMode !== "today" && (
        <div className="future-section" ref={futureSectionRef}>
          {Array.from(getColumns())}
        </div>
      )}
      {settings.undo.showUndoToast && <UndoToastContainer toast={undoToast} onUndo={() => void handleUndo()} onDismiss={() => setUndoToast(null)} durationMs={settings.undo.undoToastDurationMs} />}
    </div>
  );
}

export function mountPlanningComponent(onElement: HTMLElement, props: PlanningComponentProps) {
  onElement.addClass("task-planner");
  const client = createRoot(onElement);
  client.render(<PlanningComponent {...props}></PlanningComponent>);
}
