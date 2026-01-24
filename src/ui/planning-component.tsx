import { createRoot } from "react-dom/client";

import { App, TFile, setIcon } from "obsidian";

import * as React from "react";

import { PlanningSettingsComponent } from "./planning-settings-component";
import { PlanningSettingsStore } from "./planning-settings-store";
import { PlanningTodoColumn, ColumnType, ColumnHeaderAction } from "./planning-todo-column";
import { UndoToastContainer } from "./undo-toast";
import { TodoIndex } from "../core/index/todo-index";
import { TodoMatcher } from "../core/matchers/todo-matcher";
import { FileOperations } from "../core/operations/file-operations";
import { UndoManager } from "../core/operations/undo-manager";
import { UndoableFileOperations } from "../core/operations/undoable-file-ops";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { TodoItem, TodoStatus, getTodoId } from "../types/todo";
import { moment, Moment } from "../utils/moment";
import { findTodoDate } from "../utils/todo-utils";

export interface PlanningComponentDeps {
  logger: Logger;
  todoIndex: TodoIndex<TFile>;
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
  const [todos, setTodos] = React.useState<TodoItem<TFile>[]>(deps.todoIndex.todos);

  // Define findTodo early so it can be used by undo handler
  const findTodo = React.useCallback(
    (todoId: string): TodoItem<TFile> | undefined => {
      function searchRecursive(items: TodoItem<TFile>[]): TodoItem<TFile> | undefined {
        for (const todo of items) {
          if (getTodoId(todo) === todoId) {
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
  const { searchParameters, hideEmpty, hideDone, showIgnored, wipLimit, viewMode } = planningSettings;
  const fileOperations = new FileOperations(settings);

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
    const result: TodoItem<TFile>[] = [];
    const subtasksWithDates = new Set<TodoItem<TFile>>();

    // First pass: identify subtasks that have their own due dates
    function collectDatedSubtasks(todo: TodoItem<TFile>) {
      if (todo.subtasks) {
        for (const subtask of todo.subtasks) {
          const subtaskDate = findTodoDate(subtask, settings.dueDateAttribute);
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
    const filter = new TodoMatcher(searchParameters.searchPhrase, settings.fuzzySearch);
    return flattenedTodos.todos.filter((todo) => {
      // Filter out ignored tasks unless showIgnored is enabled
      if (!showIgnored) {
        const isIgnored = todo.attributes?.["ignore"] === true || todo.attributes?.["ignore"] === "true";
        if (isIgnored) return false;
      }
      return filter.matches(todo);
    });
  }, [flattenedTodos.todos, searchParameters.searchPhrase, settings.fuzzySearch, showIgnored]);

  // Set of subtask IDs that have their own dates (to hide from parent's subtask list)
  const promotedSubtaskIds = React.useMemo(() => {
    return new Set(Array.from(flattenedTodos.subtasksWithDates).map((t) => getTodoId(t)));
  }, [flattenedTodos.subtasksWithDates]);

  React.useEffect(() => {
    const unsubscribe = deps.todoIndex.onUpdateEvent.listen((todos) => {
      setTodos(todos);
      return Promise.resolve();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [deps.todoIndex]);

  function getTodosByDate(from: Moment | null, to: Moment | null, includeSelected: boolean = false, excludeIds?: Set<string>): TodoItem<TFile>[] {
    const dateIsInRange = (date: Moment | null) => date && (from === null || date.isSameOrAfter(from)) && (to === null || date.isBefore(to));
    function todoInRange<T>(todo: TodoItem<T>) {
      const isDone = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
      const isSelected = todo.attributes && !!todo.attributes[settings.selectedAttribute];
      const dueDate = findTodoDate(todo, settings.dueDateAttribute);
      const completedDate = findTodoDate(todo, settings.completedDateAttribute);
      const dueDateIsInRange = dateIsInRange(dueDate);
      const completedDateIsInRange = dateIsInRange(completedDate);

      if (isDone) {
        // Show completed tasks if completed in date range (for Done column)
        return completedDateIsInRange;
      }

      const isInRangeOrSelected = dueDateIsInRange || (includeSelected && isSelected);
      return isInRangeOrSelected;
    }
    const todosInRange = filteredTodos.filter((todo) => {
      if (excludeIds && excludeIds.has(getTodoId(todo))) return false;
      return todo.attributes && todoInRange(todo);
    });
    return todosInRange;
  }

  function getTodosWithNoDate(excludeIds?: Set<string>): TodoItem<TFile>[] {
    return filteredTodos.filter((todo) => {
      if (excludeIds && excludeIds.has(getTodoId(todo))) return false;
      return !findTodoDate(todo, settings.dueDateAttribute) && todo.attributes && !todo.attributes[settings.selectedAttribute] && todo.status !== TodoStatus.Canceled && todo.status !== TodoStatus.Complete;
    });
  }

  // Helper to un-complete a task if it's currently done
  async function _ensureNotCompleted(todo: TodoItem<TFile>) {
    if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) {
      todo.status = TodoStatus.Todo;
      await fileOperations.updateTodoStatus(todo, settings.completedDateAttribute);
    }
  }

  // Helper to batch un-complete tasks
  async function _batchEnsureNotCompleted(todos: TodoItem<TFile>[]) {
    const completedTodos = todos.filter((todo) => todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled);
    if (completedTodos.length > 0) {
      completedTodos.forEach((todo) => (todo.status = TodoStatus.Todo));
      await fileOperations.batchUpdateTodoStatus(completedTodos, settings.completedDateAttribute);
    }
  }
  // Silence unused function warnings (reserved for future use)
  void _ensureNotCompleted;
  void _batchEnsureNotCompleted;

  function getDateLabel(date: Moment): string {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    if (date.isSame(today, "day")) return "Today";
    if (date.isSame(tomorrow, "day")) return "Tomorrow";
    return date.format("MMM D");
  }

  // Get custom horizon tags that should be removed when moving to a builtin horizon
  // This ensures tasks can be moved OUT of custom horizons into builtin horizons
  function getCustomHorizonTagsToRemove(todos: TodoItem<TFile>[]): string[] {
    if (!settings.customHorizons || settings.customHorizons.length === 0) return [];

    const tagsToRemove: string[] = [];

    for (const horizon of settings.customHorizons) {
      const horizonTag = horizon.tag;
      if (!horizonTag) continue;

      // If any todo has this custom horizon's tag, it should be removed
      // so the task moves from the custom horizon to the builtin
      const todoHasTag = todos.some((todo) => todo.tags?.includes(horizonTag));
      if (todoHasTag) {
        tagsToRemove.push(horizonTag);
      }
    }

    return tagsToRemove;
  }

  function moveToDate(date: Moment) {
    return (todoId: string) => {
      const todo = findTodo(todoId);
      const dateStr = date.format("YYYY-MM-DD");
      deps.logger.debug(`Moving ${todoId} to ${dateStr}`);
      if (!todo) {
        deps.logger.warn(`Todo ${todoId} not found, couldn't move`);
        return;
      }
      const tagsToRemove = getCustomHorizonTagsToRemove([todo]);
      const description = UndoManager.createMoveDescription(1, getDateLabel(date));
      void undoableFileOps.combinedMoveWithUndo([todo], settings.dueDateAttribute, dateStr, undefined, undefined, description, tagsToRemove);
    };
  }

  function batchMoveToDate(date: Moment) {
    return async (todoIds: string[]) => {
      const foundTodos = todoIds.map((id) => findTodo(id)).filter((todo): todo is TodoItem<TFile> => todo !== undefined);
      if (foundTodos.length === 0) {
        deps.logger.warn(`No todos found for batch move`);
        return;
      }
      const dateStr = date.format("YYYY-MM-DD");
      deps.logger.debug(`Batch moving ${foundTodos.length} todos to ${dateStr}`);
      const tagsToRemove = getCustomHorizonTagsToRemove(foundTodos);
      const description = UndoManager.createMoveDescription(foundTodos.length, getDateLabel(date));
      await undoableFileOps.combinedMoveWithUndo(foundTodos, settings.dueDateAttribute, dateStr, undefined, undefined, description, tagsToRemove);
    };
  }

  function moveToDateAndTag(date: Moment, tag: string) {
    return (todoId: string) => {
      const todo = findTodo(todoId);
      const dateStr = date.format("YYYY-MM-DD");
      deps.logger.debug(`Moving ${todoId} to ${dateStr} with tag #${tag}`);
      if (!todo) {
        deps.logger.warn(`Todo ${todoId} not found, couldn't move`);
        return;
      }
      const description = UndoManager.createMoveDescription(1, `${getDateLabel(date)} (#${tag})`);
      void undoableFileOps.combinedMoveWithUndo([todo], settings.dueDateAttribute, dateStr, tag, undefined, description);
    };
  }

  function batchMoveToDateAndTag(date: Moment, tag: string) {
    return async (todoIds: string[]) => {
      const foundTodos = todoIds.map((id) => findTodo(id)).filter((todo): todo is TodoItem<TFile> => todo !== undefined);
      if (foundTodos.length === 0) {
        deps.logger.warn(`No todos found for batch move`);
        return;
      }
      const dateStr = date.format("YYYY-MM-DD");
      deps.logger.debug(`Batch moving ${foundTodos.length} todos to ${dateStr} with tag #${tag}`);
      const description = UndoManager.createMoveDescription(foundTodos.length, `${getDateLabel(date)} (#${tag})`);
      await undoableFileOps.combinedMoveWithUndo(foundTodos, settings.dueDateAttribute, dateStr, tag, undefined, description);
    };
  }

  function removeDate() {
    return (todoId: string) => {
      const todo = findTodo(todoId);
      if (!todo) {
        return;
      }
      const description = UndoManager.createMoveDescription(1, "Backlog");
      void undoableFileOps.batchRemoveAttributeWithUndo([todo], settings.dueDateAttribute, description);
    };
  }

  function batchRemoveDate() {
    return async (todoIds: string[]) => {
      const foundTodos = todoIds.map((id) => findTodo(id)).filter((todo): todo is TodoItem<TFile> => todo !== undefined);
      if (foundTodos.length === 0) return;
      deps.logger.debug(`Batch removing date from ${foundTodos.length} todos`);
      const description = UndoManager.createMoveDescription(foundTodos.length, "Backlog");
      await undoableFileOps.batchRemoveAttributeWithUndo(foundTodos, settings.dueDateAttribute, description);
    };
  }

  function getStatusLabel(status: TodoStatus): string {
    switch (status) {
      case TodoStatus.Todo:
        return "Todo";
      case TodoStatus.InProgress:
        return "In Progress";
      case TodoStatus.Complete:
        return "Done";
      case TodoStatus.Canceled:
        return "Canceled";
      case TodoStatus.Delegated:
        return "Delegated";
      case TodoStatus.AttentionRequired:
        return "Attention Required";
      default:
        return "Unknown";
    }
  }

  function moveToDateAndStatus(date: Moment, status: TodoStatus) {
    return (todoId: string) => {
      const todo = findTodo(todoId);
      const dateStr = date.format("YYYY-MM-DD");
      deps.logger.debug(`Moving ${todoId} to ${dateStr}`);
      if (!todo) {
        deps.logger.warn(`Todo ${todoId} not found, couldn't move`);
        return;
      }
      const description = UndoManager.createMoveDescription(1, `${getDateLabel(date)} (${getStatusLabel(status)})`);
      void undoableFileOps.combinedMoveWithUndo([todo], settings.dueDateAttribute, dateStr, undefined, status, description);
    };
  }

  function batchMoveToDateAndStatus(date: Moment, status: TodoStatus) {
    return async (todoIds: string[]) => {
      const foundTodos = todoIds.map((id) => findTodo(id)).filter((todo): todo is TodoItem<TFile> => todo !== undefined);
      if (foundTodos.length === 0) {
        deps.logger.warn(`No todos found for batch move`);
        return;
      }
      const dateStr = date.format("YYYY-MM-DD");
      deps.logger.debug(`Batch moving ${foundTodos.length} todos to ${dateStr} with status ${status}`);
      const description = UndoManager.createMoveDescription(foundTodos.length, `${getDateLabel(date)} (${getStatusLabel(status)})`);
      await undoableFileOps.combinedMoveWithUndo(foundTodos, settings.dueDateAttribute, dateStr, undefined, status, description);
    };
  }

  function getTodosByDateAndStatus(from: Moment, to: Moment, status: TodoStatus[]) {
    const todos = getTodosByDate(from, to, true);
    return todos.filter((todo) => status.includes(todo.status));
  }

  function todoColumn(
    icon: string,
    title: string,
    todos: TodoItem<TFile>[],
    hideIfEmpty = hideEmpty,
    onTodoDropped: ((todoId: string) => void) | null = null,
    onBatchTodoDropped?: ((todoIds: string[]) => Promise<void>) | null,
    substyle?: string,
    customColor?: string,
    columnType?: ColumnType,
    headerActions?: ColumnHeaderAction[]
  ) {
    return (
      <PlanningTodoColumn
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
        customColor={customColor as Parameters<typeof PlanningTodoColumn>[0]["customColor"]}
        columnType={columnType}
        headerActions={headerActions}
      />
    );
  }

  function* getTodayColumns() {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    const columnCount = hideDone ? 2 : 3;

    yield todoColumn("circle", "Todo\nNot started", getTodosByDateAndStatus(today, tomorrow, [TodoStatus.Todo]), false, moveToDateAndStatus(today, TodoStatus.Todo), batchMoveToDateAndStatus(today, TodoStatus.Todo), `today cols-${columnCount}`, undefined, "today-todo");

    yield todoColumn(
      "clock",
      "In Progress\nWorking on",
      getTodosByDateAndStatus(today, tomorrow, [TodoStatus.AttentionRequired, TodoStatus.Delegated, TodoStatus.InProgress]),
      false,
      moveToDateAndStatus(today, TodoStatus.InProgress),
      batchMoveToDateAndStatus(today, TodoStatus.InProgress),
      `today cols-${columnCount}`,
      undefined,
      "today-in-progress"
    );

    if (!hideDone) {
      yield todoColumn(
        "check-circle",
        "Completed\nDone today",
        getTodosByDateAndStatus(today, tomorrow, [TodoStatus.Canceled, TodoStatus.Complete]),
        false,
        moveToDateAndStatus(today, TodoStatus.Complete),
        batchMoveToDateAndStatus(today, TodoStatus.Complete),
        `today cols-${columnCount} done`,
        undefined,
        "today-done"
      );
    }
  }

  function getWipStyle(todos: TodoItem<TFile>[]) {
    if (wipLimit.isLimited) {
      if (todos.length > wipLimit.dailyLimit) {
        return "wip-exceeded";
      }
    }
    return "";
  }

  function getOverdueTodos(excludeIds?: Set<string>): TodoItem<TFile>[] {
    const today = moment().startOf("day");
    return filteredTodos.filter((todo) => {
      if (excludeIds && excludeIds.has(getTodoId(todo))) return false;
      if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) {
        return false;
      }
      const dueDate = findTodoDate(todo, settings.dueDateAttribute);
      return dueDate && dueDate.isBefore(today);
    });
  }

  function getCustomDateHorizonTodos(targetDate: string, tag?: string, excludeIds?: Set<string>): TodoItem<TFile>[] {
    const target = moment(targetDate);
    if (!target.isValid()) return [];

    const start = target.startOf("day");
    const end = start.clone().add(1, "days");
    const todos = getTodosByDate(start, end, false, excludeIds);

    // If a tag is specified, only include tasks that have that tag
    if (tag) {
      return todos.filter((todo) => todo.tags?.includes(tag));
    }

    return todos;
  }

  function* getColumns() {
    const { horizonVisibility, customHorizons } = settings;

    const today = moment().startOf("day");

    // Track assigned task IDs to prevent duplicates across horizons
    // Custom horizons have highest priority, then standard horizons in order
    const assignedTaskIds = new Set<string>();

    // Helper to add todos to the exclusion set
    function markTasksAsAssigned(todos: TodoItem<TFile>[]) {
      for (const todo of todos) {
        assignedTaskIds.add(getTodoId(todo));
      }
    }

    // PRE-CLAIM: Custom horizons have priority over builtins.
    // Calculate and claim their tasks FIRST, before any builtin processing.
    const customHorizonTodos = new Map<number, TodoItem<TFile>[]>();
    if (customHorizons) {
      for (let i = 0; i < customHorizons.length; i++) {
        const horizon = customHorizons[i];
        // Get todos matching this custom horizon (respects earlier custom horizon claims)
        const todos = getCustomDateHorizonTodos(horizon.date, horizon.tag, assignedTaskIds);
        customHorizonTodos.set(i, todos);
        markTasksAsAssigned(todos); // Pre-claim these tasks
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
      markTasksAsAssigned(backlogTodos);
      yield todoColumn("inbox", "Backlog\nNo due date", backlogTodos, false, removeDate(), batchRemoveDate(), "backlog", undefined, "backlog");
    }

    if (horizonVisibility.showOverdue || horizonVisibility.showPast) {
      const overdueTodos = getOverdueTodos(assignedTaskIds);
      markTasksAsAssigned(overdueTodos);
      const overdueHeaderActions: ColumnHeaderAction[] = [
        {
          icon: "calendar-check",
          label: "Reschedule all to Today",
          onClick: () => {
            const todoIds = overdueTodos.map((todo) => getTodoId(todo));
            void batchMoveToDate(today)(todoIds);
          },
        },
        {
          icon: "inbox",
          label: "Move all to Backlog",
          onClick: () => {
            const todoIds = overdueTodos.map((todo) => getTodoId(todo));
            void batchRemoveDate()(todoIds);
          },
        },
      ];
      yield todoColumn("alert-triangle", "Overdue\nBefore today", overdueTodos, true, null, null, "overdue", undefined, "overdue", overdueHeaderActions);
    }

    if (viewMode === "future") {
      const tomorrow = today.clone().add(1, "day");
      const todayTodos = filteredTodos.filter((todo) => {
        if (assignedTaskIds.has(getTodoId(todo))) return false;
        if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) return false;
        const dueDate = findTodoDate(todo, settings.dueDateAttribute);
        return dueDate && dueDate.isSameOrAfter(today) && dueDate.isBefore(tomorrow);
      });
      markTasksAsAssigned(todayTodos);
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
        markTasksAsAssigned(todos);
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
        markTasksAsAssigned(todos);
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
          markTasksAsAssigned(todos);
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
          markTasksAsAssigned(todos);
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
          markTasksAsAssigned(todos);
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
          markTasksAsAssigned(todos);
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
      markTasksAsAssigned(todos);
      yield todoColumn("calendar", label, todos, hideEmpty, moveToDate(nextYearStart), batchMoveToDate(nextYearStart), undefined, undefined, "future");
      currentDate = nextYearEnd;
    }

    if (horizonVisibility.showLater) {
      // Yield any remaining inline horizons before "Later"
      yield* yieldInlineHorizonsBefore(moment("9999-12-31"));

      const laterTodos = getTodosByDate(currentDate, null, false, assignedTaskIds);
      markTasksAsAssigned(laterTodos);
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
    return filteredTodos.filter((todo) => todo.status !== TodoStatus.Complete && todo.status !== TodoStatus.Canceled).length;
  }, [filteredTodos]);

  const completedToday = React.useMemo(() => {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    const dateIsInRange = (date: Moment | null) => date && date.isSameOrAfter(today) && date.isBefore(tomorrow);
    const completedTodos = filteredTodos.filter((todo) => {
      if (todo.status !== TodoStatus.Complete) return false;
      if (!todo.attributes) return false;
      const completedDate = findTodoDate(todo, settings.completedDateAttribute);
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

  const boardClass = viewMode !== "default" ? `board mode-${viewMode}` : "board";

  return (
    <div className={boardClass}>
      <PlanningSettingsComponent planningSettings={planningSettings} setPlanningSettings={setPlanningSettings} totalTasks={totalTasks} completedToday={completedToday} app={app} onRefresh={onRefresh} onOpenReport={onOpenReport} onQuickAdd={onQuickAdd} />
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
        <div className="future" ref={futureSectionRef}>
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
