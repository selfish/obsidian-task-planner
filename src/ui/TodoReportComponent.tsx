import * as React from "react";
import { createRoot } from "react-dom/client";
import { App, TFile } from "obsidian";
import { Logger } from "../types/logger";
import { TodoIndex } from "../core/index/todo-index";
import { TaskPlannerSettings } from "../settings/types";
import { TodoItem, TodoStatus } from "../types/todo";
import { moment, Moment } from "../utils/moment";
import { TodoListComponent } from "./TodoListComponent";

export interface TodoReportComponentDeps {
  logger: Logger;
  todoIndex: TodoIndex<TFile>;
  settings: TaskPlannerSettings;
  app: App;
}

export interface TodoReportComponentProps {
  deps: TodoReportComponentDeps;
}

interface Container {
  title: string;
  todos: TodoItem<TFile>[];
}

interface DateContainer extends Container {
  from: Moment;
  to: Moment;
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

function findTodoCompletionDate(todo: TodoItem<TFile>, settings: TaskPlannerSettings) {
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
  const format = from.year() === moment().year() ? "MMM DD" : "YYYY MMM DD";
  return `${from.format(format)} to ${to.clone().subtract(1, "days").format(format)}`;
}

function getOneWeekFrom(startDate: Moment): DateContainer {
  const to = startDate;
  const from = moveToPreviousMonday(startDate);
  return {
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
    from,
    to,
    title: formatInterval(from, to),
    todos: [],
  };
}

function getDateContainers(minDate: Moment, numberOfWeeks: number, _numberOfMonths: number): DateContainer[] {
  let dateCursor = moment().add(1, "days").startOf("day");
  const containers = [];
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

function filterTodos(todos: TodoItem<TFile>[]): TodoItem<TFile>[] {
  return todos.filter((todo) => todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled);
}

function groupTodos(todos: TodoItem<TFile>[], containers: DateContainer[], settings: TaskPlannerSettings): Container[] {
  containers.forEach((container) => {
    container.todos = todos.filter((todo) => {
      const date = findTodoCompletionDate(todo, settings);
      if (!date) {
        return false;
      }
      return container.from.diff(date) <= 0 && container.to.diff(date) > 0;
    });
  });
  const emptyContainer: Container = {
    title: "No date",
    todos: todos.filter((todo) => !findTodoCompletionDate(todo, settings)),
  };
  (containers as Container[]).push(emptyContainer);
  return containers;
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

function assembleTodosByDate(todos: TodoItem<TFile>[], numberOfWeeks: number, numberOfMonths: number, settings: TaskPlannerSettings): DateContainer[] {
  todos = filterTodos(todos);
  const minDate = getMinDate(todos, settings);
  const containers = getDateContainers(minDate, numberOfWeeks, numberOfMonths);
  groupTodos(todos, containers, settings);
  return containers;
}

function mapContainerToComponent(container: Container, deps: TodoReportComponentDeps) {
  // TODO: Implement folding functionality
  const folded = false;
  return (
    <div key={container.title} className="container">
      <h2 className="section-header">
        {container.title} <span>{folded ? "▶" : "▼"}</span>
      </h2>
      {!folded ? <TodoListComponent deps={deps} todos={container.todos} dontCrossCompleted={true} key={container.title}></TodoListComponent> : ""}
    </div>
  );
}

export function TodoReportComponent({ deps }: TodoReportComponentProps) {
  const [todos, setTodos] = React.useState(deps.todoIndex.todos);
  // Using fixed values for now; setters kept for future UI controls
  const [numberOfWeeks] = React.useState(4);
  const [numberOfMonths] = React.useState(5);
  React.useEffect(() => {
    const unsubscribe = deps.todoIndex.onUpdateEvent.listen((todos) => {
      setTodos(todos);
      return Promise.resolve();
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [deps.todoIndex]);
  const containers = React.useMemo(() => assembleTodosByDate(todos, numberOfWeeks, numberOfMonths, deps.settings), [todos, numberOfWeeks, numberOfMonths, deps.settings]);

  return (
    <>
      <div>
        <h1>
          <span>✅</span> Completed todos
        </h1>
      </div>
      <div>{containers.map((container) => mapContainerToComponent(container, deps))}</div>
    </>
  );
}

export function MountTodoReportComponent(onElement: HTMLElement, props: TodoReportComponentProps) {
  onElement.addClass("task-planner");
  onElement.addClass("report");
  const client = createRoot(onElement);
  client.render(<TodoReportComponent {...props}></TodoReportComponent>);
}
