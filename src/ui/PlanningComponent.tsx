import * as React from "react";
import { createRoot } from "react-dom/client";
import { TodoItem, TodoStatus, getTodoId } from "../types/todo";
import { Logger } from "../types/logger";
import { App, TFile } from "obsidian";
import { moment, Moment } from "../utils/moment";
import { TodoIndex } from "../core/index/todo-index";
import { FileOperations } from "../core/operations/file-operations";
import { TaskPlannerSettings } from "../settings/types";
import { PlanningSettingsComponent } from "./PlanningSettingsComponent";
import { PlanningTodoColumn } from "./PlanningTodoColumn";
import { TodoMatcher } from "../core/matchers/todo-matcher";
import { PlanningSettingsStore } from "./PlanningSettingsStore";

function findTodoDate<T>(todo: TodoItem<T>, attribute: string): Moment | null {
  if (!todo.attributes) {
    return null;
  }
  const attr = todo.attributes[attribute];
  if (attr) {
    const d = moment(`${todo.attributes[attribute]}`);
    return d.isValid() ? d : null;
  }
  return null;
}

export interface PlanningComponentDeps {
  logger: Logger;
  todoIndex: TodoIndex<TFile>;
}

export interface PlanningComponentProps {
  deps: PlanningComponentDeps;
  settings: TaskPlannerSettings;
  app: App;
  onRefresh?: () => void;
  onOpenReport?: () => void;
}

