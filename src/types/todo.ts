import { FileAdapter } from "./file-adapter";

export enum TodoStatus {
  AttentionRequired = 0,
  Todo = 1,
  InProgress = 2,
  Delegated = 3,
  Complete = 4,
  Canceled = 5,
}

export interface TodoItem<TFile> {
  status: TodoStatus;
  text: string;
  file: FileAdapter<TFile>;
  folderType?: string;
  project?: string;
  attributes?: Record<string, string | boolean>;
  line?: number;
  subtasks?: TodoItem<TFile>[];
}

export function getTodoId<T>(todo: TodoItem<T>): string {
  return todo.file.id + "-" + (todo.line || 0) + "-" + todo.text;
}
