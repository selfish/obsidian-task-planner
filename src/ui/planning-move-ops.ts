import { TFile } from "obsidian";

import { UndoableFileOperations } from "../core/operations/undoable-file-ops";
import { UndoManager } from "../core/operations/undo-manager";
import { TaskPlannerSettings } from "../settings/types";
import { TaskItem, TaskStatus, getTaskId } from "../types/task";
import { moment, Moment } from "../utils/moment";

export interface MoveOperationsDeps {
  settings: TaskPlannerSettings;
  undoableFileOps: UndoableFileOperations;
  findTodo: (taskId: string) => TaskItem<TFile> | undefined;
}

export function getDateLabel(date: Moment): string {
  const today = moment().startOf("day");
  if (date.isSame(today, "day")) return "Today";
  if (date.isSame(today.clone().add(1, "day"), "day")) return "Tomorrow";
  return date.format("MMM D");
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Todo]: "Todo",
  [TaskStatus.InProgress]: "In Progress",
  [TaskStatus.Complete]: "Done",
  [TaskStatus.Canceled]: "Canceled",
  [TaskStatus.Delegated]: "Delegated",
  [TaskStatus.AttentionRequired]: "Attention Required",
};

function getStatusLabel(s: TaskStatus): string {
  return STATUS_LABELS[s] || "Unknown";
}

function getTagsToRemove(todos: TaskItem<TFile>[], settings: TaskPlannerSettings): string[] {
  return (settings.customHorizons || []).filter((h) => h.tag && todos.some((t) => t.tags?.includes(h.tag!))).map((h) => h.tag!);
}

function resolveTodos(deps: MoveOperationsDeps, ids: string[]): TaskItem<TFile>[] {
  return ids.map((id) => deps.findTodo(id)).filter((t): t is TaskItem<TFile> => !!t);
}

export function createMoveOperations(deps: MoveOperationsDeps) {
  const { settings, undoableFileOps, findTodo } = deps;
  const attr = settings.dueDateAttribute;

  const move = (date: Moment, tag?: string, status?: TaskStatus, removeCustomTags = true) => (id: string) => {
    const todo = findTodo(id);
    if (!todo) return;
    const dateStr = date.format("YYYY-MM-DD");
    const tagsToRemove = removeCustomTags && !tag ? getTagsToRemove([todo], settings) : undefined;
    const label = tag ? `${getDateLabel(date)} (#${tag})` : status ? `${getDateLabel(date)} (${getStatusLabel(status)})` : getDateLabel(date);
    void undoableFileOps.combinedMoveWithUndo([todo], attr, dateStr, tag, status ?? TaskStatus.Todo, UndoManager.createMoveDescription(1, label), tagsToRemove);
  };

  const batchMove = (date: Moment, tag?: string, status?: TaskStatus, removeCustomTags = true) => async (ids: string[]) => {
    const todos = resolveTodos(deps, ids);
    if (!todos.length) return;
    const dateStr = date.format("YYYY-MM-DD");
    const tagsToRemove = removeCustomTags && !tag ? getTagsToRemove(todos, settings) : undefined;
    const label = tag ? `${getDateLabel(date)} (#${tag})` : status ? `${getDateLabel(date)} (${getStatusLabel(status)})` : getDateLabel(date);
    await undoableFileOps.combinedMoveWithUndo(todos, attr, dateStr, tag, status ?? TaskStatus.Todo, UndoManager.createMoveDescription(todos.length, label), tagsToRemove);
  };

  const changeStatus = (status: TaskStatus) => (id: string) => {
    const todo = findTodo(id);
    if (!todo) return;
    void undoableFileOps.batchUpdateTaskStatusWithUndo([{ ...todo, status }], new Map([[id, todo.status]]), UndoManager.createMoveDescription(1, getStatusLabel(status)));
  };

  const batchChangeStatus = (status: TaskStatus) => async (ids: string[]) => {
    const todos = resolveTodos(deps, ids);
    if (!todos.length) return;
    const prev = new Map(todos.map((t) => [getTaskId(t), t.status]));
    await undoableFileOps.batchUpdateTaskStatusWithUndo(todos.map((t) => ({ ...t, status })), prev, UndoManager.createMoveDescription(todos.length, getStatusLabel(status)));
  };

  const removeDate = () => (id: string) => {
    const todo = findTodo(id);
    if (todo) void undoableFileOps.batchRemoveAttributeWithUndo([todo], attr, UndoManager.createMoveDescription(1, "Backlog"));
  };

  const batchRemoveDate = () => async (ids: string[]) => {
    const todos = resolveTodos(deps, ids);
    if (todos.length) await undoableFileOps.batchRemoveAttributeWithUndo(todos, attr, UndoManager.createMoveDescription(todos.length, "Backlog"));
  };

  return {
    moveToDate: (d: Moment) => move(d),
    batchMoveToDate: (d: Moment) => batchMove(d),
    moveToDateAndTag: (d: Moment, t: string) => move(d, t),
    batchMoveToDateAndTag: (d: Moment, t: string) => batchMove(d, t),
    moveToDateAndStatus: (d: Moment, s: TaskStatus) => move(d, undefined, s, false),
    batchMoveToDateAndStatus: (d: Moment, s: TaskStatus) => batchMove(d, undefined, s, false),
    changeStatusOnly: changeStatus,
    batchChangeStatusOnly: batchChangeStatus,
    removeDate,
    batchRemoveDate,
  };
}

export type MoveOperations = ReturnType<typeof createMoveOperations>;