export function PlanningComponent({ deps, settings, app, onRefresh, onOpenReport }: PlanningComponentProps) {
  const settingsStore = React.useMemo(() => new PlanningSettingsStore(app), [app]);
  const savedSettings = React.useMemo(() => settingsStore.getSettings(), [settingsStore]);
  const [planningSettings, setPlanningSettingsState] = React.useState(savedSettings);
  const [todos, setTodos] = React.useState<TodoItem<TFile>[]>(deps.todoIndex.todos);
  const setPlanningSettings = React.useMemo(() => settingsStore.decorateSetterWithSaveSettings(setPlanningSettingsState), [settingsStore, setPlanningSettingsState]);
  const { searchParameters, hideEmpty, hideDone, wipLimit, viewMode } = planningSettings;
  const fileOperations = new FileOperations(settings);

  const filteredTodos = React.useMemo(() => {
    const filter = new TodoMatcher(searchParameters.searchPhrase, settings.fuzzySearch);
    return todos.filter((todo) => filter.matches(todo));
  }, [todos, searchParameters.searchPhrase, settings.fuzzySearch]);

  React.useEffect(() => {
    const unsubscribe = deps.todoIndex.onUpdateEvent.listen((todos) => {
      setTodos(todos);
      return Promise.resolve();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [deps.todoIndex]);

  function getTodosByDate(from: Moment | null, to: Moment | null, includeSelected: boolean = false): TodoItem<TFile>[] {
    const dateIsInRange = (date: Moment | null) => date && (from === null || date.isSameOrAfter(from)) && (to === null || date.isBefore(to));
    function todoInRange<T>(todo: TodoItem<T>) {
      const isDone = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
      const isSelected = todo.attributes && !!todo.attributes[settings.selectedAttribute];
      const dueDate = findTodoDate(todo, settings.dueDateAttribute);
      const completedDate = findTodoDate(todo, settings.completedDateAttribute);
      const dueDateIsInRange = dateIsInRange(dueDate);
      const completedDateIsInRange = dateIsInRange(completedDate);

      // For completed tasks:
      // - Only show in Today's Done if completed today (handled by includeSelected + completedDate check)
      // - Don't show in any other horizon based on dueDate
      if (isDone) {
        return includeSelected && isSelected && completedDateIsInRange;
      }

      // For incomplete tasks, show if dueDate is in range or if selected
      const isInRangeOrSelected = dueDateIsInRange || (includeSelected && isSelected);
      return isInRangeOrSelected;
    }
    const todosInRange = filteredTodos.filter((todo) => todo.attributes && todoInRange(todo) && !isInCustomTagHorizon(todo));
    return todosInRange;
  }

  function getTodosWithNoDate(): TodoItem<TFile>[] {
    return filteredTodos.filter((todo) => !findTodoDate(todo, settings.dueDateAttribute) && todo.attributes && !todo.attributes[settings.selectedAttribute] && todo.status !== TodoStatus.Canceled && todo.status !== TodoStatus.Complete && !isInCustomTagHorizon(todo));
  }

  function findTodo(todoId: string): TodoItem<TFile> | undefined {
    return todos.find((todo) => getTodoId(todo) === todoId);
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
      void fileOperations.updateAttributeAsync(todo, settings.dueDateAttribute, dateStr);
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
      await fileOperations.batchUpdateAttributeAsync(foundTodos, settings.dueDateAttribute, dateStr);
    };
  }

  function removeDate() {
    return (todoId: string) => {
      const todo = findTodo(todoId);
      if (!todo) {
        return;
      }
      void fileOperations.removeAttributeAsync(todo, settings.dueDateAttribute);
    };
  }

  function batchRemoveDate() {
    return async (todoIds: string[]) => {
      const foundTodos = todoIds.map((id) => findTodo(id)).filter((todo): todo is TodoItem<TFile> => todo !== undefined);
      if (foundTodos.length === 0) return;
      deps.logger.debug(`Batch removing date from ${foundTodos.length} todos`);
      await fileOperations.batchRemoveAttributeAsync(foundTodos, settings.dueDateAttribute);
    };
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
      todo.status = status;
      void fileOperations.updateAttributeAsync(todo, settings.dueDateAttribute, dateStr).then(() => {
        void fileOperations.updateTodoStatus(todo, settings.completedDateAttribute);
      });
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

      // Update status in memory
      foundTodos.forEach((todo) => (todo.status = status));

      // Batch update date attribute
      await fileOperations.batchUpdateAttributeAsync(foundTodos, settings.dueDateAttribute, dateStr);

      // Batch update status
      await fileOperations.batchUpdateTodoStatusAsync(foundTodos, settings.completedDateAttribute);
    };
  }

  function getTodosByDateAndStatus(from: Moment, to: Moment, status: TodoStatus[]) {
    const todos = getTodosByDate(from, to, true);
    return todos.filter((todo) => status.includes(todo.status));
  }

  function todoColumn(icon: string, title: string, todos: TodoItem<TFile>[], hideIfEmpty = hideEmpty, onTodoDropped: ((todoId: string) => void) | null = null, onBatchTodoDropped?: ((todoIds: string[]) => Promise<void>) | null, substyle?: string) {
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
        }}
        substyle={substyle}
      />
    );
  }

  function* getTodayColumns() {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    const columnCount = hideDone ? 2 : 3;

    yield todoColumn("circle", "Todo", getTodosByDateAndStatus(today, tomorrow, [TodoStatus.Todo]), false, moveToDateAndStatus(today, TodoStatus.Todo), batchMoveToDateAndStatus(today, TodoStatus.Todo), `today cols-${columnCount}`);

    yield todoColumn(
      "clock",
      "In progress",
      getTodosByDateAndStatus(today, tomorrow, [TodoStatus.AttentionRequired, TodoStatus.Delegated, TodoStatus.InProgress]),
      false,
      moveToDateAndStatus(today, TodoStatus.InProgress),
      batchMoveToDateAndStatus(today, TodoStatus.InProgress),
      `today cols-${columnCount}`
    );

    if (!hideDone) {
      yield todoColumn("check-circle", "Done", getTodosByDateAndStatus(today, tomorrow, [TodoStatus.Canceled, TodoStatus.Complete]), false, moveToDateAndStatus(today, TodoStatus.Complete), batchMoveToDateAndStatus(today, TodoStatus.Complete), `today cols-${columnCount} done`);
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

  function getCustomHorizonTodos(tag: string): TodoItem<TFile>[] {
    return filteredTodos.filter((todo) => todo.tags?.includes(tag) ?? false);
  }

  function isInCustomTagHorizon(todo: TodoItem<TFile>): boolean {
    if (!settings.customHorizons) return false;
    const customTagHorizons = settings.customHorizons.filter((b) => b.tag);
    if (customTagHorizons.length === 0) return false;
    if (!todo.tags || todo.tags.length === 0) return false;
    return customTagHorizons.some((h) => h.tag && todo.tags?.includes(h.tag));
  }

  function getOverdueTodos(): TodoItem<TFile>[] {
    const today = moment().startOf("day");
    return filteredTodos.filter((todo) => {
      if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) {
        return false;
      }
      if (isInCustomTagHorizon(todo)) {
        return false;
      }
      const dueDate = findTodoDate(todo, settings.dueDateAttribute);
      return dueDate && dueDate.isBefore(today);
    });
  }

  function getCustomDateHorizonTodos(targetDate: string): TodoItem<TFile>[] {
    const target = moment(targetDate);
    if (!target.isValid()) return [];

    const start = target.startOf("day");
    const end = start.clone().add(1, "days");
    // getTodosByDate already filters out custom tag horizon todos
    return getTodosByDate(start, end);
  }

  function* getColumns() {
    const { horizonVisibility, customHorizons } = settings;

    const today = moment().startOf("day");

    // Pre-calculate larger horizon ranges to prevent overlaps
    const monthHorizonRanges: Array<{ start: Moment; end: Moment }> = [];
    const quarterHorizonRanges: Array<{ start: Moment; end: Moment }> = [];
    const yearHorizonRanges: Array<{ start: Moment; end: Moment }> = [];

    // Calculate month horizon ranges - we need to start from where weeks will end
    // to properly calculate overlaps
    let monthCalcStart = today.clone().add(1, "days");

    // Calculate where currentDate will be after week horizons
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

    // Calculate quarter horizon ranges - start from where months will end
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

    // Calculate next year horizon range - only if it starts next year
    if (horizonVisibility.showNextYear) {
      const nextYearStart = today.clone().add(1, "years").startOf("year");
      const nextYearEnd = nextYearStart.clone().add(1, "years");
      // Only add if the next year is actually in the future (not already covered by months/quarters)
      if (nextYearStart.year() > today.year()) {
        yearHorizonRanges.push({ start: nextYearStart, end: nextYearEnd });
      }
    }

    // Check if a week horizon overlaps with month/quarter/year horizons
    function isWeekOverlapping(start: Moment, end: Moment): boolean {
      const allLarger = [...monthHorizonRanges, ...quarterHorizonRanges, ...yearHorizonRanges];
      return allLarger.some((horizon) => start.isSameOrAfter(horizon.start) && end.isSameOrBefore(horizon.end));
    }

    // Check if a month horizon overlaps with quarter/year horizons
    function isMonthOverlapping(start: Moment, end: Moment): boolean {
      const allLarger = [...quarterHorizonRanges, ...yearHorizonRanges];
      return allLarger.some((horizon) => start.isSameOrAfter(horizon.start) && end.isSameOrBefore(horizon.end));
    }

    // Check if a quarter horizon overlaps with year horizons
    function isQuarterOverlapping(start: Moment, end: Moment): boolean {
      return yearHorizonRanges.some((horizon) => start.isSameOrAfter(horizon.start) && end.isSameOrBefore(horizon.end));
    }

    // Custom horizons with position "before" (before backlog)
    if (customHorizons) {
      for (const horizon of customHorizons.filter((b) => b.position === "before")) {
        if (horizon.tag) {
          yield todoColumn("tag", horizon.label, getCustomHorizonTodos(horizon.tag), hideEmpty, null, null);
        } else if (horizon.date) {
          const horizonDate = moment(horizon.date);
          yield todoColumn("calendar-days", horizon.label, getCustomDateHorizonTodos(horizon.date), hideEmpty, moveToDate(horizonDate), batchMoveToDate(horizonDate));
        }
      }
    }

    if (horizonVisibility.showBacklog) {
      yield todoColumn("inbox", "Backlog", getTodosWithNoDate(), false, removeDate(), batchRemoveDate(), "backlog");
    }

    // Show overdue tasks (past due date, not completed)
    // Note: showPast and showOverdue both showed the same thing, so we consolidated to just Overdue
    if (horizonVisibility.showOverdue || horizonVisibility.showPast) {
      yield todoColumn("alert-triangle", "Overdue", getOverdueTodos(), true, null, null, "overdue");
    }

    // In Future Focus mode, show a "Today" horizon for today's tasks
    if (viewMode === "future") {
      const tomorrow = today.clone().add(1, "day");
      const todayTodos = filteredTodos.filter((todo) => {
        if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) return false;
        if (isInCustomTagHorizon(todo)) return false;
        const dueDate = findTodoDate(todo, settings.dueDateAttribute);
        return dueDate && dueDate.isSameOrAfter(today) && dueDate.isBefore(tomorrow);
      });
      yield todoColumn("sunrise", "Today", todayTodos, false, moveToDate(today), batchMoveToDate(today), "today-horizon");
    }

    // Custom horizons with position "after" (after backlog, before time horizons)
    if (customHorizons) {
      for (const horizon of customHorizons.filter((b) => b.position === "after")) {
        if (horizon.tag) {
          yield todoColumn("tag", horizon.label, getCustomHorizonTodos(horizon.tag), hideEmpty, null, null);
        } else if (horizon.date) {
          const horizonDate = moment(horizon.date);
          yield todoColumn("calendar-days", horizon.label, getCustomDateHorizonTodos(horizon.date), hideEmpty, moveToDate(horizonDate), batchMoveToDate(horizonDate));
        }
      }
    }

    // Individual weekdays (Monday through Sunday) - only until end of current week
    let currentDate = today.clone().add(1, "days"); // Start from tomorrow
    const weekdaySettings = [
      { day: 1, key: "showMonday", label: "Monday" },
      { day: 2, key: "showTuesday", label: "Tuesday" },
      { day: 3, key: "showWednesday", label: "Wednesday" },
      { day: 4, key: "showThursday", label: "Thursday" },
      { day: 5, key: "showFriday", label: "Friday" },
      { day: 6, key: "showSaturday", label: "Saturday" },
      { day: 7, key: "showSunday", label: "Sunday" },
    ];

    // Calculate end of current week based on firstWeekday setting
    const firstWeekday = settings.firstWeekday ?? 1;
    let endOfWeek = today.clone();
    const daysUntilNextWeekStart = (firstWeekday - endOfWeek.isoWeekday() + 7) % 7 || 7;
    endOfWeek = endOfWeek.add(daysUntilNextWeekStart, "days");

    // Show selected weekdays only until end of current week
    let isFirstDay = true;
    while (currentDate.isBefore(endOfWeek)) {
      const weekday = currentDate.isoWeekday();
      const setting = weekdaySettings.find((s) => s.day === weekday);

      if (setting && horizonVisibility[setting.key]) {
        const nextDay = currentDate.clone().add(1, "days");
        const todos = getTodosByDate(currentDate, nextDay);
        const style = getWipStyle(todos);
        const label = isFirstDay ? "Tomorrow" : currentDate.format("dddd DD/MM");

        yield todoColumn(isFirstDay ? "calendar-clock" : "calendar", label, todos, hideEmpty, moveToDate(currentDate), batchMoveToDate(currentDate), style);

        isFirstDay = false;
      }

      currentDate = currentDate.clone().add(1, "days");
    }

    // Week horizons - start from the calculated endOfWeek (start of next week)
    if (horizonVisibility.weeksToShow > 0) {
      let weekStart = endOfWeek.clone(); // Already calculated as start of next week

      for (let i = 1; i <= horizonVisibility.weeksToShow; i++) {
        const weekEnd = weekStart.clone().add(1, "weeks");

        // Skip this week if it's entirely contained within a larger horizon (month/quarter/year)
        if (!isWeekOverlapping(weekStart, weekEnd)) {
          const label = `Week +${i} (${weekStart.format("DD/MM")} - ${weekEnd.clone().subtract(1, "days").format("DD/MM")})`;
          const todos = getTodosByDate(weekStart, weekEnd);
          const style = getWipStyle(todos);
          yield todoColumn("calendar", label, todos, hideEmpty, moveToDate(weekStart), batchMoveToDate(weekStart), style);
        }
        weekStart = weekEnd;
      }
      currentDate = weekStart;
    } else {
      currentDate = endOfWeek.clone();
    }

    // Month horizons
    if (horizonVisibility.monthsToShow > 0) {
      // Snap to start of next month
      let monthStart = currentDate.clone().startOf("month");
      if (monthStart.isBefore(currentDate)) {
        monthStart = monthStart.add(1, "months");
      }

      for (let i = 1; i <= horizonVisibility.monthsToShow; i++) {
        const monthEnd = monthStart.clone().add(1, "months");

        // Skip this month if it's entirely contained within a larger horizon (quarter/year)
        if (!isMonthOverlapping(monthStart, monthEnd)) {
          const label = `Month +${i} (${monthStart.format("MMM DD")} - ${monthEnd.clone().subtract(1, "days").format("MMM DD")})`;
          const todos = getTodosByDate(monthStart, monthEnd);
          const style = getWipStyle(todos);
          yield todoColumn("calendar-range", label, todos, hideEmpty, moveToDate(monthStart), batchMoveToDate(monthStart), style);
        }
        monthStart = monthEnd;
      }
      currentDate = monthStart;
    }

    // Quarter horizons - show all remaining quarters until end of current year
    if (horizonVisibility.showQuarters) {
      const endOfYear = today.clone().endOf("year").add(1, "days").startOf("day"); // Start of next year

      // Snap to start of next quarter
      let quarterStart = currentDate.clone().startOf("quarter");
      if (quarterStart.isBefore(currentDate)) {
        quarterStart = quarterStart.add(1, "quarters");
      }

      while (quarterStart.isBefore(endOfYear)) {
        const quarterEnd = quarterStart.clone().add(1, "quarters");

        // Skip this quarter if it's entirely contained within the year horizon
        if (!isQuarterOverlapping(quarterStart, quarterEnd)) {
          const quarterNum = Math.ceil((quarterStart.month() + 1) / 3);
          const label = `Q${quarterNum} ${quarterStart.year()} (${quarterStart.format("MMM DD")} - ${quarterEnd.clone().subtract(1, "days").format("MMM DD")})`;
          const todos = getTodosByDate(quarterStart, quarterEnd);
          const style = getWipStyle(todos);
          yield todoColumn("calendar-range", label, todos, hideEmpty, moveToDate(quarterStart), batchMoveToDate(quarterStart), style);
        }
        quarterStart = quarterEnd;
      }
      currentDate = quarterStart;
    }

    // Next year horizon - represents the entire next year
    if (horizonVisibility.showNextYear) {
      const nextYearStart = today.clone().add(1, "years").startOf("year");
      const nextYearEnd = nextYearStart.clone().add(1, "years");
      const label = `${nextYearStart.year()}`;
      const todos = getTodosByDate(nextYearStart, nextYearEnd);
      yield todoColumn("calendar", label, todos, hideEmpty, moveToDate(nextYearStart), batchMoveToDate(nextYearStart));
      currentDate = nextYearEnd;
    }

    if (horizonVisibility.showLater) {
      yield todoColumn("calendar-plus", "Later", getTodosByDate(currentDate, null), hideEmpty, moveToDate(currentDate), batchMoveToDate(currentDate));
    }

    // Custom horizons with position "end" (after time horizons)
    if (customHorizons) {
      for (const horizon of customHorizons.filter((b) => b.position === "end")) {
        if (horizon.tag) {
          yield todoColumn("tag", horizon.label, getCustomHorizonTodos(horizon.tag), hideEmpty, null, null);
        } else if (horizon.date) {
          const horizonDate = moment(horizon.date);
          yield todoColumn("calendar-days", horizon.label, getCustomDateHorizonTodos(horizon.date), hideEmpty, moveToDate(horizonDate), batchMoveToDate(horizonDate));
        }
      }
    }
  }

  deps.logger.debug(`Rendering planning view`);

  // Calculate stats
  const totalTasks = React.useMemo(() => {
    return filteredTodos.filter((todo) => todo.status !== TodoStatus.Complete && todo.status !== TodoStatus.Canceled).length;
  }, [filteredTodos]);

  const completedToday = React.useMemo(() => {
    const today = moment().startOf("day");
    const tomorrow = today.clone().add(1, "day");
    // Using getTodosByDate inline logic to avoid dependency issues
    const dateIsInRange = (date: Moment | null) => date && date.isSameOrAfter(today) && date.isBefore(tomorrow);
    const completedTodos = filteredTodos.filter((todo) => {
      if (todo.status !== TodoStatus.Complete) return false;
      if (!todo.attributes) return false;
      const isSelected = !!todo.attributes[settings.selectedAttribute];
      const completedDate = findTodoDate(todo, settings.completedDateAttribute);
      return isSelected && dateIsInRange(completedDate);
    });
    return completedTodos.length;
  }, [filteredTodos, settings.selectedAttribute, settings.completedDateAttribute]);

  // Auto-scroll during drag
  const futureSectionRef = React.useRef<HTMLDivElement>(null);
  const scrollIntervalRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (!futureSectionRef.current) return;

      const container = futureSectionRef.current;
      const rect = container.getBoundingClientRect();
      const scrollThreshold = 200;
      const scrollSpeed = 10;

      // Clear existing interval
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }

      // Scroll left if near left edge
      if (e.clientX - rect.left < scrollThreshold && e.clientX > rect.left) {
        scrollIntervalRef.current = window.setInterval(() => {
          container.scrollLeft -= scrollSpeed;
        }, 16);
      }
      // Scroll right if near right edge
      else if (rect.right - e.clientX < scrollThreshold && e.clientX < rect.right) {
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
      <PlanningSettingsComponent planningSettings={planningSettings} setPlanningSettings={setPlanningSettings} totalTasks={totalTasks} completedToday={completedToday} app={app} onRefresh={onRefresh} onOpenReport={onOpenReport} />
      {viewMode !== "future" && (
        <div className="today-section">
          <div className="header">
            <span className="icon">☀️</span>
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
    </div>
  );
}

export function MountPlanningComponent(onElement: HTMLElement, props: PlanningComponentProps) {
  onElement.addClass("task-planner");
  const client = createRoot(onElement);
  client.render(<PlanningComponent {...props}></PlanningComponent>);
}
