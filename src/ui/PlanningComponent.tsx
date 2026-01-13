import * as React from "react";
import { createRoot } from "react-dom/client";

import { TodoItem, TodoStatus, getTodoId } from "../domain/TodoItem";
import { ILogger } from "../domain/ILogger";
import { App, TFile} from "obsidian";
import { DateTime } from "luxon";
import { TodoIndex } from "../domain/TodoIndex";
import { FileOperations } from "../domain/FileOperations";
import { ProletarianWizardSettings } from "../domain/ProletarianWizardSettings";
import { PlanningSettingsComponent } from "./PlanningSettingsComponent";
import { PlanningTodoColumn } from "./PlanningTodoColumn";
import { TodoMatcher } from "src/domain/TodoMatcher";
import { PlanningSettingsStore } from "./PlanningSettingsStore";
import { Sound, SoundPlayer } from "./SoundPlayer";
import { PwEvent } from "src/events/PwEvent";

function findTodoDate<T>(todo: TodoItem<T>, attribute: string): DateTime | null {
  if (!todo.attributes) {
    return null
  }
  const attr = todo.attributes[attribute]
  if (attr) {
    const d = DateTime.fromISO(`${todo.attributes[attribute]}`);
    return d.isValid ? d : null
  }
  return null;
}

export interface PlanningComponentDeps {
  logger: ILogger,
  todoIndex: TodoIndex<TFile>,
}

export interface PlanningComponentProps {
  deps: PlanningComponentDeps,
  settings: ProletarianWizardSettings,
  app: App,
}

