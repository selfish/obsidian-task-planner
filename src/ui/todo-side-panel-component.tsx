import * as React from "react";
import { createRoot } from "react-dom/client";
import { App, TFile } from "obsidian";
import { TodoItem, TodoStatus } from "../types/todo";
import { TaskPlannerSettings } from "../settings/types";
import { moment } from "../utils/moment";
import { TodoIndex } from "../core/index/todo-index";
import { Logger } from "../types/logger";
import { TodoListComponent } from "./todo-list-component";

export interface TodoSidePanelComponentDeps {
  todoIndex: TodoIndex<TFile>;
  logger: Logger;
  app: App;
  settings: TaskPlannerSettings;
}

export interface TodoSidePanelComponentProps {
  deps: TodoSidePanelComponentDeps;
}

export function TodoSidePanelComponent({ deps }: TodoSidePanelComponentProps) {
  const settings = deps.settings;
  const [todos, setTodos] = React.useState<TodoItem<TFile>[]>(deps.todoIndex.todos);

  React.useEffect(() => {
    const unsubscribe = deps.todoIndex.onUpdateEvent.listen((todos: TodoItem<TFile>[]) => {
      setTodos(todos.filter((todo) => todo.status !== TodoStatus.Complete && todo.status !== TodoStatus.Canceled));
      return Promise.resolve();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [deps.todoIndex]);

  function getSelectedTodos(todos: TodoItem<TFile>[]): TodoItem<TFile>[] {
    return todos.filter((todo) => todo.status !== TodoStatus.Complete && todo.status !== TodoStatus.Canceled && !!todo.attributes[settings.selectedAttribute]);
  }

  function getDueTodos(todos: TodoItem<TFile>[]): TodoItem<TFile>[] {
    const now = moment();
    const todoIsDue = (todo: TodoItem<TFile>) => {
      if (todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled || !todo.attributes || !todo.attributes[settings.dueDateAttribute]) return false;
      try {
        const date = moment(`${todo.attributes[settings.dueDateAttribute]}`);
        return date.isBefore(now);
      } catch (err) {
        deps.logger.error(`Error while parsing date: ${err}`);
        return false;
      }
    };
    const todosWithOverdueDate = todos.filter((todo) => todo.attributes && todoIsDue(todo));
    return todosWithOverdueDate;
  }

  return (
    <>
      <b>Selected:</b>
      <TodoListComponent todos={getSelectedTodos(todos)} deps={deps} />
      <b>Due:</b>
      <TodoListComponent todos={getDueTodos(todos)} deps={deps} />
      <b>All:</b>
      <TodoListComponent todos={todos} deps={deps} />
    </>
  );
}

export function mountSidePanelComponent(onElement: HTMLElement, props: TodoSidePanelComponentProps) {
  onElement.addClass("task-planner");
  onElement.addClass("panel");
  const root = createRoot(onElement);
  root.render(<TodoSidePanelComponent {...props}></TodoSidePanelComponent>);
}
