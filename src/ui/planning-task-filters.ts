import { TFile } from "obsidian";

import { TaskPlannerSettings } from "../settings/types";
import { TaskItem, TaskStatus, getTaskId } from "../types/task";
import { Moment } from "../utils/moment";
import { findTaskDate } from "../utils/task-utils";

export interface TaskFilterContext {
  settings: TaskPlannerSettings;
  filteredTodos: TaskItem<TFile>[];
}

export function getTodosByDate(
  ctx: TaskFilterContext,
  from: Moment | null,
  to: Moment | null,
  includeSelected = false,
  excludeIds?: Set<string>
): TaskItem<TFile>[] {
  const { settings, filteredTodos } = ctx;
  const dateIsInRange = (date: Moment | null) => date && (from === null || date.isSameOrAfter(from)) && (to === null || date.isBefore(to));

  return filteredTodos.filter((todo) => {
    if (excludeIds?.has(getTaskId(todo))) return false;
    if (!todo.attributes) return false;

    const isDone = todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled;
    const isSelected = !!todo.attributes[settings.selectedAttribute];
    const dueDate = findTaskDate(todo, settings.dueDateAttribute);
    const completedDate = findTaskDate(todo, settings.completedDateAttribute);

    if (isDone) return dateIsInRange(completedDate);
    return dateIsInRange(dueDate) || (includeSelected && isSelected);
  });
}

export function getTodosWithNoDate(ctx: TaskFilterContext, excludeIds?: Set<string>): TaskItem<TFile>[] {
  const { settings, filteredTodos } = ctx;
  return filteredTodos.filter((todo) => {
    if (excludeIds?.has(getTaskId(todo))) return false;
    const dueDate = findTaskDate(todo, settings.dueDateAttribute);
    const isSelected = todo.attributes?.[settings.selectedAttribute];
    const isDone = todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled;
    return !dueDate && todo.attributes && !isSelected && !isDone;
  });
}

export function getTodosByDateAndStatus(ctx: TaskFilterContext, from: Moment, to: Moment, statuses: TaskStatus[]): TaskItem<TFile>[] {
  return getTodosByDate(ctx, from, to, true).filter((todo) => statuses.includes(todo.status));
}

export function getInProgressTodos(filteredTodos: TaskItem<TFile>[]): TaskItem<TFile>[] {
  return filteredTodos.filter(
    (todo) => todo.status === TaskStatus.InProgress || todo.status === TaskStatus.AttentionRequired || todo.status === TaskStatus.Delegated
  );
}

export function getInProgressTaskIds(filteredTodos: TaskItem<TFile>[]): Set<string> {
  const ids = new Set<string>();
  for (const todo of filteredTodos) {
    if (todo.status === TaskStatus.InProgress || todo.status === TaskStatus.AttentionRequired || todo.status === TaskStatus.Delegated) {
      ids.add(getTaskId(todo));
    }
  }
  return ids;
}

export function getOverdueTodos(ctx: TaskFilterContext, today: Moment, excludeIds?: Set<string>): TaskItem<TFile>[] {
  const { settings, filteredTodos } = ctx;
  return filteredTodos.filter((todo) => {
    if (excludeIds?.has(getTaskId(todo))) return false;
    if (todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled) return false;
    const dueDate = findTaskDate(todo, settings.dueDateAttribute);
    return dueDate && dueDate.isBefore(today);
  });
}

export function getCustomDateHorizonTodos(
  ctx: TaskFilterContext,
  targetDate: string,
  tag: string | undefined,
  excludeIds: Set<string> | undefined,
  moment: (date?: string) => Moment
): TaskItem<TFile>[] {
  const target = moment(targetDate);
  if (!target.isValid()) return [];

  const start = target.startOf("day");
  const end = start.clone().add(1, "days");
  const todos = getTodosByDate(ctx, start, end, false, excludeIds);

  return tag ? todos.filter((todo) => todo.tags?.includes(tag)) : todos;
}

export function markTasksAsAssigned(todos: TaskItem<TFile>[], assignedIds: Set<string>): void {
  for (const todo of todos) {
    assignedIds.add(getTaskId(todo));
  }
}