export function PlanningComponent({deps, settings, app}: PlanningComponentProps) {
  const savedSettings = React.useMemo(() => PlanningSettingsStore.getSettings(), []);
  const [planningSettings, setPlanningSettingsState] = React.useState(savedSettings);
  const [todos, setTodos] = React.useState<TodoItem<TFile>[]>(deps.todoIndex.todos);
  const setPlanningSettings = PlanningSettingsStore.decorateSetterWithSaveSettings(setPlanningSettingsState);
  const { searchParameters, hideEmpty, hideDone, wipLimit } = planningSettings;
	const fileOperations = new FileOperations(settings);

  const playSound = React.useMemo(() => new PwEvent<Sound>(), []);

  const filteredTodos = React.useMemo(() => {
    const filter = new TodoMatcher(searchParameters.searchPhrase, searchParameters.fuzzySearch);
    return todos.filter(filter.matches);
  }, [todos, searchParameters]);

  React.useEffect(() => {
    const unsubscribe = deps.todoIndex.onUpdateEvent.listen(async (todos) => {
      setTodos(todos);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [deps.todoIndex]);

  function getTodosByDate(from: DateTime | null, to: DateTime | null, includeSelected: boolean = false): TodoItem<TFile>[] {
    const dateIsInRange = (date: DateTime | null) => date && (from === null || date >= from) && (to === null || date < to)
    function todoInRange<T>(todo: TodoItem<T>){
      const isDone = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled
      const isSelected = todo.attributes && !!todo.attributes[settings.selectedAttribute]
      const dueDate = findTodoDate(todo, settings.dueDateAttribute)
      const completedDate = findTodoDate(todo, settings.completedDateAttribute)
      const dueDateIsInRange = dateIsInRange(dueDate)
      const completedDateIsInRange = dateIsInRange(completedDate)

      // For completed tasks:
      // - Only show in Today's Done if completed today (handled by includeSelected + completedDate check)
      // - Don't show in any other bucket based on dueDate
      if (isDone) {
        return includeSelected && isSelected && completedDateIsInRange;
      }

      // For incomplete tasks, show if dueDate is in range or if selected
      const isInRangeOrSelected = dueDateIsInRange || (includeSelected && isSelected)
      return isInRangeOrSelected
    }
    const todosInRange = filteredTodos.filter((todo) => todo.attributes && todoInRange(todo) && !isInCustomTagBucket(todo));
    return todosInRange
  }

  function getTodosWithNoDate<T>(): TodoItem<TFile>[] {
    return filteredTodos.filter(todo =>
      !findTodoDate(todo, settings.dueDateAttribute)
      && todo.attributes
      && !todo.attributes[settings.selectedAttribute]
      && todo.status !== TodoStatus.Canceled && todo.status !== TodoStatus.Complete
      && !isInCustomTagBucket(todo))
  }

  function findTodo(todoId: string): TodoItem<TFile> | undefined {
		return todos.find(todo => getTodoId(todo) === todoId);
  }

  function moveToDate(date: DateTime) {
    return (todoId: string) => {
      const todo = findTodo(todoId);
      deps.logger.debug(`Moving ${todoId} to ${date}`);
      if (!todo) {
        deps.logger.warn(`Todo ${todoId} not found, couldn't move`);
        return;
      }
			fileOperations.updateAttributeAsync(todo, settings.dueDateAttribute, date.toISODate()).then()
    }
  }

  function batchMoveToDate(date: DateTime) {
    return async (todoIds: string[]) => {
      const todos = todoIds.map(id => findTodo(id)).filter(todo => todo !== undefined) as TodoItem<TFile>[];
      if (todos.length === 0) {
        deps.logger.warn(`No todos found for batch move`);
        return;
      }
      deps.logger.debug(`Batch moving ${todos.length} todos to ${date}`);
      await fileOperations.batchUpdateAttributeAsync(todos, settings.dueDateAttribute, date.toISODate());
    }
  }

  function removeDate() {
    return (todoId: string) => {
      const todo = findTodo(todoId);
      if (!todo) {
        return;
      }
			fileOperations.removeAttributeAsync(todo, settings.dueDateAttribute).then()
    }
  }

  function batchRemoveDate() {
    return async (todoIds: string[]) => {
      const todos = todoIds.map(id => findTodo(id)).filter(todo => todo !== undefined) as TodoItem<TFile>[];
      if (todos.length === 0) return;
      deps.logger.debug(`Batch removing date from ${todos.length} todos`);
      await fileOperations.batchRemoveAttributeAsync(todos, settings.dueDateAttribute);
    }
  }

  function moveToDateAndStatus(date: DateTime, status: TodoStatus) {
    return (todoId: string) => {
      const todo = findTodo(todoId);
      deps.logger.debug(`Moving ${todoId} to ${date}`);
      if (!todo) {
        deps.logger.warn(`Todo ${todoId} not found, couldn't move`);
        return;
      }
      todo.status = status;
			fileOperations.updateAttributeAsync(todo, settings.dueDateAttribute, date.toISODate()).then(() =>{
				fileOperations.updateTodoStatus(todo, settings.completedDateAttribute);
      })
    }
  }

  function batchMoveToDateAndStatus(date: DateTime, status: TodoStatus) {
    return async (todoIds: string[]) => {
      const todos = todoIds.map(id => findTodo(id)).filter(todo => todo !== undefined) as TodoItem<TFile>[];
      if (todos.length === 0) {
        deps.logger.warn(`No todos found for batch move`);
        return;
      }
      deps.logger.debug(`Batch moving ${todos.length} todos to ${date} with status ${status}`);

      // Update status in memory
      todos.forEach(todo => todo.status = status);

      // Batch update date attribute
      await fileOperations.batchUpdateAttributeAsync(todos, settings.dueDateAttribute, date.toISODate());

      // Batch update status
      await fileOperations.batchUpdateTodoStatusAsync(todos, settings.completedDateAttribute);
    }
  }

  function getTodosByDateAndStatus(from: DateTime, to: DateTime, status: TodoStatus[]) {
    const todos = getTodosByDate(from, to, true);
    return todos.filter(todo => status.includes(todo.status));
  }

  function todoColumn(
    icon: string,
    title: string,
    todos: TodoItem<TFile>[],
    hideIfEmpty = hideEmpty,
    onTodoDropped: ((todoId: string) => void) | null = null,
    onBatchTodoDropped?: ((todoIds: string[]) => Promise<void>) | null,
    substyle?: string) {
    return <PlanningTodoColumn
      hideIfEmpty={hideIfEmpty}
      icon={icon}
      title={title}
      key={title}
      onTodoDropped={onTodoDropped}
      onBatchTodoDropped={onBatchTodoDropped}
      todos={todos}
      playSound={playSound}
      deps={{
        app, settings, logger: deps.logger,
      }}
      substyle={substyle}
    />;
  }

  function getTodayWipStyle() {
    if (!wipLimit.isLimited) {
      return ""
    }
    const today = DateTime.now().startOf("day")
    const tomorrow = today.plus({ day: 1 });
    const todos = getTodosByDateAndStatus(today, tomorrow, [TodoStatus.AttentionRequired, TodoStatus.Delegated, TodoStatus.InProgress, TodoStatus.Todo]);
    if (todos.length > wipLimit.dailyLimit) {
      return "th-column-content--wip-exceeded"
    }
  }

  function* getTodayColumns() {
    const today = DateTime.now().startOf("day")
    const tomorrow = today.plus({ day: 1 });
    const columnCount = hideDone ? 2 : 3;

    yield todoColumn(
      "circle",
      "Todo",
      getTodosByDateAndStatus(today, tomorrow, [TodoStatus.Todo]),
      false,
      moveToDateAndStatus(today, TodoStatus.Todo),
      batchMoveToDateAndStatus(today, TodoStatus.Todo),
      `today today-${columnCount}-cols`);

    yield todoColumn(
      "clock",
      "In progress",
      getTodosByDateAndStatus(today, tomorrow, [TodoStatus.AttentionRequired, TodoStatus.Delegated, TodoStatus.InProgress]),
      false,
      moveToDateAndStatus(today, TodoStatus.InProgress),
      batchMoveToDateAndStatus(today, TodoStatus.InProgress),
      `today today-${columnCount}-cols`);

    if (!hideDone) {
      yield todoColumn(
        "check-circle",
        "Done",
        getTodosByDateAndStatus(today, tomorrow, [TodoStatus.Canceled, TodoStatus.Complete]),
        false,
        moveToDateAndStatus(today, TodoStatus.Complete),
        batchMoveToDateAndStatus(today, TodoStatus.Complete),
        `today today-${columnCount}-cols`);
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

  function getCustomBucketTodos(tag: string): TodoItem<TFile>[] {
    return filteredTodos.filter(todo => {
      if (!todo.attributes) return false;
      const tags = todo.attributes['tags'];
      if (typeof tags === 'string') {
        return tags.split(',').map(t => t.trim()).includes(tag);
      }
      return false;
    });
  }

  function isInCustomTagBucket(todo: TodoItem<TFile>): boolean {
    if (!settings.customBuckets) return false;

    // Get all custom tag buckets
    const customTagBuckets = settings.customBuckets.filter(b => b.tag);

    if (customTagBuckets.length === 0) return false;
    if (!todo.attributes) return false;

    const todoTags = todo.attributes['tags'];
    if (typeof todoTags !== 'string') return false;

    const todoTagList = todoTags.split(',').map(t => t.trim());

    // Check if todo has any of the custom bucket tags
    return customTagBuckets.some(bucket => todoTagList.includes(bucket.tag!));
  }

  function getOverdueTodos(): TodoItem<TFile>[] {
    const today = DateTime.now().startOf("day");
    return filteredTodos.filter(todo => {
      if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled) {
        return false;
      }
      if (isInCustomTagBucket(todo)) {
        return false;
      }
      const dueDate = findTodoDate(todo, settings.dueDateAttribute);
      return dueDate && dueDate < today;
    });
  }

  function getCustomDateBucketTodos(targetDate: string): TodoItem<TFile>[] {
    const target = DateTime.fromISO(targetDate);
    if (!target.isValid) return [];

    const start = target.startOf("day");
    const end = start.plus({ days: 1 });
    // getTodosByDate already filters out custom tag bucket todos
    return getTodosByDate(start, end);
  }

  function* getColumns() {
    const { bucketVisibility, customBuckets } = settings;

    const today = DateTime.now().startOf("day");

    // Pre-calculate larger bucket ranges to prevent overlaps
    const monthBucketRanges: Array<{ start: DateTime, end: DateTime }> = [];
    const quarterBucketRanges: Array<{ start: DateTime, end: DateTime }> = [];
    const yearBucketRanges: Array<{ start: DateTime, end: DateTime }> = [];

    // Calculate month bucket ranges - we need to start from where weeks will end
    // to properly calculate overlaps
    let monthCalcStart = today.plus({ days: 1 });

    // Calculate where currentDate will be after week buckets
    if (bucketVisibility.weeksToShow > 0) {
      const firstWeekday = settings.firstWeekday ?? 1;
      let endOfWeek = today;
      while (true) {
        endOfWeek = endOfWeek.plus({ days: 1 });
        if (endOfWeek.weekday === firstWeekday) {
          break;
        }
      }
      monthCalcStart = endOfWeek.plus({ weeks: bucketVisibility.weeksToShow });
    }

    if (bucketVisibility.monthsToShow > 0) {
      let monthStart = monthCalcStart.startOf('month');
      if (monthStart < monthCalcStart) {
        monthStart = monthStart.plus({ months: 1 });
      }
      for (let i = 0; i < bucketVisibility.monthsToShow; i++) {
        const monthEnd = monthStart.plus({ months: 1 });
        monthBucketRanges.push({ start: monthStart, end: monthEnd });
        monthStart = monthEnd;
      }
    }

    // Calculate quarter bucket ranges - start from where months will end
    let quarterCalcStart = monthCalcStart;
    if (bucketVisibility.monthsToShow > 0) {
      let tempMonth = monthCalcStart.startOf('month');
      if (tempMonth < monthCalcStart) {
        tempMonth = tempMonth.plus({ months: 1 });
      }
      quarterCalcStart = tempMonth.plus({ months: bucketVisibility.monthsToShow });
    }

    if (bucketVisibility.showQuarters) {
      const endOfYear = today.endOf('year').plus({ days: 1 }).startOf('day');
      let quarterStart = quarterCalcStart.startOf('quarter');
      if (quarterStart < quarterCalcStart) {
        quarterStart = quarterStart.plus({ quarters: 1 });
      }
      while (quarterStart < endOfYear) {
        const quarterEnd = quarterStart.plus({ quarters: 1 });
        quarterBucketRanges.push({ start: quarterStart, end: quarterEnd });
        quarterStart = quarterEnd;
      }
    }

    // Calculate next year bucket range - only if it starts next year
    if (bucketVisibility.showNextYear) {
      const nextYearStart = today.plus({ years: 1 }).startOf('year');
      const nextYearEnd = nextYearStart.plus({ years: 1 });
      // Only add if the next year is actually in the future (not already covered by months/quarters)
      if (nextYearStart.year > today.year) {
        yearBucketRanges.push({ start: nextYearStart, end: nextYearEnd });
      }
    }

    // Check if a week bucket overlaps with month/quarter/year buckets
    function isWeekOverlapping(start: DateTime, end: DateTime): boolean {
      const allLarger = [...monthBucketRanges, ...quarterBucketRanges, ...yearBucketRanges];
      return allLarger.some(bucket =>
        start >= bucket.start && end <= bucket.end
      );
    }

    // Check if a month bucket overlaps with quarter/year buckets
    function isMonthOverlapping(start: DateTime, end: DateTime): boolean {
      const allLarger = [...quarterBucketRanges, ...yearBucketRanges];
      return allLarger.some(bucket =>
        start >= bucket.start && end <= bucket.end
      );
    }

    // Check if a quarter bucket overlaps with year buckets
    function isQuarterOverlapping(start: DateTime, end: DateTime): boolean {
      return yearBucketRanges.some(bucket =>
        start >= bucket.start && end <= bucket.end
      );
    }

    // Custom buckets with position "before" (before backlog)
    if (customBuckets) {
      for (const bucket of customBuckets.filter(b => b.position === "before")) {
        if (bucket.tag) {
          yield todoColumn(
            "tag",
            bucket.label,
            getCustomBucketTodos(bucket.tag),
            hideEmpty,
            null,
            null);
        } else if (bucket.date) {
          const bucketDate = DateTime.fromISO(bucket.date);
          yield todoColumn(
            "calendar-days",
            bucket.label,
            getCustomDateBucketTodos(bucket.date),
            hideEmpty,
            moveToDate(bucketDate),
            batchMoveToDate(bucketDate));
        }
      }
    }

    if (bucketVisibility.showBacklog) {
      yield todoColumn(
        "inbox",
        "Backlog",
        getTodosWithNoDate(),
        false,
        removeDate(),
        batchRemoveDate());
    }

    // Show overdue tasks (past due date, not completed)
    // Note: showPast and showOverdue both showed the same thing, so we consolidated to just Overdue
    if (bucketVisibility.showOverdue || bucketVisibility.showPast) {
      yield todoColumn(
        "alert-triangle",
        "Overdue",
        getOverdueTodos(),
        true,
        null,
        null);
    }

    // Custom buckets with position "after" (after backlog, before time buckets)
    if (customBuckets) {
      for (const bucket of customBuckets.filter(b => b.position === "after")) {
        if (bucket.tag) {
          yield todoColumn(
            "tag",
            bucket.label,
            getCustomBucketTodos(bucket.tag),
            hideEmpty,
            null,
            null);
        } else if (bucket.date) {
          const bucketDate = DateTime.fromISO(bucket.date);
          yield todoColumn(
            "calendar-days",
            bucket.label,
            getCustomDateBucketTodos(bucket.date),
            hideEmpty,
            moveToDate(bucketDate),
            batchMoveToDate(bucketDate));
        }
      }
    }

    // Individual weekdays (Monday through Sunday) - only until end of current week
    let currentDate = today.plus({ days: 1 }); // Start from tomorrow
    const weekdaySettings = [
      { day: 1, key: 'showMonday', label: 'Monday' },
      { day: 2, key: 'showTuesday', label: 'Tuesday' },
      { day: 3, key: 'showWednesday', label: 'Wednesday' },
      { day: 4, key: 'showThursday', label: 'Thursday' },
      { day: 5, key: 'showFriday', label: 'Friday' },
      { day: 6, key: 'showSaturday', label: 'Saturday' },
      { day: 7, key: 'showSunday', label: 'Sunday' }
    ];

    // Calculate end of current week based on firstWeekday setting
    const firstWeekday = settings.firstWeekday ?? 1;
    let endOfWeek = today;
    while (true) {
      endOfWeek = endOfWeek.plus({ days: 1 });
      if (endOfWeek.weekday === firstWeekday) {
        break; // Found the start of next week
      }
    }

    // Show selected weekdays only until end of current week
    let isFirstDay = true;
    while (currentDate < endOfWeek) {
      const weekday = currentDate.weekday;
      const setting = weekdaySettings.find(s => s.day === weekday);

      if (setting && bucketVisibility[setting.key]) {
        const nextDay = currentDate.plus({ days: 1 });
        const todos = getTodosByDate(currentDate, nextDay);
        const style = getWipStyle(todos);
        const label = isFirstDay ? "Tomorrow" : currentDate.toFormat("cccc dd/MM");

        yield todoColumn(
          isFirstDay ? "calendar-clock" : "calendar",
          label,
          todos,
          hideEmpty,
          moveToDate(currentDate),
          batchMoveToDate(currentDate),
          style);

        isFirstDay = false;
      }

      currentDate = currentDate.plus({ days: 1 });
    }

    // Week buckets - start from the calculated endOfWeek (start of next week)
    if (bucketVisibility.weeksToShow > 0) {
      let weekStart = endOfWeek; // Already calculated as start of next week

      for (let i = 1; i <= bucketVisibility.weeksToShow; i++) {
        const weekEnd = weekStart.plus({ weeks: 1 });

        // Skip this week if it's entirely contained within a larger bucket (month/quarter/year)
        if (!isWeekOverlapping(weekStart, weekEnd)) {
          const label = `Week +${i} (${weekStart.toFormat("dd/MM")} - ${weekEnd.minus({ days: 1 }).toFormat("dd/MM")})`;
          const todos = getTodosByDate(weekStart, weekEnd);
          const style = getWipStyle(todos);
          yield todoColumn(
            "calendar",
            label,
            todos,
            hideEmpty,
            moveToDate(weekStart),
            batchMoveToDate(weekStart),
            style);
        }
        weekStart = weekEnd;
      }
      currentDate = weekStart;
    } else {
      currentDate = endOfWeek;
    }

    // Month buckets
    if (bucketVisibility.monthsToShow > 0) {
      // Snap to start of next month
      let monthStart = currentDate.startOf('month');
      if (monthStart < currentDate) {
        monthStart = monthStart.plus({ months: 1 });
      }

      for (let i = 1; i <= bucketVisibility.monthsToShow; i++) {
        const monthEnd = monthStart.plus({ months: 1 });

        // Skip this month if it's entirely contained within a larger bucket (quarter/year)
        if (!isMonthOverlapping(monthStart, monthEnd)) {
          const label = `Month +${i} (${monthStart.toFormat("MMM dd")} - ${monthEnd.minus({ days: 1 }).toFormat("MMM dd")})`;
          const todos = getTodosByDate(monthStart, monthEnd);
          const style = getWipStyle(todos);
          yield todoColumn(
            "calendar-range",
            label,
            todos,
            hideEmpty,
            moveToDate(monthStart),
            batchMoveToDate(monthStart),
            style);
        }
        monthStart = monthEnd;
      }
      currentDate = monthStart;
    }

    // Quarter buckets - show all remaining quarters until end of current year
    if (bucketVisibility.showQuarters) {
      const endOfYear = today.endOf('year').plus({ days: 1 }).startOf('day'); // Start of next year

      // Snap to start of next quarter
      let quarterStart = currentDate.startOf('quarter');
      if (quarterStart < currentDate) {
        quarterStart = quarterStart.plus({ quarters: 1 });
      }

      while (quarterStart < endOfYear) {
        const quarterEnd = quarterStart.plus({ quarters: 1 });

        // Skip this quarter if it's entirely contained within the year bucket
        if (!isQuarterOverlapping(quarterStart, quarterEnd)) {
          const quarterNum = Math.ceil(quarterStart.month / 3);
          const label = `Q${quarterNum} ${quarterStart.year} (${quarterStart.toFormat("MMM dd")} - ${quarterEnd.minus({ days: 1 }).toFormat("MMM dd")})`;
          const todos = getTodosByDate(quarterStart, quarterEnd);
          const style = getWipStyle(todos);
          yield todoColumn(
            "calendar-range",
            label,
            todos,
            hideEmpty,
            moveToDate(quarterStart),
            batchMoveToDate(quarterStart),
            style);
        }
        quarterStart = quarterEnd;
      }
      currentDate = quarterStart;
    }

    // Next year bucket - represents the entire next year
    if (bucketVisibility.showNextYear) {
      const nextYearStart = today.plus({ years: 1 }).startOf('year');
      const nextYearEnd = nextYearStart.plus({ years: 1 });
      const label = `${nextYearStart.year}`;
      const todos = getTodosByDate(nextYearStart, nextYearEnd);
      yield todoColumn(
        "calendar",
        label,
        todos,
        hideEmpty,
        moveToDate(nextYearStart),
        batchMoveToDate(nextYearStart));
      currentDate = nextYearEnd;
    }

    if (bucketVisibility.showLater) {
      yield todoColumn(
        "calendar-plus",
        "Later",
        getTodosByDate(currentDate, null),
        hideEmpty,
        moveToDate(currentDate),
        batchMoveToDate(currentDate));
    }

    // Custom buckets with position "end" (after time buckets)
    if (customBuckets) {
      for (const bucket of customBuckets.filter(b => b.position === "end")) {
        if (bucket.tag) {
          yield todoColumn(
            "tag",
            bucket.label,
            getCustomBucketTodos(bucket.tag),
            hideEmpty,
            null,
            null);
        } else if (bucket.date) {
          const bucketDate = DateTime.fromISO(bucket.date);
          yield todoColumn(
            "calendar-days",
            bucket.label,
            getCustomDateBucketTodos(bucket.date),
            hideEmpty,
            moveToDate(bucketDate),
            batchMoveToDate(bucketDate));
        }
      }
    }
  }

  deps.logger.debug(`Rendering planning view`)

  // Calculate stats
  const totalTasks = React.useMemo(() => {
    return filteredTodos.filter(todo => todo.status !== TodoStatus.Complete && todo.status !== TodoStatus.Canceled).length;
  }, [filteredTodos]);

  const completedToday = React.useMemo(() => {
    const today = DateTime.now().startOf("day");
    const tomorrow = today.plus({ day: 1 });
    return getTodosByDate(today, tomorrow, true).filter(todo => todo.status === TodoStatus.Complete).length;
  }, [filteredTodos]);

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

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDragEnd);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDragEnd);
    };
  }, []);

  return <div className="th-planning-board">
    <PlanningSettingsComponent
      planningSettings={planningSettings}
      setPlanningSettings={setPlanningSettings}
      totalTasks={totalTasks}
      completedToday={completedToday}
      app={app}
      />
    <div className="th-today-section">
      <div className="th-today-header">
        <span className="th-today-icon">☀️</span>
        <span>Today</span>
      </div>
      <div className="th-today-columns">
        {Array.from(getTodayColumns())}
      </div>
    </div>
    <div className="th-future-section" ref={futureSectionRef}>
      {Array.from(getColumns())}
    </div>
  </div>;
}

export function MountPlanningComponent(onElement: HTMLElement, props: PlanningComponentProps) {
  const client = createRoot(onElement);
  client.render(<PlanningComponent {...props}></PlanningComponent>);
}
